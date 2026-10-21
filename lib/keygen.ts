import crypto from 'crypto';

// Ed25519 licence signing. The private key lives only in this server's env
// (LICENSE_PRIVATE_KEY, base64 PKCS#8 DER); the desktop app ships just the
// public key, so keys can no longer be minted from the app's own code.
// Format must match passport-size-photo/electron/license.js:
//   base64url("machineId|expiryISO") + "." + base64url(signature)

let cached: crypto.KeyObject | null = null;
function privateKey(): crypto.KeyObject {
  if (cached) return cached;
  const b64 = process.env.LICENSE_PRIVATE_KEY;
  if (!b64) throw new Error('LICENSE_PRIVATE_KEY is not set');
  cached = crypto.createPrivateKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'pkcs8' });
  return cached;
}

const norm = (s: string) => s.trim().toLowerCase();

export function signLicense(machineId: string, expirationDate: string): string {
  const payload = Buffer.from(`${norm(machineId)}|${expirationDate}`);
  return `${payload.toString('base64url')}.${crypto.sign(null, payload, privateKey()).toString('base64url')}`;
}

export function verifyLicense(licenseKey: string): { machineId: string; expirationDate: string } {
  const [p, s] = licenseKey.trim().split('.');
  if (!p || !s) throw new Error('Invalid license key format');
  const payload = Buffer.from(p, 'base64url');
  if (!crypto.verify(null, payload, crypto.createPublicKey(privateKey()), Buffer.from(s, 'base64url'))) {
    throw new Error('License key signature is invalid');
  }
  const text = payload.toString('utf8');
  const bar = text.indexOf('|');
  if (bar < 1) throw new Error('Invalid license key payload');
  return { machineId: text.slice(0, bar), expirationDate: text.slice(bar + 1) };
}
