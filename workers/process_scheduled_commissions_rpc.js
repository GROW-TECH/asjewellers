// workers/process_scheduled_commissions_runonce.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'x-client-info': 'scheduled-worker' } }
});

/**
 * Process up to `limit` scheduled_commissions rows due today or earlier.
 * limit can be configured via env POLL_LIMIT (default 50).
 */
async function claimBatch(limit = 50) {
  const today = new Date().toISOString().slice(0, 10);

  // fetch candidate rows (pending and due)
  const { data: rows, error } = await supabaseAdmin
    .from('scheduled_commissions')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', today)
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log(new Date().toISOString(), 'No scheduled commissions due');
    return { processed: 0, details: 'none' };
  }

  console.log(new Date().toISOString(), `Processing ${rows.length} scheduled commission(s)`);

  const summary = { processed: 0, failed: 0, skipped: 0, errors: [] };

  for (const r of rows) {
    try {
      // atomic claim: set processing only if still pending
      const { data: claimed, error: claimErr } = await supabaseAdmin
        .from('scheduled_commissions')
        .update({ status: 'processing', locked_by: 'gha', updated_at: new Date().toISOString() })
        .eq('id', r.id)
        .eq('status', 'pending')
        .select()
        .maybeSingle();

      if (claimErr) {
        console.warn('claim failed', r.id, claimErr);
        summary.failed++;
        summary.errors.push({ id: r.id, step: 'claim', error: String(claimErr?.message || claimErr) });
        continue;
      }
      if (!claimed) {
        console.log('already claimed', r.id);
        summary.skipped++;
        continue;
      }

      // call RPC to process atomically
      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('process_scheduled_commission', { p_sched_id: Number(r.id) });
      if (rpcErr) {
        console.error('RPC failed for', r.id, rpcErr);
        // mark failed (increment attempts)
        await supabaseAdmin.from('scheduled_commissions')
          .update({ status: 'failed', attempts: (r.attempts || 0) + 1, last_error: String(rpcErr?.message || rpcErr), updated_at: new Date().toISOString() })
          .eq('id', r.id);
        summary.failed++;
        summary.errors.push({ id: r.id, step: 'rpc', error: String(rpcErr?.message || rpcErr) });
        continue;
      }

      console.log('processed', r.id, rpcRes);
      summary.processed++;
    } catch (e) {
      console.error('worker error for row', r.id, e);
      try {
        await supabaseAdmin.from('scheduled_commissions')
          .update({ status: 'failed', attempts: (r.attempts || 0) + 1, last_error: String(e?.message || e), updated_at: new Date().toISOString() })
          .eq('id', r.id);
      } catch (ee) {
        console.error('failed to mark failed', ee);
      }
      summary.failed++;
      summary.errors.push({ id: r.id, step: 'exception', error: String(e?.message || e) });
    }
  } // end for

  return summary;
}

async function runOnce() {
  try {
    const limit = Number(process.env.POLL_LIMIT || 50);
    const result = await claimBatch(limit);
    console.log(new Date().toISOString(), 'Run complete:', result);
    // Success exit (0) even if some rows failed — Actions will still show logs.
    process.exit(0);
  } catch (err) {
    console.error(new Date().toISOString(), 'Fatal error running scheduled commissions:', err);
    process.exit(1);
  }
}

// Execute
runOnce();
