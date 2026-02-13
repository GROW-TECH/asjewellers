// server/auth.js
import express from 'express';
import rateLimit from 'express-rate-limit'; // optional but recommended
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Rate limiter (optional) — protect login/register from brute force in dev too
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 requests per windowMs
});
router.use(authLimiter);

// init supabase clients MUST be created by index.js and passed in, but
// we'll lazily create if not provided via req.app.locals (fallback)
function getClients(req) {
  // prefer clients attached by index.js
  const supabaseAdmin = req.app.locals.supabaseAdmin;
  const supabasePublic = req.app.locals.supabasePublic;

  if (supabaseAdmin && supabasePublic) return { supabaseAdmin, supabasePublic };

  // fallback (only if you set environment vars here)
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables are missing.');
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const pub = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return { supabaseAdmin: admin, supabasePublic: pub };
}

/**
 * POST /api/register
 * Body: { fullName, phone, password, referralCode? }
 *
 * Creates a Supabase Auth user (server-side) and inserts a profiles row.
 */
router.post('/register', async (req, res) => {
  try {
    const { fullName, phone, password, referralCode } = req.body;
    if (!fullName || !phone || !password) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const { supabaseAdmin } = getClients(req);

    // sanitize phone (digits only)
    const sanitizedPhone = String(phone).replace(/\D+/g, '');
    if (!sanitizedPhone) return res.status(400).json({ success: false, error: 'Invalid phone' });

    // check duplicate phone in profiles
    const { data: existingProfiles, error: profileCheckErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', sanitizedPhone)
      .limit(1);

    if (profileCheckErr) {
      console.error('Error checking profiles table:', profileCheckErr);
      return res.status(500).json({ success: false, error: 'Database error while checking phone' });
    }
    if (existingProfiles && existingProfiles.length > 0) {
      return res.status(409).json({ success: false, error: 'Phone number already registered' });
    }

    // Create Auth user server-side using phone-as-email pattern
    const emailForAuth = `${sanitizedPhone}@asjewellers.local`;

    const { data: createUserData, error: createUserErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailForAuth,
      password,
      email_confirm: true,
      user_metadata: { phone: sanitizedPhone, fullName }
    });

    if (createUserErr) {
      console.warn('createUserError', createUserErr);
      if (createUserErr?.code === 'email_exists' || createUserErr?.status === 422) {
        return res.status(409).json({ success: false, error: 'User already exists' });
      }
      return res.status(500).json({ success: false, error: createUserErr.message || 'Auth error' });
    }

    // Debug line (remove after verifying)
    console.log('createUserData (raw):', JSON.stringify(createUserData));

    // Extract user id from response shape
    const userId = createUserData?.user?.id ?? createUserData?.id ?? null;
    if (!userId) {
      // Try to find user by email as a last resort
      try {
        const listRes = await supabaseAdmin.auth.admin.listUsers({ search: emailForAuth });
        const usersArr = listRes?.users ?? listRes?.data ?? null;
        if (Array.isArray(usersArr) && usersArr.length > 0) {
          // first match
          userId = usersArr[0].id ?? usersArr[0]?.user?.id ?? null;
        }
      } catch (e) {
        console.warn('listUsers lookup failed:', e);
      }
    }

    if (!userId) {
      console.error('Could not extract userId from createUserData:', createUserData);
      return res.status(500).json({ success: false, error: 'Failed to create user id' });
    }

    // Insert into profiles table linked to auth.users.id
    const { error: insertProfileErr } = await supabaseAdmin.from('profiles').insert([
      {
        id: userId,
        full_name: fullName,
        phone: sanitizedPhone,
        referral_code: referralCode || null
      }
    ]);

    if (insertProfileErr) {
      console.error('Failed to insert profile:', insertProfileErr);
      // cleanup: delete auth user to avoid orphan accounts
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log('Deleted auth user due to profile insert failure:', userId);
      } catch (cleanupErr) {
        console.error('Failed to cleanup created auth user:', cleanupErr);
      }
      return res.status(500).json({ success: false, error: 'Failed to create profile' });
    }

    return res.status(201).json({ success: true, userId });
  } catch (err) {
    console.error('Register route error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /api/login
 * Body: { phone, password }
 *
 * Signs in using the public (anon) client and returns the session & user.
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ success: false, error: 'Missing phone or password' });

    const { supabasePublic } = getClients(req);

    const sanitizedPhone = String(phone).replace(/\D+/g, '');
    if (!sanitizedPhone) return res.status(400).json({ success: false, error: 'Invalid phone' });

    const emailForAuth = `${sanitizedPhone}@asjewellers.local`;

    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email: emailForAuth,
      password,
    });

    if (error) {
      console.warn('Login error:', error);
      if (error?.status === 400 || error?.status === 401) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
      return res.status(500).json({ success: false, error: error.message || 'Auth error' });
    }

    // return session and user (shape may vary by SDK version)
    const session = data?.session ?? data;
    const user = data?.user ?? (data?.session?.user ?? null);

    return res.json({ success: true, session, user });
  } catch (err) {
    console.error('Login route error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
