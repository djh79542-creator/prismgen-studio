import { createHmac, createHash } from 'crypto';

// 不参与加签过程的 header key
const HEADER_KEYS_TO_IGNORE = new Set([
  'authorization',
  'content-length',
  'user-agent',
  'presigned-expires',
  'expect',
]);

export interface SignParams {
  method: string;
  baseUrl: string;
  path?: string; // default '/'
  query?: Record<string, string | number | null | undefined | string[]>;
  headers?: Record<string, string>;
  body?: string | Buffer;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  serviceName: string;
  needSignHeaderKeys?: string[];
}

export function buildVolcAuthorization(params: SignParams): { authorization: string; xDate: string } {
  const {
    method,
    baseUrl,
    path = '/',
    query = {},
    headers: originHeaders = {},
    body,
    accessKeyId,
    secretAccessKey,
    region,
    serviceName,
    needSignHeaderKeys = [],
  } = params;

  const url = new URL(baseUrl);
  // 统一构建并补齐必要头
  const headers: Record<string, string> = { ...originHeaders };
  const xDate = headers['X-Date'] || getDateTimeNow();
  headers['X-Date'] = xDate;
  headers['host'] = url.host; // host 必须参与签名，但无需手动发送

  // 创建规范化请求
  const [signedHeaders, canonicalHeaders] = getSignHeaders(headers, needSignHeaderKeys);
  const canonicalQueryString = queryParamsToString(query) || '';
  const payloadHash = body ? getBodySha(body) : hash('');
  const canonicalRequest = [
    method.toUpperCase(),
    path,
    canonicalQueryString,
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // 创建待签名字符串
  const date = xDate.substring(0, 8); // YYYYMMDD
  const credentialScope = `${date}/${region}/${serviceName}/request`;
  const stringToSign = `HMAC-SHA256\n${xDate}\n${credentialScope}\n${hash(canonicalRequest)}`;

  // 计算签名
  const kDate = hmac(secretAccessKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, serviceName);
  const kSigning = hmac(kService, 'request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  const authorization = `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { authorization, xDate };
}

function hmac(secret: string | Buffer, s: string): Buffer {
  return createHmac('sha256', secret).update(s, 'utf8').digest();
}

function hash(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export function queryParamsToString(params: Record<string, any>): string {
  // Strict RFC3986 encoding and ASCII sorting of query params
  const keys = Object.keys(params).filter((k) => typeof params[k] !== 'undefined' && params[k] !== null).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const val = params[key];
    const kEnc = encodeRFC3986(key);
    if (Array.isArray(val)) {
      const sortedVals = val.map((v) => encodeRFC3986(String(v))).sort();
      for (const vEnc of sortedVals) {
        parts.push(`${kEnc}=${vEnc}`);
      }
    } else {
      parts.push(`${kEnc}=${encodeRFC3986(String(val))}`);
    }
  }
  return parts.join('&');
}

function getSignHeaders(originHeaders: Record<string, string>, needSignHeaders?: string[]): [string, string] {
  function trimHeaderValue(header: any) {
    return header?.toString?.().trim().replace(/\s+/g, ' ') ?? '';
  }

  let h = Object.keys(originHeaders);
  // 根据 needSignHeaders 过滤
  if (Array.isArray(needSignHeaders)) {
    const needSignSet = new Set([...needSignHeaders, 'x-date', 'host'].map((k) => k.toLowerCase()));
    h = h.filter((k) => needSignSet.has(k.toLowerCase()));
  }
  // 根据 ignore headers 过滤
  h = h.filter((k) => !HEADER_KEYS_TO_IGNORE.has(k.toLowerCase()));
  const signedHeaderKeys = h
    .slice()
    .map((k) => k.toLowerCase())
    .sort()
    .join(';');
  const canonicalHeaders = h
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    .map((k) => `${k.toLowerCase()}:${trimHeaderValue(originHeaders[k])}`)
    .join('\n');
  return [signedHeaderKeys, canonicalHeaders];
}

function encodeRFC3986(str: string): string {
  // Follow Volcengine RFC3986 encoding rules: use encodeURIComponent, then encode ! ' ( ) *
  try {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  } catch (e) {
    return '';
  }
}

export function getDateTimeNow(): string {
  const now = new Date();
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

export function getBodySha(body: string | Buffer): string {
  const h = createHash('sha256');
  if (typeof body === 'string') {
    h.update(body, 'utf8');
  } else {
    h.update(body);
  }
  return h.digest('hex');
}
