// server/index.js
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
// ===== PII encryption helpers (paste once near other helpers) =====
import assert from 'assert';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'x-client-info': 'server' } }
});

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// parse json for normal endpoints; webhook will use raw body
app.use(cors({ origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(bodyParser.json({ limit: '200kb' }));



// helper for update wallet

// helper: credit wallet using RPC, fallback to upsert if RPC fails
// Helper: atomic credit wallet via RPC, fallback to fetch->upsert
/**
 * Credit user's wallet safely and idempotently.
 * If payment_id is provided, the function will:
 *  - check payments.wallet_credited and skip if already true
 *  - set payments.wallet_credited = true after a successful credit
 *
 * @param {Object} opts
 * @param {string|number} opts.user_id
 * @param {number} [opts.amount] rupees to add
 * @param {number} [opts.gold_milligrams] mg to add
 * @param {string|number} [opts.payment_id] optional payment id to mark wallet_credited
 */
// server/index.js - replace your existing function with this
async function creditWalletForPayment({ user_id, amount = 0, gold_milligrams = 0 }) {
  if (!user_id) throw new Error('user_id required');

  const rupees = Number(amount || 0);
  const mg = Math.round(Number(gold_milligrams || 0));

  // Try RPC (increment_wallet) first (atomic)
  try {
    const { data, error } = await supabaseAdmin.rpc('increment_wallet', {
      p_user_id: user_id,
      p_add_money: rupees,
      p_add_gold_mg: mg
    });

    if (error) {
      // rpc may return an error object even with 200
      console.warn('increment_wallet rpc returned error', error);
      throw error;
    }

    // rpc should return the updated wallet (adjust if your RPC returns different shape)
    if (data) return data;
    return null;
  } catch (rpcErr) {
    console.warn('RPC increment_wallet failed, falling back to upsert', rpcErr?.message || rpcErr);
  }

  // Fallback: fetch -> compute -> upsert (non-atomic, best-effort)
  try {
    const { data: cur, error: curErr } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    if (curErr) {
      console.error('fallback wallet fetch error', curErr);
      throw curErr;
    }

    const currSaving = Number(cur?.saving_balance ?? 0);
    const currReferral = Number(cur?.referral_balance ?? 0);
    const currTotal = Number(cur?.total_balance ?? 0);
    const currGoldMg = Number(cur?.gold_balance_mg ?? 0);
    const currTotalEarnings = Number(cur?.total_commission ?? 0);
    const currTotalWithdrawn = Number(cur?.total_withdrawn ?? 0);

    // you may want to route different payment types into different balances.
    // Here we add to saving_balance + total_balance + total_commission (as you had before).
    const newSaving = currSaving + rupees;
    const newTotal = currTotal + rupees;
    const newGoldMg = currGoldMg + mg;
    const newTotalEarnings = currTotalEarnings + rupees;

    const payload = {
      user_id,
      saving_balance: newSaving,
      referral_balance: currReferral,
      total_balance: newTotal,
      gold_balance_mg: newGoldMg,
      total_commission: newTotalEarnings,
      total_withdrawn: currTotalWithdrawn,
      updated_at: new Date().toISOString()
    };

    // if no row existed, add created_at
    if (!cur) payload.created_at = new Date().toISOString();

    // upsert with onConflict user_id
    const { data: upserted, error: upErr } = await supabaseAdmin
      .from('wallets')
      .upsert(payload, { onConflict: ['user_id'] })
      .select()
      .maybeSingle();

    if (upErr) {
      console.error('fallback wallet upsert failed', upErr);
      throw upErr;
    }

    return upserted;
  } catch (e) {
    console.error('creditWalletForPayment fallback failed', e);
    // bubble up so caller can decide; or return null
    throw e;
  }
}



// Helper: try compute gold mg from rupees using latest gold_rates entry
async function computeGoldMgFromAmount(amountRupees) {
  try {
    const { data: rateRow, error } = await supabaseAdmin
      .from('gold_rates')
      .select('rate_per_gram, rate_date')
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !rateRow) {
      console.warn('Could not fetch gold rate, skipping gold mg compute', error);
      return 0;
    }
    const ratePerGram = Number(rateRow.rate_per_gram || 0);
    if (!ratePerGram || ratePerGram <= 0) return 0;

    // grams = rupees / ratePerGram ; mg = grams * 1000
    const grams = Number(amountRupees) / ratePerGram;
    const mg = Math.round(grams * 1000);
    return mg;
  } catch (e) {
    console.warn('computeGoldMgFromAmount error', e);
    return 0;
  }
}





// server/index.js (add near other helpers)

async function recordReferralCommissionForPayment({ paymentRow, planRow }) {
  if (!paymentRow || !paymentRow.user_id || !paymentRow.id) {
    console.warn('recordReferralCommissionForPayment: missing paymentRow');
    return { recorded: false, reason: 'missing_payment' };
  }

  try {
    // idempotency: if any commission rows exist for this payment, assume already processed
    const { data: existing = [], error: exErr } = await supabaseAdmin
      .from('referral_commissions')
      .select('id')
      .eq('payment_id', paymentRow.id)
      .limit(1);

    if (exErr) console.warn('Could not check existing referral_commissions', exErr);
    if (Array.isArray(existing) && existing.length > 0) {
      return { recorded: false, reason: 'already_recorded' };
    }

    const baseAmount = Number(paymentRow.amount ?? planRow?.monthly_due ?? 0);
    if (!baseAmount || baseAmount <= 0) {
      return { recorded: false, reason: 'zero_base_amount' };
    }

    // helpers
    const toISODate = (d) => (new Date(d)).toISOString().slice(0, 10);
    const computeScheduledDate = (startIso, monthsToAdd) => {
      try {
        const d = new Date(startIso + 'T00:00:00Z');
        d.setUTCMonth(d.getUTCMonth() + monthsToAdd);
        return d.toISOString().slice(0, 10);
      } catch {
        return null;
      }
    };

    const results = { inserted: [], scheduled: [], skipped: [], errors: [] };

    // normalize commission_monthly array (always length 10)
    const normalizePctArr = (arr, len = 10) => {
      const out = Array.isArray(arr) ? arr.map(v => {
        if (v === null || v === undefined) return 0;
        const s = String(v).replace('%', '').replace(',', '').trim();
        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
      }) : [];
      while (out.length < len) out.push(0);
      return out.slice(0, len);
    };

    const monthlyPctArrFull = normalizePctArr(planRow?.commission_monthly, 10);

    // --- INSTANT COMMISSIONS: only for ONE_TIME plans ---
    if (String(planRow?.payment_type) === 'one_time') {
      const instantArr = normalizePctArr(planRow?.commission_instant, 10);

      for (let level = 1; level <= 10; level++) {
        try {
          const pct = Number(instantArr[level - 1] ?? 0);
          if (!pct || pct <= 0) {
            results.skipped.push({ type: 'instant', level, reason: 'zero_percentage' });
            continue;
          }

          // find referrer at this level
          const { data: rtRow, error: rtErr } = await supabaseAdmin
            .from('referral_tree')
            .select('user_id')
            .eq('referred_user_id', paymentRow.user_id)
            .eq('level', level)
            .limit(1)
            .maybeSingle();

          if (rtErr) {
            results.errors.push({ type: 'instant', level, step: 'fetch_referrer', error: rtErr });
            continue;
          }
          const referrerId = rtRow?.user_id ?? null;
          if (!referrerId) {
            results.skipped.push({ type: 'instant', level, reason: 'no_referrer' });
            continue;
          }

          // compute amount (in rupees, rounded)
          const amount = Math.round((baseAmount * pct) / 100);
          if (!amount || amount <= 0) {
            results.skipped.push({ type: 'instant', level, referrerId, reason: 'computed_zero' });
            continue;
          }

          const commRow = {
            user_id: referrerId,
            from_user_id: paymentRow.user_id,
            level,
            percentage: pct,
            amount,
            payment_id: paymentRow.id,
            scheduled: false,
            status: 'completed',
            created_at: new Date().toISOString()
          };

          const { data: inserted, error: insErr } = await supabaseAdmin
            .from('referral_commissions')
            .insert(commRow)
            .select()
            .single();

          if (insErr) {
            results.errors.push({ type: 'instant', level, step: 'insert_commission', error: insErr });
            continue;
          }

          // credit wallet (best-effort)
          try {
            const { data: existingWallet } = await supabaseAdmin
              .from('wallets').select('*').eq('user_id', referrerId).maybeSingle();

            const currReferral = Number(existingWallet?.referral_balance ?? 0);
            const currTotal = Number(existingWallet?.total_balance ?? 0);
            const currEarnings = Number(existingWallet?.total_commission ?? 0);

            const updatedWallet = {
              user_id: referrerId,
              referral_balance: currReferral + amount,
              total_balance: currTotal + amount,
              total_commission: currEarnings + amount,
              updated_at: new Date().toISOString()
            };
            if (!existingWallet) updatedWallet.created_at = new Date().toISOString();

            const { data: upserted, error: upErr } = await supabaseAdmin
              .from('wallets').upsert(updatedWallet, { onConflict: ['user_id'] }).select().maybeSingle();

            if (upErr) {
              results.errors.push({ type: 'instant', level, step: 'wallet_upsert', error: upErr });
              results.inserted.push({ level, commission: inserted, wallet: null });
            } else {
              results.inserted.push({ level, commission: inserted, wallet: upserted });
            }
          } catch (we) {
            results.errors.push({ type: 'instant', level, step: 'wallet_trycatch', error: we });
            results.inserted.push({ level, commission: inserted, wallet: null });
          }
        } catch (outer) {
          results.errors.push({ type: 'instant', level, step: 'outer', error: outer });
        }
      } // end instant loop
    } // end instant only for one_time

    // --- SCHEDULE MONTHLY COMMISSIONS for ONE_TIME plans (top 5 for 24 months) ---
    if (String(planRow?.payment_type) === 'one_time') {
      const monthlyPctArrTop5 = monthlyPctArrFull.slice(0, 5);
      const paymentDateIso = (paymentRow.payment_date || new Date().toISOString()).slice(0, 10);
      const monthsToSchedule = 24;

      for (let level = 1; level <= 5; level++) {
        const pct = Number(monthlyPctArrTop5[level - 1] ?? 0);
        if (!pct || pct <= 0) continue;

        const { data: rtRow, error: rtErr } = await supabaseAdmin
          .from('referral_tree')
          .select('user_id')
          .eq('referred_user_id', paymentRow.user_id)
          .eq('level', level)
          .limit(1)
          .maybeSingle();
        if (rtErr || !rtRow?.user_id) {
          results.skipped.push({ type: 'schedule', level, reason: 'no_referrer_or_error', error: rtErr });
          continue;
        }

        const referrerId = rtRow.user_id;
        for (let m = 1; m <= monthsToSchedule; m++) {
          const scheduledDate = computeScheduledDate(paymentDateIso, m - 1);
          const amount = Math.round((baseAmount * pct) / 100);
          if (!amount || amount <= 0) continue;

          // idempotency: avoid duplicate scheduled row
          const { data: dup = [] } = await supabaseAdmin
            .from('scheduled_commissions')
            .select('id')
            .eq('user_id', referrerId)
            .eq('from_user_id', paymentRow.user_id)
            .eq('level', level)
            .eq('scheduled_month', m)
            .eq('scheduled_for', scheduledDate)
            .limit(1);

          if (Array.isArray(dup) && dup.length > 0) continue;

          const schedRow = {
            user_id: referrerId,
            from_user_id: paymentRow.user_id,
            plan_id: paymentRow.plan_id ?? planRow?.id ?? null,
            level,
            percentage: pct,
            amount,
            scheduled_month: m,
            scheduled_for: scheduledDate,
            status: 'pending',
            attempts: 0,
            created_at: new Date().toISOString()
          };

          try {
            await supabaseAdmin.from('scheduled_commissions').insert(schedRow);
            results.scheduled.push({ level, month: m, referrerId, scheduled_for: scheduledDate });
          } catch (scErr) {
            results.errors.push({ type: 'schedule', level, month: m, error: scErr });
          }
        }
      }
    } // end one_time scheduling

    // --- RECURRING PLANS: immediate monthly commissions (levels 1..10) for months 1..11 ---
    if (String(planRow?.payment_type) !== 'one_time') {
      const monthNumber = Number(paymentRow.month_number ?? 1);
      if (monthNumber <= 0) {
        results.skipped.push({ type: 'recurring', reason: 'invalid_month_number', monthNumber });
      } else if (monthNumber > 11) {
        results.skipped.push({ type: 'recurring', reason: 'beyond_commission_months', monthNumber });
      } else {
        for (let level = 1; level <= 10; level++) {
          try {
            const pct = Number(monthlyPctArrFull[level - 1] ?? 0);
            if (!pct || pct <= 0) {
              results.skipped.push({ type: 'recurring', level, monthNumber, reason: 'zero_percentage' });
              continue;
            }

            const { data: rtRow, error: rtErr } = await supabaseAdmin
              .from('referral_tree')
              .select('user_id')
              .eq('referred_user_id', paymentRow.user_id)
              .eq('level', level)
              .limit(1)
              .maybeSingle();

            if (rtErr) {
              results.errors.push({ type: 'recurring', level, step: 'fetch_referrer', error: rtErr });
              continue;
            }
            const referrerId = rtRow?.user_id ?? null;
            if (!referrerId) {
              results.skipped.push({ type: 'recurring', level, monthNumber, reason: 'no_referrer' });
              continue;
            }

            const amount = Math.round((baseAmount * pct) / 100);
            if (!amount || amount <= 0) {
              results.skipped.push({ type: 'recurring', level, monthNumber, reason: 'computed_zero' });
              continue;
            }

            const commRow = {
              user_id: referrerId,
              from_user_id: paymentRow.user_id,
              level,
              percentage: pct,
              amount,
              payment_id: paymentRow.id,
              subscription_id: paymentRow.subscription_id ?? null,
              scheduled: false,
              status: 'completed',
              month_number: monthNumber,
              created_at: new Date().toISOString()
            };

            const { data: inserted, error: insErr } = await supabaseAdmin
              .from('referral_commissions')
              .insert(commRow)
              .select()
              .single();

            if (insErr) {
              results.errors.push({ type: 'recurring', level, monthNumber, step: 'insert_commission', error: insErr });
              continue;
            }

            // credit wallet
            try {
              const { data: existingWallet } = await supabaseAdmin
                .from('wallets').select('*').eq('user_id', referrerId).maybeSingle();

              const currReferral = Number(existingWallet?.referral_balance ?? 0);
              const currTotal = Number(existingWallet?.total_balance ?? 0);
              const currEarnings = Number(existingWallet?.total_commission ?? 0);

              const updatedWallet = {
                user_id: referrerId,
                referral_balance: currReferral + amount,
                total_balance: currTotal + amount,
                total_commission: currEarnings + amount,
                updated_at: new Date().toISOString()
              };
              if (!existingWallet) updatedWallet.created_at = new Date().toISOString();

              const { data: upserted, error: upErr } = await supabaseAdmin
                .from('wallets').upsert(updatedWallet, { onConflict: ['user_id'] }).select().maybeSingle();

              if (upErr) {
                results.errors.push({ type: 'recurring', level, monthNumber, step: 'wallet_upsert', error: upErr });
                results.inserted.push({ type: 'recurring', level, monthNumber, commission: inserted, wallet: null });
              } else {
                results.inserted.push({ type: 'recurring', level, monthNumber, commission: inserted, wallet: upserted });
              }
            } catch (we) {
              results.errors.push({ type: 'recurring', level, monthNumber, step: 'wallet_trycatch', error: we });
              results.inserted.push({ type: 'recurring', level, monthNumber, commission: inserted, wallet: null });
            }
          } catch (lvlEx) {
            results.errors.push({ type: 'recurring', level, monthNumber, step: 'outer', error: lvlEx });
          }
        } // end recurring levels loop
      }
    } // end recurring handling

    return { recorded: true, details: results };
  } catch (err) {
    console.error('recordReferralCommissionForPayment unexpected', err);
    return { recorded: false, reason: 'unexpected', error: err };
  }
}



app.post('/test/commission', async (req, res) => {
  try {
    const { paymentRow, planRow } = req.body;

    const result = await recordReferralCommissionForPayment({
      paymentRow,
      planRow
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Health
app.get('/health', (_req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// Session check
app.get('/api/session', async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(400).json({ error: 'No session token provided' });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error) {
      console.error('Error fetching session:', error);
      return res.status(400).json({ error: 'Session not found' });
    }
    res.json({ user: data.user });
  } catch (err) {
    console.error('Session check error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Helper: compute end_date from start_date + months (YYYY-MM-DD)
 */
function computeEndDateFromMonths(startIso, months) {
  try {
    const d = new Date(startIso + 'T00:00:00Z');
    d.setMonth(d.getMonth() + Number(months || 0));
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function makeReceipt(prefix = 'r', maxLen = 40) {
  const suffix = crypto.randomBytes(6).toString('hex');
  const cleanPrefix = String(prefix || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, Math.max(1, maxLen - suffix.length - 1));
  return `${cleanPrefix}_${suffix}`.slice(0, maxLen);
}

async function createRazorpayOrderWithReceipt(amountPaise, initialPrefix) {
  const initialReceipt = makeReceipt(initialPrefix, 40);
  try {
    return await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: initialReceipt,
      payment_capture: 1
    });
  } catch (err) {
    const desc = err?.error?.description || err?.error?.reason || err?.message || '';
    if (String(desc).toLowerCase().includes('receipt') || String(desc).toLowerCase().includes('length') || (err?.error?.code === 'BAD_REQUEST_ERROR')) {
      const fallbackPrefix = String(initialPrefix).slice(0, 8) || 'r';
      const fallbackReceipt = makeReceipt(fallbackPrefix, 40);
      return await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: fallbackReceipt,
        payment_capture: 1
      });
    }
    throw err;
  }
}

// helper: compute current plan month index (1-based) from start ISO (YYYY-MM-DD)
function computeCurrentPlanMonthIndex(startIso) {
  if (!startIso) return null;
  const start = new Date(startIso + 'T00:00:00Z');
  const now = new Date();
  const months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth()) + 1;
  return months;
}


const PII_MASK_SECRET = process.env.PII_MASK_SECRET || null;

// simple validators
function isAadhaar(s) {
  return typeof s === 'string' && /^\d{12}$/.test(s.trim());
}
function isPan(s) {
  return typeof s === 'string' && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test((s || '').toUpperCase().trim());
}

/**
 * Encrypt text using AES-256-GCM. Returns a compact hex string: iv:authTag:cipherHex
 * Requires PII_MASK_SECRET to be at least 32 bytes when Buffer.from(..., 'utf8').
 */
function encryptPII(plain) {
  if (!PII_MASK_SECRET) {
    // no secret configured -> not encrypting (NOT recommended in production)
    return plain;
  }
  try {
    const key = crypto.createHash('sha256').update(String(PII_MASK_SECRET)).digest(); // 32 bytes
    const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plain)), cipher.final()]);
    const tag = cipher.getAuthTag();
    // encode as hex: iv:tag:cipher
    return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
  } catch (e) {
    console.warn('encryptPII failed, storing raw value (not recommended):', e?.message || e);
    return plain;
  }
}

/**
 * Optionally: mask plain value for showing / logging (not reversible).
 * Aadhaar -> show last 4 digits; PAN -> show first 3 + last 2 pattern etc.
 */
function maskAadhaar(aadhaar) {
  if (!aadhaar) return null;
  const s = String(aadhaar).trim();
  if (!/^\d{12}$/.test(s)) return null;
  return `XXXX-XXXX-${s.slice(-4)}`;
}
function maskPan(pan) {
  if (!pan) return null;
  const s = String(pan).trim();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(s.toUpperCase())) return null;
  return `${s.slice(0,2)}XXX${s.slice(-2)}`.toUpperCase();
}


// ===== POST /api/register (idempotent profile creation) =====
// Body:
// {
//   user_id, full_name, phone, email (optional), referral_code (optional), referred_by (optional), aadhaar (optional), pan (optional)
// }
app.post('/api/register', async (req, res) => {
  try {
    const body = req.body ?? {};
    const {
      user_id,
      full_name,
      phone,
      email,
      referral_code,
      referred_by,
      aadhaar,
      pan
    } = body;

    if (!user_id || !full_name || !phone) {
      return res.status(400).json({ success: false, message: 'Missing required fields: user_id, full_name, phone' });
    }

    // Basic normalization
    const normalizedPhone = String(phone).replace(/[^0-9]/g, '').slice(0, 15);
    const normalizedEmail = email ? String(email).toLowerCase().trim() : `${normalizedPhone}@asjewellers.app`;

    // Validate PII formats if provided
    if (aadhaar && !isAadhaar(String(aadhaar))) {
      return res.status(400).json({ success: false, message: 'Invalid Aadhaar format (should be 12 digits)' });
    }
    if (pan && !isPan(String(pan).toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid PAN format (should match ABCDE1234F)' });
    }

    // Encrypt Aadhaar/PAN if secret configured; otherwise store raw (warn)
    let storedAadhaar = null;
    let storedPan = null;
    let maskedAadhaar = null;
    let maskedPan = null;

    if (aadhaar) {
      storedAadhaar = encryptPII(String(aadhaar).trim());
      maskedAadhaar = maskAadhaar(String(aadhaar).trim());
    }
    if (pan) {
      storedPan = encryptPII(String(pan).toUpperCase().trim());
      maskedPan = maskPan(String(pan).toUpperCase().trim());
    }

    // Build payload for insert/upsert
    const payload = {
      id: user_id,
      full_name: String(full_name).trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      referral_code: referral_code || null,
      referred_by: referred_by || null,
      created_at: new Date().toISOString()
    };

    // store encrypted values under 'aadhaar'/'pan' columns so your frontend queries remain same.
    if (storedAadhaar) payload.aadhaar = storedAadhaar;
    if (storedPan) payload.pan = storedPan;

    // Optionally store masked fields if you want to show them later without decrypting.
    // This assumes you added masked_aadhaar and masked_pan columns (optional). If you haven't, skip setting these.
    if (maskedAadhaar) payload.masked_aadhaar = maskedAadhaar;
    if (maskedPan) payload.masked_pan = maskedPan;

    // Idempotent insert: only create if not exists. We'll attempt insert and if unique violation occurs, return existing.
    // Check existing profile
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('user_profile')
      .select('*')
      .eq('id', user_id)
      .maybeSingle();

    if (existingErr) {
      console.warn('register: existing profile lookup error', existingErr);
      // continue to attempt insert (but inform)
    }
    if (existing && Object.keys(existing).length > 0) {
      // Profile already exists -> return it (do not overwrite)
      return res.json({ success: true, existed: true, profile: existing });
    }

    // Insert new profile
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('user_profile')
      .insert(payload)
      .select()
      .maybeSingle();

    if (insertErr) {
      console.error('register: insertErr', insertErr);

      // Friendly mapping for common DB constraint errors
      const msg = (insertErr?.message || '').toLowerCase();
      if (msg.includes('unique') && msg.includes('referral_code')) {
        return res.status(400).json({ success: false, message: 'Referral code already in use' });
      }
      if (msg.includes('unique') && msg.includes('aadhaar')) {
        return res.status(400).json({ success: false, message: 'Aadhaar already exists' });
      }
      if (msg.includes('unique') && msg.includes('pan')) {
        return res.status(400).json({ success: false, message: 'PAN already exists' });
      }

      return res.status(500).json({ success: false, message: 'Failed to insert profile', details: insertErr.message });
    }

    // create wallet row (best-effort)
    try {
      await supabaseAdmin.from('wallets').insert({
        user_id,
        total_balance: 0,
        saving_balance: 0,
        referral_balance: 0,
        total_commission: 0,
        total_withdrawn: 0,
        gold_balance_mg: 0,
        created_at: new Date().toISOString()
      }).select().maybeSingle();
    } catch (wErr) {
      console.warn('register: create-wallet best-effort failed', wErr?.message || wErr);
    }

    // trigger referral tree build async (fire-and-forget)
    if (payload.referred_by) {
      // call local endpoint (same server) to build tree; non-blocking
      fetch(`http://localhost:${PORT}/api/build-referral-tree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id })
      }).catch(e => console.warn('register: build-referral-tree trigger failed', e?.message || e));
    }

    return res.json({ success: true, existed: false, profile: inserted });
  } catch (err) {
    console.error('POST /api/register unexpected', err);
    return res.status(500).json({ success: false, message: 'Server error', details: String(err) });
  }
});

/**
 * POST /create-subscription
 * Creates razorpay order and provisional payment row (status = 'initiated').
 * Accepts either a subscription_id (attach) or user_id+plan_id to create/attach.
 */
app.post('/create-subscription', async (req, res) => {
  try {
    const body = req.body ?? {};
    let user_id = body.user_id;
    let plan_id = body.plan_id;
    let start_date = body.start_date;
    let end_date = body.end_date;
    const attachToSubscriptionId = body.subscription_id ?? null;
    const month_number = Number(body.month_number ?? 1);

    // If subscription_id provided, resolve user_id/plan_id and set start/end from subscription
    let resolvedSubscriptionRow = null;
    if (attachToSubscriptionId) {
      const { data: existingSub, error: subErr } = await supabaseAdmin
        .from('user_subscriptions')
        .select('id, user_id, plan_id, start_date, end_date, status')
        .eq('id', attachToSubscriptionId)
        .maybeSingle();

      if (subErr) {
        console.error('Failed to fetch subscription for provided subscription_id', subErr);
        return res.status(500).json({ success: false, message: 'Failed to resolve subscription' });
      }
      if (!existingSub) {
        console.warn('subscription_id not found:', attachToSubscriptionId);
        return res.status(404).json({ success: false, message: 'Subscription not found' });
      }

      resolvedSubscriptionRow = existingSub;
      user_id = existingSub.user_id;
      plan_id = existingSub.plan_id;
      start_date = start_date || existingSub.start_date || new Date().toISOString().slice(0, 10);
      end_date = end_date || existingSub.end_date || null;
    }

    // Validate required final fields
    if (!user_id || !plan_id || !start_date) {
      return res.status(400).json({ success: false, message: 'Missing required fields: user_id, plan_id, start_date' });
    }

    // Load plan (select * to avoid selecting a non-existent optional column)
    const { data: planData, error: planErr } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .maybeSingle();

    if (planErr) {
      console.error('Plan fetch error', planErr);
      return res.status(500).json({ success: false, message: 'Plan lookup failed' });
    }
    if (!planData) {
      console.warn('Plan not found for id', plan_id);
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const monthlyDue = Number(planData.monthly_due || 0);
    if (monthlyDue <= 0) return res.status(400).json({ success: false, message: 'Invalid monthly_due' });

    const restrictOnePerMonth = Boolean(planData.restrict_one_per_month);

    // If this request attaches to an existing subscription, enforce month checks
    if (resolvedSubscriptionRow && restrictOnePerMonth) {
      const startIso = resolvedSubscriptionRow.start_date;
      const currentIndex = computeCurrentPlanMonthIndex(startIso);

      if (currentIndex === null) {
        console.warn('Could not compute currentIndex for subscription', resolvedSubscriptionRow.id);
        return res.status(400).json({ success: false, message: 'Invalid subscription dates' });
      }

      // 1) disallow paying for any month other than currentIndex
      if (Number(month_number) !== Number(currentIndex)) {
        return res.status(400).json({
          success: false,
          message: `Payment allowed only for current month (month ${currentIndex}). Requested month ${month_number} not allowed.`
        });
      }

      // 2) ensure month not already paid (only consider completed payments)
      const { data: existingPayments, error: paidErr } = await supabaseAdmin
        .from('payments')
        .select('id, status')
        .eq('subscription_id', resolvedSubscriptionRow.id)
        .eq('month_number', Number(month_number))
        .in('status', ['completed'])
        .limit(1);

      if (paidErr) {
        console.error('Error checking existing payments for subscription/month', paidErr);
        return res.status(500).json({ success: false, message: 'Failed to validate payment state' });
      }

      if (Array.isArray(existingPayments) && existingPayments.length > 0) {
        return res.status(400).json({ success: false, message: 'Month already paid' });
      }
    }

    // Defensive check for existing subscription (when creating a new subscription)
    let existingSub = null;
    if (!attachToSubscriptionId) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const { data: existingSubs, error: existingErr } = await supabaseAdmin
        .from('user_subscriptions')
        .select('id, status, start_date, end_date')
        .eq('user_id', user_id)
        .eq('plan_id', plan_id)
        .in('status', ['pending', 'active'])
        .or(`end_date.is.null,end_date.gte.${todayIso}`)
        .limit(1);

      if (existingErr) {
        console.error('Error checking existing subscriptions', existingErr);
        return res.status(500).json({ success: false, message: 'Validation failed' });
      }
      existingSub = Array.isArray(existingSubs) && existingSubs.length > 0 ? existingSubs[0] : null;
    } else {
      existingSub = resolvedSubscriptionRow ? { id: resolvedSubscriptionRow.id } : null;
    }

    // Create razorpay order (safe receipt generation)
    const amountPaise = Math.round(monthlyDue * 100);
    const receiptPrefix = existingSub && existingSub.id
      ? `initpay_att_sub_${existingSub.id}`
      : `initpay_${user_id}_${plan_id}`;

    const order = await createRazorpayOrderWithReceipt(amountPaise, receiptPrefix);

    // Insert provisional payment row
    const paymentPayload = {
      user_id,
      subscription_id: existingSub && existingSub.id ? existingSub.id : null,
      plan_id,
      amount: monthlyDue,
      payment_type: existingSub && existingSub.id ? 'subscription_additional' : 'subscription_initial',
      month_number: Number(month_number || 1),
      status: 'initiated',
      payment_date: new Date().toISOString(),
      expires_at: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
      razorpay_order_id: order.id
    };

    const { data: paymentData, error: paymentErr } = await supabaseAdmin
      .from('payments')
      .insert([paymentPayload])
      .select('id')
      .limit(1);

    if (paymentErr) {
      console.error('Failed to create provisional payment row', paymentErr);
      try { await razorpay.orders.fetch(order.id); } catch (e) { /* ignore */ }
      return res.status(500).json({ success: false, message: 'Failed to create payment record' });
    }

    const paymentId = Array.isArray(paymentData) && paymentData.length > 0 ? paymentData[0].id : paymentData?.id ?? null;
    if (!paymentId) {
      console.error('No payment id returned', paymentData);
      return res.status(500).json({ success: false, message: 'Payment creation failed' });
    }

    return res.json({
      success: true,
      payment_id: paymentId,
      order: { order_id: order.id, amount: order.amount, currency: order.currency, key_id: RAZORPAY_KEY_ID },
      attached_to_subscription: Boolean(existingSub && existingSub.id),
      subscription_id: existingSub && existingSub.id ? existingSub.id : null
    });
  } catch (err) {
    console.error('create-subscription error', err);
    return res.status(500).json({ success: false, message: 'Server error', details: String(err) });
  }
});

/**
 * POST /verify-payment
 * Verifies signature, checks razorpay payment status & amount, then creates user_subscriptions
 * and updates the payments row to status 'completed'.
 */
/**
 * POST /verify-payment
 * Verifies signature, validates payment with Razorpay, marks payment completed,
 * attaches to existing subscription OR creates subscription, credits wallet,
 * and records referral commission (idempotent).
 */
app.post('/verify-payment', async (req, res) => {
  try {
    const { payment_id, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body ?? {};
    if (!payment_id || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // verify signature (HMAC)
    const generatedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.warn('Signature mismatch', { generatedSignature, razorpay_signature });
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // fetch provisional payment row
    const { data: paymentRow, error: payErr } = await supabaseAdmin
      .from('payments').select('*').eq('id', payment_id).limit(1).maybeSingle();

    if (payErr) {
      console.error('Error fetching payment record', payErr);
      return res.status(500).json({ success: false, message: 'Payment record lookup failed' });
    }
    if (!paymentRow) return res.status(404).json({ success: false, message: 'Payment record not found' });

    // defensive check: razorpay_order_id should match stored order (if stored)
    if (paymentRow.razorpay_order_id && paymentRow.razorpay_order_id !== razorpay_order_id) {
      console.warn('Order id mismatch', { expected: paymentRow.razorpay_order_id, got: razorpay_order_id });
      return res.status(400).json({ success: false, message: 'Order id does not match payment record' });
    }

    // idempotent: already completed?
    if (paymentRow.status === 'completed') {
      // If already completed and attached to a subscription, return success.
      if (paymentRow.subscription_id) {
        return res.json({ success: true, message: 'Payment already processed', subscription_id: paymentRow.subscription_id });
      }

      // If completed but not attached, try to attach defensively to an existing subscription (user+plan)
      try {
        const todayIso = new Date().toISOString().slice(0, 10);
        const { data: existing, error: existingErr } = await supabaseAdmin
          .from('user_subscriptions')
          .select('id')
          .eq('user_id', paymentRow.user_id)
          .eq('plan_id', paymentRow.plan_id)
          .in('status', ['pending', 'active'])
          .or(`end_date.is.null,end_date.gte.${todayIso}`)
          .limit(1);

        if (existingErr) {
          console.error('Error checking existing subscriptions for completed-but-unattached payment', existingErr);
          return res.json({ success: true, message: 'Payment already completed', subscription_id: null, warning: 'subscription_lookup_failed' });
        }

        if (Array.isArray(existing) && existing.length > 0) {
          const existingSubId = existing[0].id;
          await supabaseAdmin.from('payments').update({
            subscription_id: existingSubId,
            updated_at: new Date().toISOString()
          }).eq('id', paymentRow.id);

          // ensure gold_milligrams persisted if missing
          let goldMg = Number(paymentRow.gold_milligrams ?? 0);
          if (!goldMg) {
            goldMg = await computeGoldMgFromAmount(Number(paymentRow.amount ?? 0));
            if (goldMg > 0) await supabaseAdmin.from('payments').update({ gold_milligrams: goldMg }).eq('id', paymentRow.id);
          }

          return res.json({ success: true, message: 'Payment already completed and attached', subscription_id: existingSubId });
        }

        // No existing subscription found. Persist gold_milligrams (if missing) and return
        let goldMgFinal = Number(paymentRow.gold_milligrams ?? 0);
        if (!goldMgFinal) {
          goldMgFinal = await computeGoldMgFromAmount(Number(paymentRow.amount ?? 0));
          if (goldMgFinal > 0) {
            await supabaseAdmin.from('payments').update({ gold_milligrams: goldMgFinal }).eq('id', paymentRow.id);
          }
        }

        return res.json({ success: true, message: 'Payment already completed but not attached to subscription', subscription_id: null, warning: 'no_subscription_attached' });
      } catch (e) {
        console.error('Error handling completed-but-unattached payment', e);
        return res.json({ success: true, message: 'Payment already completed', subscription_id: null, warning: 'unhandled_error' });
      }
    }

    // fetch payment from Razorpay to validate status & amount
    let paymentObj = null;
    try {
      paymentObj = await razorpay.payments.fetch(razorpay_payment_id);
      if (paymentObj?.status && paymentObj.status !== 'captured') {
        console.warn('Payment status not captured', paymentObj.status);
        return res.status(400).json({ success: false, message: `Payment not captured: ${paymentObj.status}` });
      }
      // amount check (paymentObj.amount is paise)
      const expectedPaise = Math.round((paymentRow.amount || 0) * 100);
      if (paymentObj.amount && Number(paymentObj.amount) !== expectedPaise) {
        console.warn('Amount mismatch', { expectedPaise, got: paymentObj.amount });
        return res.status(400).json({ success: false, message: 'Payment amount mismatch' });
      }
    } catch (e) {
      console.warn('Could not fetch payment from razorpay', e);
      return res.status(500).json({ success: false, message: 'Could not validate payment with gateway' });
    }

    // --- If this payment should attach to an existing subscription (monthly) ---
    const todayIso = new Date().toISOString().slice(0, 10);
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', paymentRow.user_id)
      .eq('plan_id', paymentRow.plan_id)
      .in('status', ['pending', 'active'])
      .or(`end_date.is.null,end_date.gte.${todayIso}`)
      .limit(1);

    if (existingErr) {
      console.error('Error checking existing subscriptions during verify', existingErr);
      return res.status(500).json({ success: false, message: 'Validation failed' });
    }

    // accumulate warnings to return
    let responseWarnings = [];

    if (Array.isArray(existing) && existing.length > 0) {
      const existingSubId = existing[0].id;

      // mark payment completed & attach to existing subscription
      const { error: attachErr } = await supabaseAdmin.from('payments').update({
        status: 'completed',
        razorpay_payment_id,
        razorpay_order_id,
        subscription_id: existingSubId,
        updated_at: new Date().toISOString()
      }).eq('id', paymentRow.id);

      if (attachErr) {
        console.error('Failed to attach payment to existing subscription', attachErr);
        return res.status(500).json({ success: false, message: 'Failed to update payment record' });
      }

      // compute gold_milligrams if missing
      let goldMg = Number(paymentRow.gold_milligrams ?? 0);
      if (!goldMg) {
        goldMg = await computeGoldMgFromAmount(Number(paymentRow.amount ?? 0));
        if (goldMg > 0) {
          await supabaseAdmin.from('payments').update({ gold_milligrams: goldMg }).eq('id', paymentRow.id);
        }
      }

      // credit wallet (monthly payment -> only wallet change)
      try {
        await creditWalletForPayment({
          user_id: paymentRow.user_id,
          amount: Number(paymentRow.amount ?? 0),
          gold_milligrams: goldMg
        });
      } catch (wErr) {
        console.error('Wallet credit failed for monthly payment', wErr);
        responseWarnings.push('wallet_failed');
      }

      // record referral commission for this monthly payment (idempotent inside the function)
      try {
        const { data: planRow } = await supabaseAdmin.from('plans').select('*').eq('id', paymentRow.plan_id).maybeSingle();
        await recordReferralCommissionForPayment({ paymentRow, planRow });
      } catch (e) {
        console.warn('Failed to record referral commission (verify-payment attach)', e);
        // do not fail overall flow for commission recording issues
      }

      return res.json({ success: true, message: 'Payment recorded and attached to existing subscription', subscription_id: existingSubId, warnings: responseWarnings });
    }

    // --- Otherwise: create subscription (first-time) ---
    const { data: planInfo } = await supabaseAdmin.from('plans').select('total_months').eq('id', paymentRow.plan_id).maybeSingle();
    const endDateCalculated = planInfo?.total_months ? computeEndDateFromMonths((paymentRow.payment_date || new Date()).slice(0, 10), planInfo.total_months) : null;

    const insertPayload = {
      user_id: paymentRow.user_id,
      plan_id: paymentRow.plan_id,
      start_date: paymentRow.payment_date ? (new Date(paymentRow.payment_date)).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      end_date: endDateCalculated || null,
      status: 'active',
      total_paid: (paymentObj.amount / 100),
      bonus_amount: 0,
      final_amount: (paymentObj.amount / 100),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertData, error: insertErr } = await supabaseAdmin
      .from('user_subscriptions')
      .insert([insertPayload])
      .select('id')
      .limit(1);

    if (insertErr) {
      console.error('Subscription insert error during verify', insertErr);
      const detail = (insertErr?.message ?? '').toLowerCase();
      if (detail.includes('unique')) {
        // someone else created it in the meantime — attach to existing
        const { data: existing2 } = await supabaseAdmin
          .from('user_subscriptions')
          .select('id')
          .eq('user_id', paymentRow.user_id)
          .eq('plan_id', paymentRow.plan_id)
          .in('status', ['pending', 'active'])
          .limit(1);
        const existingSubId = existing2?.[0]?.id;
        if (existingSubId) {
          await supabaseAdmin.from('payments').update({
            status: 'completed',
            razorpay_payment_id,
            razorpay_order_id,
            subscription_id: existingSubId,
            updated_at: new Date().toISOString()
          }).eq('id', paymentRow.id);

          // credit wallet (use compute if necessary)
          let goldMg2 = Number(paymentRow.gold_milligrams ?? 0);
          if (!goldMg2) {
            goldMg2 = await computeGoldMgFromAmount(Number(paymentRow.amount ?? 0));
            if (goldMg2 > 0) await supabaseAdmin.from('payments').update({ gold_milligrams: goldMg2 }).eq('id', paymentRow.id);
          }
          try {
            await creditWalletForPayment({ user_id: paymentRow.user_id, amount: Number(paymentRow.amount ?? 0), gold_milligrams: goldMg2 });
          } catch (we) {
            console.error('Wallet credit failed after attach', we);
            responseWarnings.push('wallet_failed');
          }

          // record referral commission for this payment
          try {
            const { data: planRow } = await supabaseAdmin.from('plans').select('*').eq('id', paymentRow.plan_id).maybeSingle();
            await recordReferralCommissionForPayment({ paymentRow, planRow });
          } catch (e) {
            console.warn('Failed to record referral commission (verify-payment attach-fallback)', e);
          }

          return res.json({ success: true, message: 'Payment recorded and attached to existing subscription', subscription_id: existingSubId, warnings: responseWarnings });
        }
      }
      return res.status(500).json({ success: false, message: 'Failed to create subscription', details: insertErr.message });
    }

    const subscriptionId = Array.isArray(insertData) && insertData.length > 0 ? insertData[0].id : insertData?.id ?? null;
    if (!subscriptionId) {
      console.error('No subscription id after insert', insertData);
      return res.status(500).json({ success: false, message: 'Subscription creation returned no id' });
    }

    // 3) update payments row to completed & attach
    const { error: payUpdateErr } = await supabaseAdmin.from('payments').update({
      status: 'completed',
      razorpay_payment_id,
      razorpay_order_id,
      subscription_id: subscriptionId,
      updated_at: new Date().toISOString()
    }).eq('id', paymentRow.id);

    if (payUpdateErr) {
      console.error('Failed to update payment after subscription insert', payUpdateErr);
      return res.json({ success: true, subscription_id: subscriptionId, warning: 'Subscription created but failed to update payment record' });
    }

    // compute gold_milligrams if missing and persist
    let goldMgFinal = Number(paymentRow.gold_milligrams ?? 0);
    if (!goldMgFinal) {
      goldMgFinal = await computeGoldMgFromAmount(Number(paymentRow.amount ?? 0));
      if (goldMgFinal > 0) {
        await supabaseAdmin.from('payments').update({ gold_milligrams: goldMgFinal }).eq('id', paymentRow.id);
      }
    }

    // credit the wallet (first-time subscription should also add to wallet)
    try {
      await creditWalletForPayment({
        user_id: paymentRow.user_id,
        amount: Number(paymentRow.amount ?? 0),
        gold_milligrams: goldMgFinal
      });
    } catch (walletErr) {
      console.error('Failed to update wallet after verification', walletErr);
      responseWarnings.push('wallet_failed');
    }

    // record referral commission for first-time subscription (one-time commission)
    try {
      const { data: planRow } = await supabaseAdmin.from('plans').select('*').eq('id', paymentRow.plan_id).maybeSingle();
      await recordReferralCommissionForPayment({ paymentRow, planRow });
    } catch (e) {
      console.warn('Failed to record referral commission (verify-payment create-sub)', e);
      // don't fail subscription on commission issues
    }

    return res.json({ success: true, message: 'Payment verified, subscription activated', subscription_id: subscriptionId, warnings: responseWarnings });
  } catch (err) {
    console.error('verify-payment error', err);
    return res.status(500).json({ success: false, message: 'Server error', details: String(err) });
  }
});




/**
 * POST /webhook/razorpay
 * Raw body required to verify signature. Runs the same finalize flow server-side when a payment is captured.
 */
app.post('/webhook/razorpay', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body; // Buffer
  if (!signature || !RAZORPAY_WEBHOOK_SECRET) {
    console.warn('Webhook missing signature or secret');
    return res.status(400).send('missing signature or webhook secret');
  }

  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
  if (expected !== signature) {
    console.warn('Webhook signature mismatch');
    return res.status(401).send('invalid signature');
  }

  try {
    const payload = JSON.parse(body.toString('utf8'));
    const event = payload.event;
    const entity = payload.payload?.payment?.entity ?? payload.payload?.order?.entity;

    // We're interested in payment.captured or order.paid
    if (event === 'payment.captured' && entity) {
      const razorpay_payment_id = entity.id;
      const razorpay_order_id = entity.order_id;
      const amountPaise = entity.amount; // paise

      // Find payment row by order_id
      const { data: paymentRow, error: prErr } = await supabaseAdmin.from('payments').select('*').eq('razorpay_order_id', razorpay_order_id).limit(1).maybeSingle();
      if (prErr) {
        console.error('Webhook: payments query error', prErr);
        return res.status(500).send('db error');
      }
      if (!paymentRow) {
        console.warn('Webhook: payment row not found for order_id', razorpay_order_id);
        return res.status(200).send('no local payment row');
      }

      // If already completed, ignore
      if (paymentRow.status === 'completed' && paymentRow.subscription_id) {
        return res.status(200).send('already processed');
      }

      try {
        // check existing subscription
        const todayIso = new Date().toISOString().slice(0, 10);
        const { data: existing, error: existingErr } = await supabaseAdmin
          .from('user_subscriptions')
          .select('id')
          .eq('user_id', paymentRow.user_id)
          .eq('plan_id', paymentRow.plan_id)
          .in('status', ['pending', 'active'])
          .or(`end_date.is.null,end_date.gte.${todayIso}`)
          .limit(1);

        if (existingErr) {
          console.error('Webhook validation error', existingErr);
          return res.status(500).send('validation failed');
        }

        // If subscription exists, attach + complete + credit wallet
        if (Array.isArray(existing) && existing.length > 0) {
          const existingId = existing[0].id;
          await supabaseAdmin.from('payments').update({
            status: 'completed',
            razorpay_payment_id,
            razorpay_order_id,
            subscription_id: existingId,
            updated_at: new Date().toISOString()
          }).eq('id', paymentRow.id);

          // compute gold mg if missing
          let goldMgE = Number(paymentRow.gold_milligrams ?? 0);
          if (!goldMgE) {
            goldMgE = await computeGoldMgFromAmount(Number(paymentRow.amount ?? 0));
            if (goldMgE > 0) await supabaseAdmin.from('payments').update({ gold_milligrams: goldMgE }).eq('id', paymentRow.id);
          }

          try {
            await creditWalletForPayment({ user_id: paymentRow.user_id, amount: Number(paymentRow.amount ?? 0), gold_milligrams: goldMgE });
          } catch (we) {
            console.error('Webhook wallet credit failed for attached subscription', we);
          }

          return res.status(200).send('attached to existing');
        }

        // create subscription
        const { data: planInfo } = await supabaseAdmin.from('plans').select('total_months').eq('id', paymentRow.plan_id).maybeSingle();
        const endDateCalculated = planInfo?.total_months ? computeEndDateFromMonths((paymentRow.payment_date || new Date()).slice(0, 10), planInfo.total_months) : null;

        const rupees = Number(amountPaise || 0) / 100;
        const subPayload = {
          user_id: paymentRow.user_id,
          plan_id: paymentRow.plan_id,
          start_date: paymentRow.payment_date ? (new Date(paymentRow.payment_date)).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          end_date: endDateCalculated || null,
          status: 'active',
          total_paid: rupees,
          bonus_amount: 0,
          final_amount: rupees,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: insertData, error: insertErr } = await supabaseAdmin.from('user_subscriptions').insert([subPayload]).select('id').limit(1);
        if (insertErr) {
          console.error('Webhook subscription insert error', insertErr);
          return res.status(500).send('failed to create subscription');
        }
        const subscriptionId = insertData?.[0]?.id ?? insertData?.id ?? null;
        if (!subscriptionId) return res.status(500).send('no subscription id');

        // update payment
        await supabaseAdmin.from('payments').update({
          status: 'completed',
          razorpay_payment_id,
          razorpay_order_id,
          subscription_id: subscriptionId,
          updated_at: new Date().toISOString()
        }).eq('id', paymentRow.id);

        // compute gold_mg if missing and persist
        let goldMgFinal = Number(paymentRow.gold_milligrams ?? 0);
        if (!goldMgFinal) {
          goldMgFinal = await computeGoldMgFromAmount(Number(paymentRow.amount ?? 0));
          if (goldMgFinal > 0) {
            await supabaseAdmin.from('payments').update({ gold_milligrams: goldMgFinal }).eq('id', paymentRow.id);
          }
        }

        // credit wallet
        try {
          await creditWalletForPayment({ user_id: paymentRow.user_id, amount: rupees, gold_milligrams: goldMgFinal });
        } catch (walletErr) {
          console.error('Failed to update wallet in webhook finalize', walletErr);
          // continue — return 200 to webhook so gateway doesn't repeatedly retry
        }

        return res.status(200).send('ok');
      } catch (e) {
        console.error('Webhook finalize error', e);
        return res.status(500).send('finalize failed');
      }
    }

    // ignore other events
    return res.status(200).send('ignored');
  } catch (e) {
    console.error('Webhook handling error', e);
    return res.status(500).send('server error');
  }
});


// profile endpoints & active plans
app.get('/api/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabaseAdmin.from('user_profile').select('*').eq('id', userId).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data?.full_name) data.full_name = 'Unnamed User';
  res.json(data);
});

app.get('/api/active-plans/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false });

    if (subsErr) return res.status(500).json({ error: subsErr.message || 'Failed to fetch subscriptions' });
    if (!Array.isArray(subs) || subs.length === 0) return res.json([]);

    const planIds = Array.from(new Set(subs.map(s => s.plan_id).filter(Boolean)));
    const { data: plans = [], error: plansErr } = await supabaseAdmin.from('plans').select('*').in('id', planIds.length ? planIds : [-1]);
    if (plansErr) return res.status(500).json({ error: plansErr.message || 'Failed to fetch plans' });

    const plansMap = new Map(plans.map(p => [p.id, p]));
    const result = subs.map(s => ({
      id: s.id,
      user_id: s.user_id,
      plan_id: s.plan_id,
      plan: plansMap.get(s.plan_id) ?? null,
      status: s.status,
      start_date: s.start_date,
      end_date: s.end_date,
      total_paid_field: s.total_paid ?? 0,
      bonus_amount: s.bonus_amount ?? 0,
      final_amount: s.final_amount ?? 0,
      created_at: s.created_at,
      updated_at: s.updated_at
    }));
    return res.json(result);
  } catch (err) {
    console.error('Unexpected error in /api/active-plans/:userId', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabaseAdmin.from('user_profile').select('*').eq('id', userId).single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data.full_name) data.full_name = 'Unnamed User';
  res.json(data);
});

app.put('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const { full_name, phone, referral_code } = req.body;
  const { data, error } = await supabaseAdmin.from('user_profile').upsert({
    id: userId, full_name: full_name || 'Unnamed User', phone, referral_code
  }).eq('id', userId);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/subscription/:subscriptionId
app.get('/api/subscription/:subscriptionId', async (req, res) => {
  try {
    const subscriptionId = Number(req.params.subscriptionId);
    if (!subscriptionId) return res.status(400).json({ error: 'Invalid subscription id' });

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (subErr) {
      console.error('Subscription fetch error', subErr);
      return res.status(500).json({ error: subErr.message || 'Failed to fetch subscription' });
    }
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    // attach plan details (if any)
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', sub.plan_id)
      .maybeSingle();

    if (planErr) {
      console.warn('Could not fetch plan for subscription', planErr);
      sub.plan = null;
    } else {
      sub.plan = plan ?? null;
    }

    return res.json(sub);
  } catch (err) {
    console.error('Error in /api/subscription/:id', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/subscription/:subscriptionId
app.get('/api/payments/subscription/:subscriptionId', async (req, res) => {
  try {
    const subscriptionId = Number(req.params.subscriptionId);
    if (!subscriptionId) return res.status(400).json({ error: 'Invalid subscription id' });

    // 1) primary: payments directly linked to subscription_id
    const { data: paymentsLinked, error: pErr } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('payment_date', { ascending: false });

    if (pErr) {
      console.error('Payments fetch error', pErr);
      return res.status(500).json({ error: pErr.message || 'Failed to fetch payments' });
    }

    if (Array.isArray(paymentsLinked) && paymentsLinked.length > 0) {
      return res.json(paymentsLinked);
    }

    // 2) fallback: fetch subscription to determine user_id + plan_id
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('user_subscriptions')
      .select('id, user_id, plan_id')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (subErr || !sub) {
      return res.json([]);
    }

    // 3) return recent completed payments for same user+plan
    const { data: fallbackPayments, error: fbErr } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('user_id', sub.user_id)
      .eq('plan_id', sub.plan_id)
      .in('status', ['completed'])
      .order('payment_date', { ascending: false })
      .limit(50);

    if (fbErr) {
      console.error('Fallback payments fetch error', fbErr);
      return res.status(500).json({ error: fbErr.message || 'Failed to fetch fallback payments' });
    }

    return res.json(fallbackPayments || []);
  } catch (err) {
    console.error('Error in /api/payments/subscription/:id', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/allocate-bonus
app.post('/api/allocate-bonus', async (req, res) => {
  try {
    const { subscription_id } = req.body;
    const subId = Number(subscription_id ?? 0);
    if (!subId) return res.status(400).json({ success: false, message: 'subscription_id required' });

    // 1) fetch subscription
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('id', subId)
      .maybeSingle();

    if (subErr) {
      console.error('allocate-bonus: subscription fetch error', subErr);
      return res.status(500).json({ success: false, message: 'Failed to fetch subscription' });
    }
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    // 2) fetch plan (to know total_months if available)
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', sub.plan_id)
      .maybeSingle();

    if (planErr) {
      console.warn('allocate-bonus: plan fetch error (continuing)', planErr);
    }

    // 3) Bonus configured?
    const bonusAmount = Number(sub.bonus_amount ?? 0);
    if (!bonusAmount || bonusAmount <= 0) {
      return res.status(400).json({ success: false, message: 'No bonus configured for this subscription' });
    }

    // 4) Check if bonus already allocated (a payments row with payment_type = 'bonus')
    const { data: existingBonus = [], error: ebErr } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('subscription_id', subId)
      .eq('payment_type', 'bonus')
      .limit(1);

    if (ebErr) {
      console.error('allocate-bonus: existing bonus check error', ebErr);
      return res.status(500).json({ success: false, message: 'Failed to check existing bonus' });
    }
    if (Array.isArray(existingBonus) && existingBonus.length > 0) {
      return res.status(400).json({ success: false, message: 'Bonus already allocated' });
    }

    // 5) Count completed monthly payments (exclude payment_type 'bonus')
    const { data: completedPayments = [], error: cpErr } = await supabaseAdmin
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('subscription_id', subId)
      .neq('payment_type', 'bonus')
      .eq('status', 'completed');

    if (cpErr) {
      console.error('allocate-bonus: completed payments fetch error', cpErr);
      return res.status(500).json({ success: false, message: 'Failed to check payments' });
    }

    const completedCount = Array.isArray(completedPayments) ? completedPayments.length : 0;
    const requiredMonths = Number(plan?.total_months ?? 0);

    if (requiredMonths && completedCount < requiredMonths) {
      return res.status(400).json({
        success: false,
        message: `Not eligible for bonus yet. Completed payments: ${completedCount}, required: ${requiredMonths}`
      });
    }

    // 6) Insert bonus payment row
    const { data: lastPay = [], error: lpErr } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('subscription_id', subId)
      .order('payment_date', { ascending: false })
      .limit(1);

    let rate = null;
    if (Array.isArray(lastPay) && lastPay.length > 0) rate = lastPay[0].gold_rate ?? null;

    const insertRow = {
      user_id: sub.user_id,
      subscription_id: subId,
      amount: 0,
      payment_type: 'bonus',
      month_number: null,
      status: 'completed',
      gold_rate: rate,
      gold_milligrams: bonusAmount,
      payment_date: new Date().toISOString(),
      plan_id: sub.plan_id
    };

    const { data: inserted, error: insErr } = await supabaseAdmin.from('payments').insert(insertRow).select().single();
    if (insErr) {
      console.error('allocate-bonus: insert error', insErr);
      return res.status(500).json({ success: false, message: 'Failed to create bonus payment' });
    }

    await supabaseAdmin.from('user_subscriptions').update({ updated_at: new Date().toISOString() }).eq('id', subId);

    return res.json({ success: true, payment: inserted });
  } catch (err) {
    console.error('allocate-bonus: unexpected error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// helper for referral code generation
function makeReferralCode(seed) {
  return (seed || crypto.randomBytes(4).toString('hex')).toUpperCase().slice(0, 8);
}

/**
 * GET /api/referral-data/:userId
 * returns:
 * {
 *   levelConfig: [...],
 *   referralsByLevel: [{ level, count, commission }],
 *   recentCommissions: [{ id, level, amount, percentage, created_at, from_user: { full_name } }],
 *   totalCommission: number,
 *   totalReferrals: number
 * }
 *
 * IMPORTANT: does not rely on FK shorthand join — fetches from_user_id and resolves names from user_profile.
 */
app.get('/api/referral-data/:userId', async (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    // 1) load level config
    const { data: levelConfig = [], error: lcErr } = await supabaseAdmin
      .from('referral_levels_config')
      .select('*')
      .order('level', { ascending: true });

    if (lcErr) console.warn('level config fetch error', lcErr);

    // 2) compute referrals per level
    const maxLevel = Math.max(10, (levelConfig.length || 3));
    const referralsByLevel = [];

    let totalReferrals = 0;
    let totalCommission = 0;

    for (let level = 1; level <= maxLevel; level++) {
      const { data: refs = [], error: refErr } = await supabaseAdmin
        .from('referral_tree')
        .select('referred_user_id')
        .eq('user_id', userId)
        .eq('level', level);

      if (refErr) console.warn('ref level fetch error', level, refErr);

      const count = Array.isArray(refs) ? refs.length : 0;
      totalReferrals += count;

      // sum commission for this level
      const { data: comms = [], error: commErr } = await supabaseAdmin
        .from('referral_commissions')
        .select('amount')
        .eq('user_id', userId)
        .eq('level', level);

      if (commErr) console.warn('comm fetch err', level, commErr);
      const levelCommission = (comms || []).reduce((s, c) => s + Number(c.amount || 0), 0);
      totalCommission += levelCommission;

      referralsByLevel.push({
        level,
        count,
        commission: levelCommission
      });
    }

    // 3) recent commissions: select fields including from_user_id then fetch names from user_profile
    const { data: recentRows = [], error: rcErr } = await supabaseAdmin
      .from('referral_commissions')
      .select('id, level, amount, percentage, created_at, from_user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (rcErr) console.warn('recent commissions fetch error', rcErr);

    // collect all from_user_id values
    const fromIds = Array.from(new Set((recentRows || []).map(r => r.from_user_id).filter(Boolean)));
    let profilesMap = {};
    if (fromIds.length > 0) {
      const { data: profiles = [], error: profErr } = await supabaseAdmin
        .from('user_profile')
        .select('id, full_name')
        .in('id', fromIds);
      if (profErr) {
        console.warn('Could not fetch user_profile for commissions:', profErr);
      } else {
        profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, { id: p.id, full_name: p.full_name }]));
      }
    }

    const recentCommissions = (recentRows || []).map(r => ({
      id: r.id,
      level: r.level,
      amount: Number(r.amount || 0),
      percentage: r.percentage ?? null,
      created_at: r.created_at,
      from_user: profilesMap[r.from_user_id] ?? { id: r.from_user_id, full_name: '—' }
    }));

    return res.json({
      levelConfig,
      referralsByLevel,
      recentCommissions,
      totalCommission,
      totalReferrals
    });
  } catch (err) {
    console.error('error /api/referral-data', err);
    return res.status(500).json({ error: 'server error' });
  }
});

/**
 * POST /api/generate-referral-code
 * Body: { user_id } - idempotent
 */
app.post('/api/generate-referral-code', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ success: false, message: 'user_id required' });

  try {
    // get existing
    const { data: profile, error: pErr } = await supabaseAdmin
      .from('user_profile')
      .select('id, referral_code')
      .eq('id', user_id)
      .maybeSingle();

    if (pErr) return res.status(500).json({ success: false, message: pErr.message });

    if (profile && profile.referral_code) {
      return res.json({ success: true, referral_code: profile.referral_code, existed: true });
    }

    // generate unique-ish code
    let code = makeReferralCode(user_id);
    for (let i = 0; i < 5; i++) {
      const { data: conflict, error: cErr } = await supabaseAdmin
        .from('user_profile')
        .select('id')
        .eq('referral_code', code)
        .limit(1);

      if (cErr) { console.warn('ref code check err', cErr); break; }
      if (!conflict || conflict.length === 0) break;
      code = makeReferralCode(user_id + i);
    }

    const { data: updated, error: upErr } = await supabaseAdmin
      .from('user_profile')
      .update({ referral_code: code })
      .eq('id', user_id)
      .select()
      .maybeSingle();

    if (upErr) return res.status(500).json({ success: false, message: upErr.message });

    return res.json({ success: true, referral_code: code });
  } catch (err) {
    console.error('generate-referral-code err', err);
    return res.status(500).json({ success: false, message: 'server error' });
  }
});

/**
 * POST /api/record-commission
 * Body:
 *   { referrer_id, from_user_id, level, percentage, amount, payment_id }
 */
app.post('/api/record-commission', async (req, res) => {
  const { referrer_id, from_user_id, level, percentage, amount, payment_id } = req.body;
  if (!referrer_id || !from_user_id || !level || !amount) {
    return res.status(400).json({ success: false, message: 'missing fields' });
  }

  try {
    const row = {
      user_id: referrer_id,
      from_user_id,
      level,
      percentage: percentage ?? null,
      amount,
      payment_id: payment_id ?? null,
      created_at: new Date().toISOString()
    };

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('referral_commissions')
      .insert(row)
      .select()
      .single();

    if (insErr) {
      console.error('record-commission insert error', insErr);
      return res.status(500).json({ success: false, message: insErr.message });
    }

    return res.json({ success: true, commission: inserted });
  } catch (err) {
    console.error('record-commission unexpected', err);
    return res.status(500).json({ success: false, message: 'server error' });
  }
});

// POST /api/generate-referral-code
app.post('/api/generate-referral-code', async (req, res) => {
  try {
    const { user_id } = req.body ?? {};
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id required' });

    // try existing first
    const { data: existing, error: exErr } = await supabaseAdmin
      .from('user_profile')
      .select('id, referral_code')
      .eq('id', user_id)
      .maybeSingle();

    if (exErr) {
      console.error('generate-referral-code: lookup err', exErr);
      return res.status(500).json({ success: false, message: exErr.message });
    }
    if (existing && existing.referral_code) {
      return res.json({ success: true, referral_code: existing.referral_code, existed: true });
    }

    // generator
    const makeCode = (seed = '') => {
      const src = (seed || Math.random().toString(36));
      const code = Buffer.from(src).toString('base64').replace(/[^A-Z0-9]/ig, '').slice(0, 8).toUpperCase();
      return code || Math.random().toString(36).slice(2, 9).toUpperCase();
    };

    // ensure unique
    let code = makeCode(user_id);
    for (let i = 0; i < 6; i++) {
      const { data: conflict, error: cErr } = await supabaseAdmin
        .from('user_profile')
        .select('id')
        .eq('referral_code', code)
        .limit(1);
      if (cErr) { console.warn('ref code uniqueness check error', cErr); break; }
      if (!conflict || conflict.length === 0) break;
      code = makeCode(user_id + i);
    }

    // persist
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('user_profile')
      .update({ referral_code: code, updated_at: new Date().toISOString() })
      .eq('id', user_id)
      .select()
      .maybeSingle();

    if (upErr) {
      console.error('generate-referral-code: update error', upErr);
      return res.status(500).json({ success: false, message: upErr.message });
    }

    return res.json({ success: true, referral_code: code, existed: false });
  } catch (err) {
    console.error('generate-referral-code unexpected', err);
    return res.status(500).json({ success: false, message: 'server error' });
  }
});


// POST /api/build-referral-tree
// Body: { user_id }
// POST /api/build-referral-tree
// server/index.js - Add this endpoint for debugging
// server/index.js - Add this endpoint

/**
 * POST /api/build-referral-tree
 * Body: { user_id }
 * Builds complete referral tree for a new user
 * Inserts direct referrer (level 1) and all indirect referrers (level 2-10)
 */
app.post('/api/build-referral-tree', async (req, res) => {
  console.log('=== BUILD REFERRAL TREE API CALLED ===');
  console.log('Request received at:', new Date().toISOString());
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { user_id } = req.body ?? {};

    if (!user_id) {
      console.error('ERROR: user_id is required but missing');
      return res.status(400).json({
        success: false,
        message: 'user_id required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Processing referral tree for user ID: ${user_id}`);

    // Get the new user's profile to find direct referrer
    console.log(`Step 1: Fetching profile for user ${user_id}...`);
    const { data: userProfile, error: profileErr } = await supabaseAdmin
      .from('user_profile')
      .select('id, full_name, phone, referred_by')
      .eq('id', user_id)
      .maybeSingle();

    if (profileErr) {
      console.error('ERROR: Failed to fetch user profile:', profileErr);
      return res.status(500).json({
        success: false,
        message: 'Database error fetching user profile',
        details: profileErr.message,
        timestamp: new Date().toISOString()
      });
    }

    if (!userProfile) {
      console.error(`ERROR: User profile not found for ID: ${user_id}`);
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`User profile found: ${userProfile.full_name} (${userProfile.phone})`);
    console.log(`Direct referrer ID from profile: ${userProfile.referred_by || 'None'}`);

    // If no referrer, return early (nothing to build)
    if (!userProfile.referred_by) {
      console.log('No referrer found. Returning empty tree.');
      return res.json({
        success: true,
        message: 'No referrer - tree building not needed',
        user_id,
        direct_referrer: null,
        inserted: 0,
        levels: [],
        timestamp: new Date().toISOString()
      });
    }

    // Walk up the referral chain (max 10 levels)
    console.log('Step 2: Walking up referral chain...');
    const maxLevels = 10;
    const referrerChain = [];
    const visited = new Set();
    let currentUserId = userProfile.referred_by;
    let level = 1;

    while (currentUserId && level <= maxLevels) {
      // Prevent infinite loops
      if (visited.has(currentUserId)) {
        console.warn(`Loop detected at user ID: ${currentUserId}. Stopping.`);
        break;
      }
      visited.add(currentUserId);

      console.log(`Level ${level}: Processing referrer ID: ${currentUserId}`);

      // Get referrer's profile
      const { data: referrerProfile, error: refErr } = await supabaseAdmin
        .from('user_profile')
        .select('id, full_name, phone, referred_by')
        .eq('id', currentUserId)
        .maybeSingle();

      if (refErr) {
        console.error(`ERROR: Failed to fetch referrer profile for ID ${currentUserId}:`, refErr);
        break;
      }

      if (!referrerProfile) {
        console.warn(`Referrer profile not found for ID: ${currentUserId}. Stopping chain.`);
        break;
      }

      console.log(`Level ${level}: Referrer found - ${referrerProfile.full_name} (${referrerProfile.phone})`);

      // Add to chain
      referrerChain.push({
        referrer_id: referrerProfile.id,
        referrer_name: referrerProfile.full_name,
        referrer_phone: referrerProfile.phone,
        level: level,
        next_referrer: referrerProfile.referred_by
      });

      // Move to next level if exists
      currentUserId = referrerProfile.referred_by;
      level++;
    }

    console.log(`Referral chain built with ${referrerChain.length} levels:`);
    referrerChain.forEach(rc => {
      console.log(`  Level ${rc.level}: ${rc.referrer_name} (ID: ${rc.referrer_id})`);
    });

    // Insert into referral_tree table
    console.log('Step 3: Inserting into referral_tree table...');
    let insertedCount = 0;
    const insertedRows = [];
    const errors = [];

    for (const referrer of referrerChain) {
      const treeRow = {
        user_id: referrer.referrer_id,
        referred_user_id: user_id,
        level: referrer.level,
        created_at: new Date().toISOString()
      };

      console.log(`Attempting to insert: Level ${referrer.level}, User ${referrer.referrer_id} → ${user_id}`);

      try {
        // Check if entry already exists (idempotent)
        const { data: existing, error: checkErr } = await supabaseAdmin
          .from('referral_tree')
          .select('id')
          .eq('user_id', treeRow.user_id)
          .eq('referred_user_id', treeRow.referred_user_id)
          .eq('level', treeRow.level)
          .limit(1);

        if (checkErr) {
          console.error(`Check error for level ${referrer.level}:`, checkErr);
          errors.push({
            level: referrer.level,
            referrer_id: referrer.referrer_id,
            error: checkErr.message,
            type: 'check_error'
          });
          continue;
        }

        if (existing && existing.length > 0) {
          console.log(`Level ${referrer.level} entry already exists, skipping.`);
          continue;
        }

        // Insert new entry
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from('referral_tree')
          .insert(treeRow)
          .select('id')
          .single();

        if (insertErr) {
          console.error(`Insert error for level ${referrer.level}:`, insertErr);
          errors.push({
            level: referrer.level,
            referrer_id: referrer.referrer_id,
            error: insertErr.message,
            type: 'insert_error'
          });
        } else {
          console.log(`Successfully inserted level ${referrer.level} with ID: ${inserted.id}`);
          insertedCount++;
          insertedRows.push({
            id: inserted.id,
            level: referrer.level,
            referrer_id: referrer.referrer_id,
            referrer_name: referrer.referrer_name
          });
        }
      } catch (err) {
        console.error(`Unexpected error at level ${referrer.level}:`, err);
        errors.push({
          level: referrer.level,
          referrer_id: referrer.referrer_id,
          error: err.message,
          type: 'unexpected_error'
        });
      }
    }

    console.log(`Insertion complete. Inserted ${insertedCount} rows, ${errors.length} errors.`);

    // Return response
    const response = {
      success: true,
      user_id,
      user_name: userProfile.full_name,
      user_phone: userProfile.phone,
      direct_referrer: referrerChain[0] ? {
        id: referrerChain[0].referrer_id,
        name: referrerChain[0].referrer_name,
        phone: referrerChain[0].referrer_phone
      } : null,
      total_levels: referrerChain.length,
      inserted: insertedCount,
      inserted_rows: insertedRows,
      errors: errors.length > 0 ? errors : undefined,
      chain: referrerChain.map(rc => ({
        level: rc.level,
        referrer_id: rc.referrer_id,
        referrer_name: rc.referrer_name
      })),
      timestamp: new Date().toISOString()
    };

    console.log('=== BUILD REFERRAL TREE COMPLETE ===');
    console.log('Response:', JSON.stringify(response, null, 2));

    return res.json(response);

  } catch (err) {
    console.error('=== BUILD REFERRAL TREE UNEXPECTED ERROR ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);

    return res.status(500).json({
      success: false,
      message: 'Internal server error building referral tree',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// server/index.js - Add this endpoint for debugging
app.post('/api/debug/fix-referral-trees', async (req, res) => {
  try {
    console.log('=== FIXING ALL REFERRAL TREES ===');

    // Get all users with referrers but missing tree entries
    const { data: users, error } = await supabaseAdmin
      .from('user_profile')
      .select('id, full_name, phone, referred_by')
      .not('referred_by', 'is', null);

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`Found ${users.length} users with referrers`);

    const results = [];
    for (const user of users) {
      console.log(`Processing user: ${user.full_name} (${user.id})`);

      // Check if tree entries exist
      const { data: existingTree, error: treeErr } = await supabaseAdmin
        .from('referral_tree')
        .select('id')
        .eq('referred_user_id', user.id)
        .limit(1);

      if (treeErr) {
        console.error(`Tree check error for ${user.id}:`, treeErr);
        continue;
      }

      if (!existingTree || existingTree.length === 0) {
        console.log(`No tree entries found for ${user.id}, triggering build...`);

        // Trigger tree build
        const buildResp = await fetch(`http://localhost:${PORT}/api/build-referral-tree`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        });

        const result = await buildResp.json();
        results.push({
          user_id: user.id,
          user_name: user.full_name,
          result: result.success ? 'Built' : 'Failed',
          details: result
        });

        // Small delay to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        console.log(`Tree already exists for ${user.id}`);
        results.push({
          user_id: user.id,
          user_name: user.full_name,
          result: 'Already exists',
          existing_count: existingTree.length
        });
      }
    }

    return res.json({
      success: true,
      processed: users.length,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Debug endpoint error:', err);
    return res.status(500).json({ error: err.message });
  }
});


// GET /api/referrals/:userId
// Returns direct (level-1) referrals for a user
app.get('/api/referrals/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // select basic profile fields for users who were referred_by = userId
    const { data, error } = await supabaseAdmin
      .from('user_profile')
      .select('id, full_name, phone, created_at, referral_code')
      .eq('referred_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching direct referrals', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch referrals' });
    }

    // normalize response shape expected by the mobile app
    const referrals = (data || []).map((r) => ({
      id: r.id,
      full_name: r.full_name || 'Unnamed User',
      phone: r.phone || null,
      created_at: r.created_at || null,
      referral_code: r.referral_code || null
    }));

    return res.json({ referrals });
  } catch (err) {
    console.error('GET /api/referrals/:userId error', err);
    return res.status(500).json({ error: 'server error' });
  }
});
// GET /api/tree/:userId
// returns nested tree for userId: [{ id, full_name, phone, level, referred_by, children: [...] }, ...]
app.get('/api/tree/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // 1) load all referral_tree rows for this root user
    const { data: rtRows = [], error: rtErr } = await supabaseAdmin
      .from('referral_tree')
      .select('level, referred_user_id')
      .eq('user_id', userId)
      .order('level', { ascending: true });

    if (rtErr) {
      console.error('tree: referral_tree fetch error', rtErr);
      return res.status(500).json({ error: rtErr.message || 'Failed to fetch referral_tree' });
    }

    const referredIds = Array.from(new Set((rtRows || []).map(r => r.referred_user_id).filter(Boolean)));
    if (referredIds.length === 0) return res.json({ tree: [] });

    // 2) fetch profiles for all referred users (we also need their referred_by to place them under parent)
    const { data: profiles = [], error: pErr } = await supabaseAdmin
      .from('user_profile')
      .select('id, full_name, phone, referred_by, created_at')
      .in('id', referredIds);

    if (pErr) {
      console.error('tree: profiles fetch error', pErr);
      // still return empty rather than crash
      return res.status(500).json({ error: pErr.message || 'Failed to fetch profiles' });
    }

    // 3) create map for quick lookup + initial node objects (use level from referral_tree)
    const levelMap = new Map();
    rtRows.forEach(r => { levelMap.set(String(r.referred_user_id), Number(r.level || 1)); });

    const nodeMap = new Map();
    profiles.forEach(p => {
      nodeMap.set(String(p.id), {
        id: String(p.id),
        full_name: p.full_name || 'Unnamed User',
        phone: p.phone || null,
        level: levelMap.get(String(p.id)) || 1,
        referred_by: p.referred_by || null,
        created_at: p.created_at || null,
        children: []
      });
    });

    // 4) attach children: if a profile's referred_by is in nodeMap attach to that parent;
    //    otherwise if referred_by === root userId attach as top-level; if parent not found, keep as top-level.
    const rootNodes = [];
    nodeMap.forEach(node => {
      const parentId = node.referred_by ? String(node.referred_by) : null;
      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId).children.push(node);
      } else if (parentId === String(userId)) {
        // direct child of root
        rootNodes.push(node);
      } else {
        // no parent inside the pulled set (or parent missing) — fallback attach to root
        rootNodes.push(node);
      }
    });

    // 5) Optionally sort children by created_at (or name)
    const sortRecursively = (arr) => {
      arr.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      arr.forEach(c => c.children && sortRecursively(c.children));
    };
    sortRecursively(rootNodes);

    return res.json({ tree: rootNodes });
  } catch (err) {
    console.error('GET /api/tree/:userId error', err);
    return res.status(500).json({ error: 'server error' });
  }
});


// GET /api/wallet/:userId
app.get('/api/wallet/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // fetch wallets row
    const { data: walletRow, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletErr) {
      console.error('wallet fetch error', walletErr);
      return res.status(500).json({ error: 'failed to fetch wallet' });
    }

    // optionally fetch investment_accounts wallet_balance if you use it per-account
    const { data: account, error: accErr } = await supabaseAdmin
      .from('investment_accounts')
      .select('id, wallet_balance')
      .eq('user_id', userId) // or use account id elsewhere
      .limit(1);

    // Build payload
    const payload = {
      balance: account && account.length > 0 ? Number(account[0].wallet_balance || 0) : Number(walletRow?.total_balance || walletRow?.saving_balance || 0),
      totalEarnings: Number(walletRow?.total_commission || 0),
      totalWithdrawn: Number(walletRow?.total_withdrawn || 0),
      autoWithdrawEnabled: Boolean(walletRow?.auto_withdraw_enabled),
      autoWithdrawThreshold: Number(walletRow?.auto_withdraw_threshold || 0),
      raw: { walletRow, account: account?.[0] ?? null }
    };

    return res.json(payload);
  } catch (e) {
    console.error('GET /api/wallet error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// GET /api/earnings/:userId
app.get('/api/earnings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { data, error } = await supabaseAdmin
      .from('earnings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('earnings fetch error', error);
      return res.status(500).json({ error: 'failed to fetch earnings' });
    }

    return res.json({ earnings: data || [] });
  } catch (e) {
    console.error('GET /api/earnings error', e);
    return res.status(500).json({ error: 'server error' });
  }
});


// POST /api/withdraw-request
// Body: { user_id, amount, payment_method, payment_details }
// If authenticated token present it still accepts user_id (server side); you can adapt auth checks.
app.post('/api/withdraw-request', async (req, res) => {
  console.log('=== WITHDRAW REQUEST API CALLED ===');
  console.log('Request received at:', new Date().toISOString());
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  try {
    const { user_id, amount, payment_method, payment_details } = req.body ?? {};
    if (!user_id || !amount || !payment_method) {
      return res.status(400).json({ success: false, message: 'missing fields: user_id, amount, payment_method required' });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'invalid amount' });
    }

    // Try RPC first (atomic)
    try {
      // If you add the SQL function below to your DB, this RPC will perform everything atomically.
      const rpcPayload = {
        p_user_id: user_id,
        p_amount: numericAmount,
        p_payment_method: payment_method,
        p_payment_details: JSON.stringify(payment_details || {}),
      };

      const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('withdraw_commission', rpcPayload);

      if (rpcErr) {
        // If function not found or failed, fallback below.
        console.warn('withdraw_commission rpc error, falling back to JS flow:', rpcErr.message || rpcErr);
        throw rpcErr;
      }

      // rpcData should include inserted withdrawal row (or id) and new balances
      return res.json({ success: true, request: rpcData });
    } catch (rpcErr) {
      // fallback JS-based flow (best-effort; not fully atomic)
      console.warn('RPC withdraw_commission not available or failed — using fallback path.');
    }


    console.log("userid ", user_id);
    // ----- Fallback (non-atomic) implementation -----
    // 1) fetch wallet
    const { data: walletRow, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

      console.log("walletRow ", walletRow);

    if (walletErr) {
      console.error('fallback: wallet fetch error', walletErr);
      return res.status(500).json({ success: false, message: 'failed to fetch wallet' });
    }
    if (!walletRow) {
      return res.status(400).json({ success: false, message: 'wallet not found for user' });
    }

    const referralBalance = Number(walletRow.referral_balance ?? 0);
    const totalBalance = Number(walletRow.total_balance ?? 0);
    const totalWithdrawn = Number(walletRow.total_withdrawn ?? 0);

    if (numericAmount > referralBalance) {
      return res.status(400).json({ success: false, message: `Insufficient referral balance. Available: ${referralBalance}` });
    }

    // 2) create withdrawal request (status = pending)
    const newRequest = {
      user_id,
      amount: numericAmount,
      payment_method,
      payment_details: payment_details || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'commission'
    };

    const { data: insertedReq, error: insertErr } = await supabaseAdmin
      .from('withdrawal_requests')
      .insert(newRequest)
      .select()
      .single();

    if (insertErr) {
      console.error('fallback: withdrawal insert error', insertErr);
      return res.status(500).json({ success: false, message: 'failed to create withdrawal request' });
    }

    // 3) update wallet balances (deduct referral_balance and total_balance, add to total_withdrawn)
    const updatedWalletPayload = {
      referral_balance: referralBalance - numericAmount,
      total_balance: totalBalance - numericAmount,
      total_withdrawn: totalWithdrawn + numericAmount,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedWallet, error: upErr } = await supabaseAdmin
      .from('wallets')
      .update(updatedWalletPayload)
      .eq('user_id', user_id)
      .select()
      .maybeSingle();

    if (upErr) {
      console.error('fallback: wallet update error', upErr);
      // Attempt to mark request as 'failed' so admin sees it
      await supabaseAdmin.from('withdrawal_requests').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', insertedReq.id);
      return res.status(500).json({ success: false, message: 'failed to update wallet after creating withdrawal. Request created but marked failed.' });
    }

    // success
    return res.json({ success: true, request: insertedReq, wallet: updatedWallet });
  } catch (err) {
    console.error('POST /api/withdraw-request error', err);
    return res.status(500).json({ success: false, message: 'server error', details: String(err) });
  }
});

// POST /api/withdraw
app.post('/api/withdraw', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    // validate token -> fetch user
    const { data: udata, error: uerr } = await supabaseAdmin.auth.getUser(token);
    if (uerr || !udata?.user) {
      console.warn('Withdraw: invalid token', uerr);
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = udata.user.id;

    const { amount, paymentMethod, paymentDetails, source } = req.body ?? {};
    const amt = Number(amount || 0);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    if (!['upi', 'account'].includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method' });

    // call the RPC that performs atomic debit + insert
    const { data: rpcResp, error: rpcErr } = await supabaseAdmin.rpc('withdraw_from_referral', {
      p_user_id: userId,
      p_amount: amt,
      p_payment_method: paymentMethod,
      p_payment_details: JSON.stringify(paymentDetails || {})
    });

    if (rpcErr) {
      console.error('RPC withdraw error', rpcErr);
      // if RPC returned an exception or message, forward a friendly error
      return res.status(500).json({ error: rpcErr.message || 'withdraw_failed' });
    }

    // rpcResp is an array of rows returned by the function (depends on PostgreSQL)
    const row = Array.isArray(rpcResp) ? rpcResp[0] : rpcResp;

    if (!row || row.success !== true) {
      return res.status(400).json({ error: row?.message || 'withdraw_failed' });
    }

    return res.json({ success: true, requestId: row.request_id });
  } catch (e) {
    console.error('POST /api/withdraw error', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/create-wallet
app.post('/api/create-wallet', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id required' });

    // check wallet exists
    const { data: wallet, error } = await supabaseAdmin
      .from('wallets')
      .select('user_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (wallet) {
      return res.json({ success: true, existed: true });
    }

    // create new wallet row
    const payload = {
      user_id,
      total_balance: 0,
      saving_balance: 0,
      referral_balance: 0,
      total_commission: 0,
      total_withdrawn: 0,
      gold_balance_mg: 0,
      auto_withdraw_enabled: false,
      auto_withdraw_threshold: 1000,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('wallets')
      .insert(payload)
      .select()
      .maybeSingle();

if (insertErr) {
  console.error('fallback: withdrawal insert error', insertErr);
  // If FK error, give a helpful response for debugging
  if (insertErr?.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Foreign key violation while creating withdrawal request',
      details: insertErr.message
    });
  }
  return res.status(500).json({ success:false, message:'failed to create withdrawal request', details: insertErr.message });
}

    return res.json({ success: true, wallet: inserted });
  } catch (e) {
    console.error('/api/create-wallet error', e);
    return res.status(500).json({ success: false, message: 'server error' });
  }
});

// Admin approves a withdrawal request: debits wallet & marks request approved (atomic via RPC preferred)
app.post('/api/admin/approve-withdrawal', async (req, res) => {
  try {
    const { request_id, admin_id = null, admin_notes = null } = req.body ?? {};
    if (!request_id) return res.status(400).json({ success: false, message: 'request_id required' });

    // 1) Try RPC 'withdraw_commission' if you created it (atomic server-side)
    try {
      const rpcPayload = {
        p_request_id: request_id,
        p_admin_id: admin_id,
        p_admin_notes: admin_notes ?? ''
      };
      // NOTE: adapt parameter names to your actual SQL function signature if different
      const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('withdraw_commission', rpcPayload);

      if (rpcErr) {
        console.warn('RPC withdraw_commission failed or not found, falling back:', rpcErr.message || rpcErr);
        throw rpcErr;
      }

      // Expect rpcData to indicate success; return it
      return res.json({ success: true, rpc: rpcData });
    } catch (rpcErr) {
      // continue to fallback JS implementation
    }

    // 2) Fallback JS implementation (best-effort, not fully atomic)
    // Fetch the withdrawal request
    const { data: reqRow, error: reqErr } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*')
      .eq('id', request_id)
      .limit(1)
      .maybeSingle();

    if (reqErr) {
      console.error('approve: fetch request error', reqErr);
      return res.status(500).json({ success: false, message: 'Failed to fetch request' });
    }
    if (!reqRow) return res.status(404).json({ success: false, message: 'Request not found' });
    if (String(reqRow.status).toLowerCase() !== 'requested' && String(reqRow.status).toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request not in requested/pending state' });
    }

    // fetch wallet row (wallets table)
    const { data: walletRow, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', reqRow.user_id)
      .limit(1)
      .maybeSingle();

    if (walletErr) {
      console.error('approve: wallet fetch error', walletErr);
      return res.status(500).json({ success: false, message: 'Failed to fetch wallet' });
    }
    if (!walletRow) {
      return res.status(400).json({ success: false, message: 'wallet not found for user' });
    }

    const referralBalance = Number(walletRow.referral_balance ?? 0);
    if (referralBalance < Number(reqRow.amount || 0)) {
      return res.status(400).json({ success: false, message: 'Insufficient referral balance' });
    }

    // compute new wallet fields
    const newReferral = referralBalance - Number(reqRow.amount || 0);
    const newTotal = Number(walletRow.total_balance ?? 0) - Number(reqRow.amount || 0);
    const newTotalWithdrawn = Number(walletRow.total_withdrawn ?? 0) + Number(reqRow.amount || 0);

    // Update wallet and withdrawal_requests
    // Note: not strictly transactional here (RPC preferred). We'll attempt wallet update first then update request.
    const { data: updatedWallet, error: upWErr } = await supabaseAdmin
      .from('wallets')
      .update({
        referral_balance: newReferral,
        total_balance: newTotal,
        total_withdrawn: newTotalWithdrawn,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', reqRow.user_id)
      .select()
      .maybeSingle();

    if (upWErr) {
      console.error('approve: wallet update error', upWErr);
      return res.status(500).json({ success: false, message: 'Failed to update wallet' });
    }

    const { data: updatedReq, error: upReqErr } = await supabaseAdmin
      .from('withdrawal_requests')
      .update({
        status: 'approved',
        admin_id: admin_id,
        admin_notes: admin_notes || null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', request_id)
      .select()
      .maybeSingle();

    if (upReqErr) {
      // rollback wallet update (best-effort)
      console.error('approve: request update error, attempting rollback', upReqErr);
      try {
        await supabaseAdmin.from('wallets')
          .update({
            referral_balance: walletRow.referral_balance,
            total_balance: walletRow.total_balance,
            total_withdrawn: walletRow.total_withdrawn,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', reqRow.user_id);
      } catch (rbErr) {
        console.error('approve: rollback failed', rbErr);
      }
      return res.status(500).json({ success: false, message: 'Failed to update withdrawal request; wallet rolled back if possible' });
    }

    return res.json({ success: true, wallet: updatedWallet, request: updatedReq });
  } catch (err) {
    console.error('admin approve error', err);
    return res.status(500).json({ success: false, message: 'server error', details: String(err) });
  }
});


// POST /api/test/trigger-commission
// Body: { payment_id, use_existing_payment (bool) }
// Creates/uses a payment and runs recordReferralCommissionForPayment({ paymentRow, planRow })

//  One time Commission Testing ( Pending )
app.post('/api/test/trigger-commission', async (req, res) => {
  try {
    const { payment_id, use_existing_payment } = req.body ?? {};
    // If payment_id provided and exists, use it
    let paymentRow = null;
    if (payment_id) {
      const { data, error } = await supabaseAdmin.from('payments').select('*').eq('id', payment_id).maybeSingle();
      if (error) return res.status(500).json({ error: 'db error fetching payment' });
      paymentRow = data;
    }

    // Optionally create a fake completed payment for testing
    if (!paymentRow) {
      const fake = {
        user_id: req.body.from_user_id || 456,   // paying user (test)
        plan_id: req.body.plan_id || 1,         // plan id (test)
        amount: req.body.amount || 1000,        // rupees
        payment_type: 'subscription_initial',
        month_number: 1,
        status: 'completed',
        payment_date: new Date().toISOString(),
        razorpay_order_id: `test_ord_${Date.now()}`
      };
      const { data: inserted, error: insErr } = await supabaseAdmin.from('payments').insert(fake).select().single();
      if (insErr) return res.status(500).json({ error: 'failed to insert fake payment', details: insErr.message });
      paymentRow = inserted;
    }

    // load plan row if exists
    const { data: planRow } = await supabaseAdmin.from('plans').select('*').eq('id', paymentRow.plan_id).maybeSingle();

    // call the existing function
    const result = await recordReferralCommissionForPayment({ paymentRow, planRow });
    return res.json({ success: true, result });
  } catch (e) {
    console.error('test trigger commission error', e);
    return res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Payment server listening on http://localhost:${PORT}`);
});