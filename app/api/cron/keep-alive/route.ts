import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// Supabase pauses free projects after 7 days without database activity, so run
// one real query on this app's own table. Returns 500 when it fails: the old
// route answered success:true even on a DB error, so nothing could ever alert.
// Called daily by Vercel cron (vercel.json) and the GitHub workflow as backup.
export async function GET() {
  const { error } = await supabase.from('photo_customers').select('id', { count: 'exact', head: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
