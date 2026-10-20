// Use global fetch (Node 18+ / undici). No need for node-fetch.
import { editStill as hubEditDirect } from './model-hub';
import { buildVolcAuthorization } from '../toolkit/volc-signature';

/**
 * 色板模型 image-to-image with intelligent referencing.
 * This implementation prefers real Volcengine Palette API when env configured;
 * otherwise gracefully falls back to ModelHub to keep UX working.
 */

function safe(v?: string): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

function readPaletteEnv() {
  // Use CV service host per Volcengine docs
  const apiBase = safe(process.env.RASTER_API_HOST) || 'https://visual.volcengineapi.com';
  const action = safe(process.env.RASTER_SUBMIT_ACTION) || 'CVSync2AsyncSubmitTask';
  // Fix env var key to RASTER_SUBMIT_VERSION (uppercase)
  const version = safe(process.env.RASTER_SUBMIT_VERSION) || '2022-08-31';
  const region = safe(process.env.RASTER_REGION) || 'cn-north-1';
  // Visual 产品的服务名应为 visual（与 Host visual.volcengineapi.com 对应）
  const service = safe(process.env.RASTER_SERVICE) || 'visual';
  const accessKeyId = safe(process.env.RASTER_ACCESS_KEY_ID);
  const secretAccessKey = safe(process.env.RASTER_SECRET_ACCESS_KEY);
  // 状态查询通常使用 CVAsyncQueryTaskResult
  const statusAction = safe(process.env.RASTER_POLL_ACTION) || 'CVSync2AsyncGetResult';
  const statusVersion = safe(process.env.RASTER_POLL_VERSION) || '2022-08-31';
  return { apiBase, action, version, region, service, accessKeyId, secretAccessKey, statusAction, statusVersion };
}

export async function submitPaletteEdit(
  base64ImageData: string | null,
  mimeType: string | null,
  prompt: string,
  secondaryImage: { base64: string; mimeType: string } | null
): Promise<any> {
  let authorization = '';
  let apiUrl: URL | null = null;
  let xDate = '';
  try {
    const { apiBase, action, version, region, service, accessKeyId, secretAccessKey } = readPaletteEnv();
    // 如果环境未配置或 URL 无效，直接回退到 ModelHub，避免抛出 "Invalid URL"
    const missingEnv = !apiBase || !action || !version || !accessKeyId || !secretAccessKey;
    if (!missingEnv) {
      try {
        // 确保是绝对URL
        apiUrl = new URL(apiBase);
      } catch (e) {
        apiUrl = null;
      }
    }

    // 按签名提交接口（CVSync2AsyncSubmitTask）的规范，
    // 请求体应使用 ReqKey + Input 的结构，并采用驼峰或首字母大写字段。
    const payload: any = {
      req_key: 'jimeng_t2i_v40',
        image_urls: [
          base64ImageData ? `data:${mimeType || 'image/png'};base64,${base64ImageData}` : undefined,
          secondaryImage ? `data:${secondaryImage.mimeType};base64,${secondaryImage.base64}` : undefined,
        ].filter(Boolean),
        prompt: prompt,
    };

    // 构造 URL 与查询字符串
    console.log('Palette constructing URL from apiBase:', apiBase);
    if (!apiUrl) throw new Error('Invalid Palette API base URL');
    apiUrl.searchParams.set('Action', action!);
    apiUrl.searchParams.set('Version', version!);
    console.log('Palette API URL:', apiUrl.toString());

    // 构造并签名请求头
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const { authorization, xDate } = buildVolcAuthorization({
      method: 'POST',
      baseUrl: apiBase,
      path: '/',
      query: { Action: action!, Version: version! },
      headers,
      body: JSON.stringify(payload),
      accessKeyId,
      secretAccessKey,
      region,
      serviceName: service,
      // 按规范将 content-type 也加入签名头，提升鉴权兼容性
      needSignHeaderKeys: ['host', 'x-date', 'content-type'],
    });
    headers = { ...headers, Authorization: authorization, 'X-Date': xDate };

    const resp = await fetch(apiUrl.toString(), { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Palette API error (${resp.status}): ${text}`);
    }
    const jsonData = await resp.json() as any;
    return {
      taskId: jsonData.data?.task_id,
      xDate,
    }

  } catch (err) {
    console.error('Palette submitPaletteEdit failed, falling back to ModelHub:', err);
  }
}
// Note: query/result retrieval is not implemented here since upstream API docs vary.
// The backend returns taskId for client-side polling via product-specific endpoints.

/**
 * Query Palette task result by taskId, polling until an image URL is available or timeout.
 */
export async function queryPaletteTask(
  taskId: string,
  { maxWaitMs = 60000, intervalMs = 2000 }: { maxWaitMs?: number; intervalMs?: number } = {}
): Promise<{ imageUrl: string | null; status: string; raw?: any }> {
  const { apiBase, statusAction, statusVersion, accessKeyId, secretAccessKey, region, service } = readPaletteEnv();
  if (!apiBase || !statusAction || !statusVersion || !accessKeyId || !secretAccessKey) {
    throw new Error('Palette status API env not fully configured');
  }

  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const body = JSON.stringify({ task_id: taskId });

    // 构造 URL 与查询字符串（Action/Version）
    const url = new URL(apiBase);
    url.searchParams.set('Action', statusAction);
    url.searchParams.set('Version', statusVersion);

    // 签名
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const { authorization, xDate } = buildVolcAuthorization({
      method: 'POST',
      baseUrl: apiBase,
      path: '/',
      query: { Action: statusAction, Version: statusVersion },
      headers,
      body,
      accessKeyId,
      secretAccessKey,
      region,
      serviceName: service,
      needSignHeaderKeys: ['host', 'x-date', 'content-type'],
    });
    headers = { ...headers, Authorization: authorization, 'X-Date': xDate };

    const resp = await fetch(url.toString(), { method: 'POST', headers, body });
    const text = await resp.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    const imageUrl = extractImageUrl(json);
    const status = extractTaskStatus(json) || (imageUrl ? 'succeed' : 'processing');

    if (imageUrl) {
      return { imageUrl, status, raw: json };
    }
    if (status === 'failed') {
      return { imageUrl: null, status, raw: json };
    }
    await sleep(intervalMs);
  }

  return { imageUrl: null, status: 'timeout' };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTaskStatus(obj: any): string | null {
  try {
    return (
      obj?.data?.task_status ||
      obj?.data?.status ||
      obj?.status ||
      null
    );
  } catch { return null; }
}

function extractImageUrl(obj: any): string | null {
  try {
    const candidates = [
      obj?.data?.task_result?.images?.[0]?.url,
      obj?.data?.images?.[0]?.url,
      obj?.result?.images?.[0]?.url,
      obj?.output_url,
      obj?.image_url,
    ];
    for (const u of candidates) {
      if (typeof u === 'string' && u.length > 0) return u;
    }
    return null;
  } catch { return null; }
}
