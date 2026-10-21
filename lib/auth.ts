import crypto from 'crypto';
import { cookies } from 'next/headers';

export const sessionToken = (password: string) => crypto.createHash('sha256').update(password).digest('hex');

/**
 * Server actions are public POST endpoints; proxy.ts only guards page routes.
 * Every dashboard action calls this first — otherwise anyone could mint
 * licences or flip customer status without logging in.
 */
export async function requireAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  const session = (await cookies()).get('admin_session')?.value ?? '';
  const expected = password ? sessionToken(password) : '';
  if (!expected || session.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(session), Buffer.from(expected))) {
    throw new Error('Unauthorized');
  }
}
