import React from 'react';
import crypto from 'crypto';
import zlib from 'zlib';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Camera, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Building, 
  Phone, 
  Cpu, 
  Key,
  IndianRupee,
  Activity
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  searchParams: Promise<{
    p?: string;
    s?: string;
  }>;
}

interface DecodedLicense {
  id: string;
  l: string; // lab_name
  o: string; // owner_name
  p: string; // phone
  m: string; // machine_id
  e: string; // expiry_date
  k: string; // license_key
  s: string; // status
  pr?: number; // price
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const p = params.p;
  const s = params.s;

  const SECRET_SALT = process.env.LICENSE_SECRET_SALT || 'Musharraf_709121SaltKey';

  let isValid = false;
  let license: DecodedLicense | null = null;
  let errorMsg = '';

  if (!p || !s) {
    isValid = false;
    errorMsg = 'Missing cryptographic verification payload or digital signature.';
  } else {
    try {
      // Recompute signature and compare first 16 characters
      const expectedSignatureFull = crypto.createHmac('sha256', SECRET_SALT).update(p).digest('hex');
      const expectedSignature = expectedSignatureFull.substring(0, 16);
      isValid = expectedSignature === s;

      if (isValid) {
        const buffer = Buffer.from(p, 'base64');
        const decompressed = zlib.inflateSync(buffer);
        const jsonStr = decompressed.toString('utf8');
        license = JSON.parse(jsonStr);
      } else {
        errorMsg = 'Digital signature mismatch. This document has been tampered with or is fake.';
      }
    } catch (e: any) {
      isValid = false;
      errorMsg = 'Failed to decode license payload. Mismatched structures.';
    }
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans overflow-x-hidden p-4 md:p-8">
      {/* Background Glowing Blurs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] rounded-full bg-violet-500/5 blur-[150px] pointer-events-none" />

      <div className="max-w-3xl w-full mx-auto space-y-6 z-10">
        {/* Header Branding */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/5">
              <Camera className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-50 to-zinc-300">
                Photo Studio Suite Portal
              </h1>
              <p className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase">License Integrity Registry</p>
            </div>
          </div>
          <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2.5 py-1 rounded-full font-mono font-bold">
            v1.0 Secure Verifier
          </span>
        </div>

        {/* Verification Status Banner */}
        {isValid && license ? (
          <div className="backdrop-blur-md bg-emerald-950/15 border border-emerald-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <ShieldCheck className="h-24 w-24 text-emerald-400" />
            </div>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-black text-emerald-400 tracking-tight">License Sheet Verified Successfully</h2>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  This license record is authentic and matches the original studio registry record. The document integrity is cryptographically validated using HMAC-SHA256 protocol.
                </p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono font-extrabold text-emerald-400 rounded-lg">
                  License UUID: {license.id}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="backdrop-blur-md bg-rose-950/15 border border-rose-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <ShieldAlert className="h-24 w-24 text-rose-400" />
            </div>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-black text-rose-400 tracking-tight">Verification Failed</h2>
                <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">
                  {errorMsg || 'The digital signature is invalid. This document is either forged, tampered, or did not originate from an authorized Photo Studio Suite administration gateway.'}
                </p>
                <p className="text-[10px] text-zinc-500 mt-3 font-semibold uppercase tracking-wider">
                  Caution: Do not activate or license systems running on details of unverified documents.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Report Details View (Only if Valid) */}
        {isValid && license && (
          <div className="space-y-6">
            {/* Metadata Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Studio Details */}
              <div className="backdrop-blur-md bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-3.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 border-b border-zinc-800/50 pb-2">
                  <Building className="h-4 w-4 text-indigo-400" />
                  Studio Profile
                </h3>
                <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                  <span className="text-zinc-500 font-semibold">Studio Name:</span>
                  <span className="text-zinc-200 font-bold">{license.l}</span>

                  <span className="text-zinc-500 font-semibold font-sans">Owner / Director:</span>
                  <span className="text-zinc-200 font-bold">{license.o}</span>

                  <span className="text-zinc-500 font-semibold">Contact Phone:</span>
                  <span className="text-zinc-200 font-bold">{license.p}</span>
                </div>
              </div>

              {/* License Details */}
              <div className="backdrop-blur-md bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-3.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 border-b border-zinc-800/50 pb-2">
                  <Cpu className="h-4 w-4 text-violet-400" />
                  Hardware & Subscription
                </h3>
                <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                  <span className="text-zinc-500 font-semibold">Hardware Machine ID:</span>
                  <span className="text-zinc-200 font-mono font-bold">{license.m}</span>

                  <span className="text-zinc-500 font-semibold">Expiry Date:</span>
                  <span className="text-zinc-200 font-bold">
                    {new Date(license.e).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>

                  <span className="text-zinc-500 font-semibold">Pricing Structure:</span>
                  <span className="text-zinc-200 font-bold flex items-center gap-0.5">
                    <IndianRupee className="h-3.5 w-3.5 text-emerald-400" />
                    {(license.pr ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Cryptographic License Key Audit */}
            <div className="backdrop-blur-md bg-zinc-900/25 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Key className="h-4 w-4 text-cyan-400" />
                Cryptographic Key Verification
              </h3>
              
              <div className="space-y-3 text-xs">
                <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-2">
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">License Key String</div>
                  <div className="font-mono text-zinc-300 break-all select-all">{license.k}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-zinc-950/60 border border-zinc-900 p-3 rounded-xl flex items-center gap-2.5">
                    <Activity className="h-5 w-5 text-emerald-400" />
                    <div>
                      <div className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Current Status</div>
                      <div className="font-bold text-zinc-200">{license.s}</div>
                    </div>
                  </div>

                  <div className="bg-zinc-950/60 border border-zinc-900 p-3 rounded-xl flex items-center gap-2.5">
                    <ShieldCheck className="h-5 w-5 text-indigo-400" />
                    <div>
                      <div className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Digital Signature</div>
                      <div className="font-mono text-emerald-400 font-bold">HMAC-SHA256 MATCHED</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Audit Message */}
        <footer className="pt-8 border-t border-zinc-900 text-center text-[10px] text-zinc-650 leading-relaxed font-semibold">
          <p>© {new Date().getFullYear()} Photo Studio Suite Secure Verification Portal.</p>
          <p className="mt-1">Cryptographic hashes generated using Ed25519 licence keys and HMAC-SHA256 report signatures.</p>
        </footer>
      </div>
    </div>
  );
}
