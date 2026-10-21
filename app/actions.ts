'use server';

import { cookies } from 'next/headers';
import crypto from 'crypto';
import { sessionToken } from '@/lib/auth';

/**
 * Validates the admin password and sets an HTTP-only session cookie.
 */
export async function login(password: string) {
  // Fail closed: no silent 'photoadmin' fallback when the env var is missing.
  const adminPassword = process.env.ADMIN_PASSWORD;
  const given = Buffer.from(String(password));
  const expected = Buffer.from(adminPassword ?? '');
  if (!adminPassword || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { error: 'Invalid admin credentials' };
  }

  const token = sessionToken(adminPassword);

  const cookieStore = await cookies();
  cookieStore.set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 day session
    path: '/',
  });

  return { success: true };
}

/**
 * Destroys the admin session cookie and logs out.
 */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  return { success: true };
}
