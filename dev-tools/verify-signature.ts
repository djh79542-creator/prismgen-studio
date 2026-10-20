import 'dotenv/config';
import dotenv from 'dotenv';
import { buildVolcAuthorization } from '../src/toolkit/volc-signature';

// Load .env.local explicitly to ensure local testing picks correct AK/SK
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: envFile, override: true });

function safe(v?: string): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

async function main() {
  const apiBase = safe(process.env.RASTER_API_HOST) || 'https://visual.volcengineapi.com';
  const action = safe(process.env.RASTER_SUBMIT_ACTION) || 'CVSync2AsyncSubmitTask';
  const version = safe(process.env.RASTER_SUBMIT_VERSION) || '2022-08-31';
  const region = safe(process.env.RASTER_REGION) || 'cn-north-1';
  const serviceName = safe(process.env.RASTER_SERVICE) || 'visual';
  const accessKeyId = safe(process.env.RASTER_ACCESS_KEY_ID);
  const secretAccessKey = safe(process.env.RASTER_SECRET_ACCESS_KEY);

  if (!accessKeyId || !secretAccessKey) {
    console.error('[verify-signature] Missing AK/SK. Please set RASTER_ACCESS_KEY_ID and RASTER_SECRET_ACCESS_KEY');
    process.exit(2);
  }

  // Minimal, plausible payload; signature validation should pass regardless of business validation
  const payload = {
    req_key: 'jimeng_t2i_v40',
    prompt: 'signature test',
    image_urls: [
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' // tiny placeholder; may cause business error but not signature error
    ],
  };

  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const { authorization, xDate } = buildVolcAuthorization({
    method: 'POST',
    baseUrl: apiBase,
    path: '/',
    query: { Action: action, Version: version },
    headers,
    body: JSON.stringify(payload),
    accessKeyId,
    secretAccessKey,
    region,
    serviceName,
    needSignHeaderKeys: ['host', 'x-date', 'content-type'],
  });

  headers = { ...headers, Authorization: authorization, 'X-Date': xDate };

  const url = new URL(apiBase);
  url.searchParams.set('Action', action);
  url.searchParams.set('Version', version);

  console.log('[verify-signature] Request', {
    url: url.toString(),
    method: 'POST',
    xDate,
    authLength: authorization.length,
    signedHeaders: Object.keys(headers).sort(),
    authorization:authorization,
    x_date:xDate
  });

  try {
    const resp = await fetch(url.toString(), { method: 'POST', headers, body: JSON.stringify(payload) });
    const text = await resp.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    const code = json?.ResponseMetadata?.Error?.Code;
    const codeN = json?.ResponseMetadata?.Error?.CodeN;
    const message = json?.ResponseMetadata?.Error?.Message;

    if (code === 'SignatureDoesNotMatch') {
      console.error('[verify-signature] FAIL: SignatureDoesNotMatch', { status: resp.status, codeN, message });
      process.exit(1);
    }

    console.log('[verify-signature] OK: signature accepted', { status: resp.status, code, codeN, message });
    process.exit(0);
  } catch (err: any) {
    console.error('[verify-signature] Request error', err?.message || err);
    process.exit(3);
  }
}

main();