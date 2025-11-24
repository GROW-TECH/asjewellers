// server/index.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const app = express();

// Simple CORS configuration - avoid complex origin checking that causes issues
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://localhost:8081',
    'exp://localhost:8081'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

const RP_KEY_ID = process.env.RP_KEY_ID;
const RP_KEY_SECRET = process.env.RP_KEY_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Environment Check:');
console.log('SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
console.log('RP_KEY_ID:', RP_KEY_ID ? '✅ Set' : '❌ Missing');
console.log('RP_KEY_SECRET:', RP_KEY_SECRET ? '✅ Set' : '❌ Missing');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase env vars. Set SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!RP_KEY_ID || !RP_KEY_SECRET) {
  console.error('❌ Razorpay keys missing. Set RP_KEY_ID and RP_KEY_SECRET environment variables');
  console.error('💡 Get keys from: https://dashboard.razorpay.com/app/keys');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const razorpay = new Razorpay({ 
  key_id: RP_KEY_ID, 
  key_secret: RP_KEY_SECRET 
});

// Enhanced request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📨 ${timestamp} ${req.method} ${req.path}`);
  console.log(`   Origin: ${req.headers.origin || 'No Origin'}`);
  console.log(`   User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
  next();
});

// Health check endpoint with detailed info
app.get('/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Gold Investment API',
    version: '1.0.0',
    razorpay: {
      configured: !!(RP_KEY_ID && RP_KEY_SECRET),
      key_id: RP_KEY_ID ? `${RP_KEY_ID.substring(0, 10)}...` : 'Not set'
    },
    supabase: {
      configured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
      url: SUPABASE_URL ? 'Set' : 'Not set'
    },
    endpoints: [
      '/health',
      '/test',
      '/create-razorpay-order',
      '/verify-payment',
      '/test-payment'
    ]
  });
});

// Enhanced test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: '✅ Server is working correctly!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    server_time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  });
});

// Test payment endpoint for debugging
app.post('/test-payment', async (req, res) => {
  console.log('🧪 Test payment requested:', req.body);
  
  try {
    const { amount = 10000 } = req.body; // Default 100 INR
    
    const orderOptions = {
      amount: Math.round(Number(amount)),
      currency: 'INR',
      receipt: `test_rcpt_${Date.now()}`,
      payment_capture: 1,
    };

    console.log('Creating test order with:', orderOptions);
    
    const order = await razorpay.orders.create(orderOptions);
    
    console.log('✅ Test order created:', order.id);
    
    return res.json({ 
      success: true,
      order_id: order.id, 
      amount: order.amount, 
      currency: order.currency, 
      key_id: RP_KEY_ID,
      message: 'Test order created successfully. Use this order_id for testing payments.'
    });
    
  } catch (err) {
    console.error('❌ Test payment error:', err);
    
    let errorDetails = 'Unknown Razorpay error';
    if (err.error && err.error.description) {
      errorDetails = err.error.description;
    } else if (err.message) {
      errorDetails = err.message;
    }
    
    return res.status(500).json({ 
      success: false,
      error: 'test_order_failed', 
      details: errorDetails
    });
  }
});

// Enhanced order creation with better error handling
app.post('/create-razorpay-order', async (req, res) => {
  console.log('💰 Create order request:', {
    body: req.body,
    headers: req.headers,
    origin: req.headers.origin
  });
  
  // Check if Razorpay keys are configured
  if (!RP_KEY_ID || !RP_KEY_SECRET) {
    console.error('❌ Razorpay keys not configured');
    return res.status(500).json({ 
      success: false,
      error: 'RAZORPAY_KEYS_MISSING',
      message: 'Razorpay keys not configured on server',
      details: 'Check RP_KEY_ID and RP_KEY_SECRET environment variables'
    });
  }

  try {
    const { amount_in_paise, receipt_id, currency = 'INR', plan_name = 'Gold Plan' } = req.body;
    
    if (!amount_in_paise || isNaN(Number(amount_in_paise))) {
      return res.status(400).json({ 
        success: false,
        error: 'INVALID_AMOUNT',
        message: 'Invalid amount_in_paise'
      });
    }

    const amount = Math.round(Number(amount_in_paise));
    
    // Validate amount (Razorpay requires min 1 INR = 100 paise)
    if (amount < 100) {
      return res.status(400).json({ 
        success: false,
        error: 'AMOUNT_TOO_SMALL',
        message: 'Amount must be at least 100 paise (1 INR)'
      });
    }

    const orderOptions = {
      amount: amount,
      currency,
      receipt: receipt_id || `rcpt_${Date.now()}`,
      payment_capture: 1,
      notes: {
        plan_name: plan_name,
        created_at: new Date().toISOString()
      }
    };

    console.log('🔄 Creating Razorpay order with:', orderOptions);
    
    const order = await razorpay.orders.create(orderOptions);
    
    console.log('✅ Order created successfully:', {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt
    });
    
    return res.json({ 
      success: true,
      order_id: order.id, 
      amount: order.amount, 
      currency: order.currency, 
      key_id: RP_KEY_ID,
      receipt: order.receipt
    });
    
  } catch (err) {
    console.error('❌ Create order error:', err);
    
    let errorCode = 'RAZORPAY_ERROR';
    let errorMessage = 'Unknown Razorpay error';
    let statusCode = 500;

    if (err.error && err.error.description) {
      errorMessage = err.error.description;
      if (err.error.code === 'BAD_REQUEST_ERROR') {
        errorCode = 'BAD_REQUEST';
        statusCode = 400;
      }
    } else if (err.message) {
      errorMessage = err.message;
    }
    
    return res.status(statusCode).json({ 
      success: false,
      error: errorCode, 
      message: errorMessage,
      details: 'Check Razorpay dashboard for more details'
    });
  }
});

// Enhanced payment verification with better logging
app.post('/verify-payment', async (req, res) => {
  console.log('🔍 Verify payment request:', {
    body: req.body,
    headers: req.headers
  });
  
  if (!RP_KEY_SECRET) {
    return res.status(500).json({ 
      success: false, 
      error: 'RAZORPAY_SECRET_MISSING',
      message: 'Razorpay secret key not configured' 
    });
  }

  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, subscription_id } = req.body;
    
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Missing required payment fields' 
      });
    }

    console.log('🔄 Verifying payment:', {
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      subscription_id: subscription_id
    });

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', RP_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
      
    console.log('🔐 Signature verification:', {
      received: razorpay_signature.substring(0, 20) + '...',
      generated: generated_signature.substring(0, 20) + '...',
      match: generated_signature === razorpay_signature
    });

    if (generated_signature !== razorpay_signature) {
      console.warn('❌ Signature mismatch for payment:', razorpay_payment_id);
      
      if (subscription_id) {
        await supabaseAdmin
          .from('user_subscriptions')
          .update({ 
            status: 'failed',
            failed_reason: 'signature_mismatch',
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription_id)
          .catch(err => console.error('Failed to update subscription:', err));
      }
        
      return res.status(400).json({ 
        success: false, 
        error: 'INVALID_SIGNATURE',
        message: 'Payment signature verification failed' 
      });
    }

    // Fetch payment details from Razorpay
    let paymentDetails = null;
    let amountPaise = null;
    
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
      amountPaise = paymentDetails?.amount ?? null;
      console.log('✅ Payment details from Razorpay:', {
        status: paymentDetails?.status,
        amount: paymentDetails?.amount,
        currency: paymentDetails?.currency
      });
    } catch (razorpayError) {
      console.warn('⚠️ Could not fetch payment details from Razorpay:', razorpayError);
    }

    // Fetch order details if payment details not available
    if (!amountPaise) {
      try {
        const order = await razorpay.orders.fetch(razorpay_order_id);
        amountPaise = order?.amount ?? null;
        console.log('✅ Order details from Razorpay:', {
          amount: order?.amount,
          currency: order?.currency
        });
      } catch (orderError) {
        console.warn('⚠️ Could not fetch order details from Razorpay:', orderError);
      }
    }
    
    const amountInRupees = amountPaise !== null ? amountPaise / 100 : null;

    // Update subscription if provided
    if (subscription_id) {
      try {
        // First, get current subscription to check user_id
        const { data: subscriptionRow, error: subError } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id, plan_id')
          .eq('id', subscription_id)
          .limit(1)
          .maybeSingle();

        if (subError) {
          console.error('❌ Error fetching subscription:', subError);
        }

        const userId = subscriptionRow?.user_id ?? null;

        // Update subscription status
        const updates = { 
          status: 'active',
          updated_at: new Date().toISOString()
        };
        
        if (amountInRupees !== null) {
          updates.total_paid = amountInRupees;
        }

        const { error: updateError } = await supabaseAdmin
          .from('user_subscriptions')
          .update(updates)
          .eq('id', subscription_id);

        if (updateError) {
          console.error('❌ Error updating subscription:', updateError);
        } else {
          console.log('✅ Subscription updated successfully');
        }

        // Insert payment record
        const paymentInsert = {
          user_id: userId,
          subscription_id,
          amount: amountInRupees ?? undefined,
          payment_type: 'razorpay',
          razorpay_payment_id,
          razorpay_order_id,
          status: 'completed',
          created_at: new Date().toISOString(),
          metadata: {
            verified_at: new Date().toISOString(),
            signature_verified: true
          }
        };
        
        const { error: paymentError } = await supabaseAdmin
          .from('payments')
          .insert(paymentInsert);

        if (paymentError) {
          console.error('❌ Error inserting payment record:', paymentError);
        } else {
          console.log('✅ Payment record inserted successfully');
        }

      } catch (dbError) {
        console.error('❌ Database operation error:', dbError);
        // Don't fail the entire verification if DB operations fail
      }
    }

    console.log('✅ Payment verified successfully:', razorpay_payment_id);
    
    return res.json({ 
      success: true, 
      message: 'Payment verified successfully',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      amount: amountInRupees,
      verified_at: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ Verify-payment error:', err);
    
    return res.status(500).json({ 
      success: false, 
      error: 'VERIFICATION_FAILED',
      message: 'Payment verification failed',
      details: err.message || 'Internal server error during verification'
    });
  }
});

// New endpoint to check server connectivity from client
app.get('/server-status', (req, res) => {
  res.json({
    success: true,
    server: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3001,
    razorpay_configured: !!(RP_KEY_ID && RP_KEY_SECRET),
    supabase_configured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  });
});

// Manual preflight handler for specific routes
const handlePreflight = (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
};

// Add preflight handlers for specific routes
app.options('/create-razorpay-order', handlePreflight);
app.options('/verify-payment', handlePreflight);
app.options('/test-payment', handlePreflight);

// 404 handler - use a proper path instead of '*'
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    // Handle OPTIONS requests that don't match specific routes
    handlePreflight(req, res);
  } else {
    console.log('❌ 404 - Endpoint not found:', req.method, req.originalUrl);
    res.status(404).json({ 
      success: false,
      error: 'ENDPOINT_NOT_FOUND',
      message: 'Endpoint not found',
      path: req.originalUrl,
      method: req.method,
      available_endpoints: [
        'GET /health',
        'GET /test', 
        'GET /server-status',
        'POST /create-razorpay-order',
        'POST /verify-payment',
        'POST /test-payment'
      ]
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('💥 Global error handler:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong on the server',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📍 Network: http://0.0.0.0:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`📡 Status endpoint: http://localhost:${PORT}/server-status`);
  console.log(`💳 Payment API: http://localhost:${PORT}/create-razorpay-order`);
  console.log(`🔍 Verification API: http://localhost:${PORT}/verify-payment`);
  console.log('');
  console.log('🔧 Server Features:');
  console.log('   ✅ Enhanced CORS for mobile apps');
  console.log('   ✅ Detailed request logging');
  console.log('   ✅ Robust error handling');
  console.log('   ✅ Payment verification');
  console.log('   ✅ Test payment endpoints');
  console.log('');
  console.log('⚠️  Make sure your React Native app uses the correct server URL:');
  console.log(`   http://localhost:${PORT} or your local IP address`);
});

export default app;