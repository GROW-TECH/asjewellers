// server/index.js (ES module)
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js'; // Import Supabase client

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'x-client-info': 'server' } }
});

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(bodyParser.json({ limit: '200kb' }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Session check endpoint (using Supabase's Admin API)
app.get('/api/session', async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];  // Get token from Authorization header
    if (!token) {
      return res.status(400).json({ error: 'No session token provided' });
    }

    // Use the Supabase Admin API to get the user associated with the token
    const { data, error } = await supabaseAdmin.auth.api.getUser(token);

    if (error) {
      console.error('Error fetching session:', error);
      return res.status(400).json({ error: 'Session not found' });
    }

    res.json({ session: data }); // If valid session, return session data
  } catch (error) {
    console.error('Error checking session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




/**
 * POST /create-subscription
 * Body:
 * {
 *   user_id, plan_id, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
 * }
 *
 * Server inserts subscription using service key, then creates Razorpay order for first payment.
 * Returns:
 * { success: true, subscription_id, order: { order_id, amount, currency, key_id } }
 */
app.post('/create-subscription', async (req, res) => {
  try {
    const { user_id, plan_id, start_date, end_date } = req.body ?? {};
    if (!user_id || !plan_id || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Load plan to get monthly_due (server trusts DB)
    const { data: planData, error: planErr } = await supabaseAdmin
      .from('plans')
      .select('monthly_due, scheme_name')
      .eq('id', plan_id)
      .maybeSingle();

    if (planErr) {
      console.error('Plan fetch error', planErr);
      return res.status(500).json({ success: false, message: 'Failed to read plan' });
    }
    if (!planData) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const monthlyDue = Number(planData.monthly_due || 0);
    if (monthlyDue <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid monthly_due in plan' });
    }

    // Insert subscription row with status pending
    const insertPayload = {
      user_id,
      plan_id,
      start_date,
      end_date,
      status: 'pending',
      total_paid: 0,
      bonus_amount: 0,
      final_amount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertData, error: insertErr } = await supabaseAdmin
      .from('user_subscriptions')
      .insert([insertPayload])
      .select('id')
      .limit(1);

    if (insertErr) {
      console.error('Subscription insert error', insertErr);
      return res.status(500).json({ success: false, message: 'Failed to create subscription', details: insertErr.message });
    }

    let subscriptionId = null;
    if (Array.isArray(insertData) && insertData.length > 0) {
      subscriptionId = insertData[0].id;
    } else if (insertData && insertData.id) {
      subscriptionId = insertData.id;
    }

    if (!subscriptionId) {
      console.error('No subscription id returned from insert', insertData);
      return res.status(500).json({ success: false, message: 'Subscription creation returned no id' });
    }

    // Create Razorpay order for first monthly payment
    const amountInPaise = Math.round(monthlyDue * 100); // convert to paise
    const receiptId = `sub_${subscriptionId}_${Date.now()}`;

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);

    return res.json({
      success: true,
      subscription_id: subscriptionId,
      order: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: RAZORPAY_KEY_ID
      }
    });
  } catch (err) {
    console.error('create-subscription error', err);
    return res.status(500).json({ success: false, message: 'Server error', details: String(err) });
  }
});

/**
 * POST /verify-payment
 * Body:
 * {
 *   razorpay_payment_id, razorpay_order_id, razorpay_signature, subscription_id
 * }
 *
 * Verifies signature and updates subscription status to 'active' and stores payment details.
 */
app.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, subscription_id } = req.body ?? {};
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !subscription_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // verify signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.warn('Signature mismatch', { generatedSignature, razorpay_signature });
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // optional: fetch payment object from Razorpay to get amount, status etc.
    let paymentObj = null;
    try {
      paymentObj = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (fetchErr) {
      console.warn('Could not fetch payment details from Razorpay', fetchErr);
    }

    // Update subscription row to active
    const updatePayload = {
      status: 'active',
      total_paid: paymentObj?.amount ? (paymentObj.amount / 100) : undefined,
      final_amount: paymentObj?.amount ? (paymentObj.amount / 100) : undefined,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      updated_at: new Date().toISOString()
    };

    // remove undefined keys
    Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

    const { error: updateErr } = await supabaseAdmin
      .from('user_subscriptions')
      .update(updatePayload)
      .eq('id', subscription_id);

    if (updateErr) {
      console.error('Failed to update subscription after verify', updateErr);
      return res.status(500).json({ success: false, message: 'Failed to update subscription', details: updateErr.message });
    }

    return res.json({ success: true, message: 'Payment verified and subscription activated' });
  } catch (err) {
    console.error('verify-payment error', err);
    return res.status(500).json({ success: false, message: 'Server error', details: String(err) });
  }
});


app.get('/api/profile/:userId', async (req, res) => {
  const { userId } = req.params;

  // Fetch profile data from user_profile table
  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // Handle missing fields (e.g., full_name)
  if (!data.full_name) {
    data.full_name = 'Unnamed User';  // Default value if full_name is missing
  }

  res.json(data);  // Send profile data as response
});

// API to fetch active plans
app.get('/api/active-plans/:userId', async (req, res) => {
  const { userId } = req.params;

  // Fetch active plans from user_subscriptions table
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json(data);  // Send active plans data as response
});
app.get('/profile/:userId', async (req, res) => {
  const { userId } = req.params;

  // Fetch profile data
  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('id', userId)
    .single(); // Get a single row

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // Handle missing profile fields (example: set default 'full_name')
  if (!data.full_name) {
    data.full_name = 'Unnamed User';
  }

  res.json(data);
});

// Endpoint to update profile data
app.put('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const { full_name, phone, referral_code } = req.body;

  // Update profile fields
  const { data, error } = await supabase
    .from('user_profile')
    .upsert({
      id: userId,
      full_name: full_name || 'Unnamed User', // Set default value if missing
      phone,
      referral_code,
    })
    .eq('id', userId);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Payment server listening on http://lcalhost:${PORT}`);
});

