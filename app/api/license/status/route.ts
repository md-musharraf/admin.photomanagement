import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { readCustomers } from '@/lib/fileDb';
import { signLicense } from '@/lib/keygen';

export const dynamic = 'force-dynamic';

const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy') ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('dummy');

// GUIDs, hex machine-ids and hostnames. Rejecting everything else means ILIKE
// can't be fed `%` / `*` to match (and leak) another customer's record.
const MACHINE_ID = /^[A-Za-z0-9._-]{1,128}$/;

async function findCustomer(machineId: string) {
  if (isDemoMode) {
    return readCustomers().find((c) => c.machine_id.trim().toLowerCase() === machineId.toLowerCase()) ?? null;
  }
  const { data, error } = await supabase
    .from('photo_customers')
    .select('machine_id, status, expiry_date')
    .ilike('machine_id', machineId.replace(/_/g, '\\_')) // `_` is a single-char wildcard
    .order('created_at', { ascending: false })
    .limit(1); // maybeSingle() errored when a PC was registered twice: newest row wins
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export async function GET(request: NextRequest) {
  const machineId = request.nextUrl.searchParams.get('machineId')?.trim() ?? '';
  if (!MACHINE_ID.test(machineId)) {
    return NextResponse.json({ success: false, error: 'Invalid machineId' }, { status: 400 });
  }

  try {
    const customer = await findCustomer(machineId);
    if (!customer) {
      return NextResponse.json(
        { success: false, status: 'DELETED', reason: 'Machine ID not registered in database' },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      status: customer.status || 'ACTIVE',
      expiryDate: customer.expiry_date,
      // Freshly signed on every check: clients holding old AES keys are
      // upgraded to the Ed25519 format automatically on their next sync.
      licenseKey: signLicense(customer.machine_id, customer.expiry_date),
    });
  } catch (err) {
    console.error('Failed to retrieve license status:', err);
    return NextResponse.json({ success: false, error: 'Status check failed' }, { status: 500 });
  }
}
