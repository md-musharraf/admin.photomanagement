'use server';

import { supabase } from '@/lib/supabaseClient';
import { encrypt, decrypt } from '@/lib/keygen';
import { revalidatePath } from 'next/cache';
import { readCustomers, writeCustomers, readUpdates, writeUpdates, SoftwareUpdate, Customer } from '@/lib/fileDb';

// Check if we are running in demo mode with dummy credentials
const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy') ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('dummy');

// Initialize licenses in fileDb if they are missing license keys
try {
  const current = readCustomers();
  let updated = false;
  current.forEach((c) => {
    if (!c.license_key) {
      c.license_key = encrypt(c.machine_id, c.expiry_date);
      updated = true;
    }
    if (!c.status) {
      c.status = 'ACTIVE';
      updated = true;
    }
  });
  if (updated) {
    writeCustomers(current);
  }
} catch (e) {
  console.error('Error initializing default file DB keys:', e);
}

/**
 * Checks if the system is running in demo/mock database fallback mode.
 */
export async function checkDemoMode() {
  return isDemoMode;
}

/**
 * Fetches all customers from Supabase or returns mock file data.
 */
export async function fetchCustomers() {
  if (isDemoMode) {
    const list = readCustomers();
    const sorted = [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return { success: true, data: sorted, isDemo: true, isStatusColumnMissing: false };
  }

  try {
    // Check if status column exists in Supabase photo_customers table
    let isStatusColumnMissing = false;
    const { error: testError } = await supabase
      .from('photo_customers')
      .select('status')
      .limit(1);
    
    if (testError && (testError.message.includes('column') || testError.message.includes('status') || testError.message.includes('does not exist'))) {
      isStatusColumnMissing = true;
    }

    const { data, error } = await supabase
      .from('photo_customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching customers:', error);
      return { error: error.message };
    }

    // Map to guarantee status is always present (merging local fileDb status for Supabase backup sync)
    const fileList = readCustomers();
    const mapped = (data || []).map((c: any) => {
      const fileCust = fileList.find(fc => fc.id === c.id || fc.machine_id === c.machine_id);
      return {
        ...c,
        status: c.status || fileCust?.status || 'ACTIVE',
        price: c.price ?? fileCust?.price ?? 0
      };
    }) as Customer[];

    // Sync remote data to the offline local file db
    if (mapped.length > 0) {
      writeCustomers(mapped);
    }

    return { success: true, data: mapped, isDemo: false, isStatusColumnMissing };
  } catch (err: any) {
    console.error('Error fetching customers:', err);
    return { error: err.message || 'An unexpected error occurred' };
  }
}

/**
 * Creates a new customer with a generated license key.
 */
export async function createCustomer(formData: {
  labName: string;
  ownerName: string;
  phone: string;
  machineId: string;
  planDuration: string;
  price: number;
}) {
  const { labName, ownerName, phone, machineId, planDuration, price } = formData;

  if (!labName || !ownerName || !phone || !machineId || !planDuration) {
    return { error: 'All fields are required' };
  }

  const expiry = new Date();
  if (planDuration === '7 Days (Trial)') {
    expiry.setDate(expiry.getDate() + 7);
  } else if (planDuration === '1 Month') {
    expiry.setMonth(expiry.getMonth() + 1);
  } else if (planDuration === '6 Months') {
    expiry.setMonth(expiry.getMonth() + 6);
  } else if (planDuration === '2 Years') {
    expiry.setFullYear(expiry.getFullYear() + 2);
  } else {
    expiry.setFullYear(expiry.getFullYear() + 1);
  }
  const expiryStr = expiry.toISOString();
  const licenseKey = encrypt(machineId, expiryStr);

  if (isDemoMode) {
    const list = readCustomers();
    const newCust: Customer = {
      id: `mock-uuid-${Date.now()}`,
      created_at: new Date().toISOString(),
      lab_name: labName,
      owner_name: ownerName,
      phone,
      machine_id: machineId,
      expiry_date: expiryStr,
      license_key: licenseKey,
      status: 'ACTIVE',
      price: price || 0,
    };
    list.push(newCust);
    writeCustomers(list);
    revalidatePath('/dashboard');
    return { success: true, data: newCust, isDemo: true };
  }

  try {
    const { data, error } = await supabase
      .from('photo_customers')
      .insert([
        {
          lab_name: labName,
          owner_name: ownerName,
          phone,
          machine_id: machineId,
          expiry_date: expiryStr,
          license_key: licenseKey,
          status: 'ACTIVE',
          price: price || 0
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error inserting customer:', error);
      return { error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true, data: data?.[0], isDemo: false };
  } catch (err: any) {
    console.error('Error creating customer:', err);
    return { error: err.message || 'An unexpected error occurred' };
  }
}

/**
 * Renews a customer's license by extending it by 1 year and regenerating the key.
 */
export async function renewLicense(id: string, machineId: string) {
  if (!id || !machineId) {
    return { error: 'Customer ID and Machine ID are required' };
  }

  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  const expiryStr = expiry.toISOString();
  const licenseKey = encrypt(machineId, expiryStr);

  if (isDemoMode) {
    const list = readCustomers();
    const index = list.findIndex((c) => c.id === id);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        expiry_date: expiryStr,
        license_key: licenseKey,
      };
      writeCustomers(list);
      revalidatePath('/dashboard');
      return { success: true, isDemo: true };
    }
    return { error: 'Customer not found' };
  }

  try {
    const { error } = await supabase
      .from('photo_customers')
      .update({
        expiry_date: expiryStr,
        license_key: licenseKey,
      })
      .eq('id', id);

    if (error) {
      console.error('Supabase error renewing license:', error);
      return { error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true, isDemo: false };
  } catch (err: any) {
    console.error('Error renewing license:', err);
    return { error: err.message || 'An unexpected error occurred' };
  }
}

/**
 * Deletes a customer.
 */
export async function deleteCustomer(id: string) {
  if (!id) {
    return { error: 'Customer ID is required' };
  }

  if (isDemoMode) {
    let list = readCustomers();
    list = list.filter((c) => c.id !== id);
    writeCustomers(list);
    revalidatePath('/dashboard');
    return { success: true, isDemo: true };
  }

  try {
    const { error } = await supabase.from('photo_customers').delete().eq('id', id);

    if (error) {
      console.error('Supabase error deleting customer:', error);
      return { error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true, isDemo: false };
  } catch (err: any) {
    console.error('Error deleting customer:', err);
    return { error: err.message || 'An unexpected error occurred' };
  }
}

/**
 * Updates a customer's license status (ACTIVE | PAUSED | STOPPED)
 */
export async function updateCustomerStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'STOPPED') {
  if (!id || !status) {
    return { error: 'Customer ID and status are required' };
  }

  if (isDemoMode) {
    const list = readCustomers();
    const index = list.findIndex((c) => c.id === id);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        status: status,
      };
      writeCustomers(list);
      revalidatePath('/dashboard');
      return { success: true, isDemo: true };
    }
    return { error: 'Customer not found' };
  }

  try {
    // Always update local fileDb status for robust synchronization
    const list = readCustomers();
    const index = list.findIndex((c) => c.id === id);
    if (index !== -1) {
      list[index].status = status;
      writeCustomers(list);
    } else {
      // Find details from Supabase to store locally in fileDb fallback
      const { data: dbCust } = await supabase.from('photo_customers').select('*').eq('id', id).maybeSingle();
      if (dbCust) {
        list.push({
          id: dbCust.id,
          created_at: dbCust.created_at,
          lab_name: dbCust.lab_name,
          owner_name: dbCust.owner_name,
          phone: dbCust.phone,
          machine_id: dbCust.machine_id,
          expiry_date: dbCust.expiry_date,
          license_key: dbCust.license_key,
          status: status,
          price: dbCust.price ?? 0
        });
        writeCustomers(list);
      }
    }

    const { error } = await supabase
      .from('photo_customers')
      .update({ status: status })
      .eq('id', id);

    if (error) {
      console.error('Supabase error updating status:', error);
      return { error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true, isDemo: false };
  } catch (err: any) {
    console.error('Error updating status:', err);
    return { error: err.message || 'An unexpected error occurred' };
  }
}

/**
 * Decrypts a license key and returns the decrypted payload parameters.
 */
export async function verifyLicenseKey(licenseKey: string) {
  try {
    const decrypted = decrypt(licenseKey);
    return { success: true, machineId: decrypted.machineId, expirationDate: decrypted.expirationDate };
  } catch (err: any) {
    return { error: err.message || 'Verification failed: invalid key structure' };
  }
}

/**
 * Pushes a new software update version.
 */
export async function pushSoftwareUpdate(formData: {
  version: string;
  title: string;
  releaseNotes: string;
  downloadUrl: string;
  isCritical: boolean;
}) {
  const { version, title, releaseNotes, downloadUrl, isCritical } = formData;
  if (!version || !title || !releaseNotes || !downloadUrl) {
    return { error: 'All update fields are required' };
  }

  try {
    const updates = readUpdates();
    const newUpdate: SoftwareUpdate = {
      version,
      title,
      releaseNotes,
      downloadUrl,
      isCritical,
      publishedAt: new Date().toISOString(),
    };
    // Prepend so that the latest version is first
    updates.unshift(newUpdate);
    writeUpdates(updates);
    revalidatePath('/dashboard');
    return { success: true, data: newUpdate };
  } catch (err: any) {
    console.error('Failed to push update:', err);
    return { error: err.message || 'Failed to save update' };
  }
}

/**
 * Fetches all updates.
 */
export async function fetchSoftwareUpdates() {
  try {
    const updates = readUpdates();
    return { success: true, data: updates };
  } catch (err: any) {
    return { error: err.message || 'Failed to fetch updates' };
  }
}

/**
 * Generates a cryptographically signed verification link containing the license/customer data payload.
 */
export async function generateVerificationLink(customer: Customer) {
  try {
    const crypto = await import('crypto');
    const zlib = await import('zlib');

    const SECRET_SALT = process.env.LICENSE_SECRET_SALT || 'Musharraf_709121SaltKey';

    // Build the compacted license report payload
    const report = {
      id: customer.id,
      l: customer.lab_name,
      o: customer.owner_name,
      p: customer.phone,
      m: customer.machine_id,
      e: customer.expiry_date,
      k: customer.license_key,
      s: customer.status,
      pr: customer.price
    };

    const jsonStr = JSON.stringify(report);
    // Compress string and format as base64
    const compressed = zlib.deflateSync(Buffer.from(jsonStr, 'utf8'));
    const p = compressed.toString('base64');

    // Create HMAC-SHA256 signature and take the first 16 characters
    const signatureFull = crypto.createHmac('sha256', SECRET_SALT).update(p).digest('hex');
    const s = signatureFull.substring(0, 16);

    // Return the query parameters
    return { success: true, queryParams: `?p=${encodeURIComponent(p)}&s=${encodeURIComponent(s)}` };
  } catch (err: any) {
    console.error('Failed to generate verification link:', err);
    return { error: err.message || 'Verification link generation failed' };
  }
}

