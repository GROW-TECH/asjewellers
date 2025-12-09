import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('env missing');

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'x-client-info': 'scheduled-worker' } }
});

async function claimBatch(limit = 50) {
  const today = new Date().toISOString().slice(0,10);

  // 1) fetch candidate rows (pending and due)
  const { data: rows, error } = await supabaseAdmin
    .from('scheduled_commissions')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', today)
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log('No scheduled commissions due');
    return;
  }

  for (const r of rows) {
    try {
      // atomic claim
      const { data: claimed, error: claimErr } = await supabaseAdmin
        .from('scheduled_commissions')
        .update({ status: 'processing', locked_by: 'worker_node', updated_at: new Date().toISOString() })
        .eq('id', r.id)
        .eq('status', 'pending')
        .select()
        .maybeSingle();

      if (claimErr) {
        console.warn('claim failed', r.id, claimErr);
        continue;
      }
      if (!claimed) {
        console.log('already claimed', r.id);
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
        continue;
      }
      console.log('processed', r.id, rpcRes);
    } catch (e) {
      console.error('worker error for row', r.id, e);
      try {
        await supabaseAdmin.from('scheduled_commissions')
          .update({ status: 'failed', attempts: (r.attempts || 0) + 1, last_error: String(e?.message || e), updated_at: new Date().toISOString() })
          .eq('id', r.id);
      } catch (ee) { console.error('failed to mark failed', ee); }
    }
  }
}

claimBatch().catch(e => { console.error('fatal worker error', e); process.exit(1); });
