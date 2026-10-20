// Use global fetch available in Node 20+
import jwt from 'jsonwebtoken';


interface CreateTaskResponse {
  id?: string;
  status?: string;
  [key: string]: any;
}

interface StatusResponse {
  status?: string;
  // different providers may return different fields
  video_url?: string;
  url?: string;
  result?: { url?: string };
  output?: { url?: string };
  [key: string]: any;
}

// Read configuration at call-time to ensure env loaded after ESM imports
function getEnvConfig() {
  const safe = (v?: string) => {
    const s = (v ?? '').trim();
    // Strip surrounding single or double quotes to avoid invalid signature
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      return s.slice(1, -1);
    }
    return s;
  };
  const cfg = {
    BASE_URL: safe(process.env.MOTION_API_BASE),
    CREATE_PATH: safe(process.env.MOTION_CREATE_PATH),
    STATUS_PATH: safe(process.env.MOTION_STATUS_PATH),
    STATUS_PARAM: safe(process.env.MOTION_STATUS_QUERY),
    MOTION_KEY_ID: safe(process.env.MOTION_KEY_ID),
    MOTION_KEY_SECRET: safe(process.env.MOTION_KEY_SECRET),
    MOTION_WEBHOOK_URL: safe(process.env.MOTION_WEBHOOK_URL)
  };
  return cfg;
}

function normalizeBaseUrl(base: string): string {
  // ensure base has protocol and no trailing slash
  const trimmed = base.trim();
  let urlStr = trimmed.replace(/\/$/, '');
  // Validate URL early to avoid posting to root
  try {
    // new URL will throw if invalid
    // Allow hosts like https://api-beijing.klingai.com
    // Keep original string (without trailing slash)
    // eslint-disable-next-line no-new
    new URL(urlStr);
  } catch {
    throw new Error(`Invalid MOTION_API_BASE: ${trimmed}`);
  }
  return urlStr;
}

function joinUrl(base: string, path: string): string {
  const b = normalizeBaseUrl(base);
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}


// Cache Authorization token used when creating a task, keyed by task_id
const tokenByTaskId = new Map<string, string>();
let lastAuthorization: string | null = null;

 export async function mintMotionToken() {
  const { MOTION_KEY_ID, MOTION_KEY_SECRET } = getEnvConfig();
  if (!MOTION_KEY_ID || !MOTION_KEY_SECRET) {
    throw new Error('Motion AK/SK 未配置，请设置 MOTION_KEY_ID 与 MOTION_KEY_SECRET');
  }
  const payload = {
    'iss': MOTION_KEY_ID,
    'exp': Math.floor(Date.now() / 1000) + 1800, // 有效时间：当前时间 + 1800s (30分钟)
    'nbf': Math.floor(Date.now() / 1000) - 60, // 开始生效时间：当前时间 - 5秒
  };

  // Sign JWT with HS256 per Motion docs. Avoid custom header overrides.
  const token = jwt.sign(payload, MOTION_KEY_SECRET, { algorithm: 'HS256' });
  console.log('[motionEngine] jwtIssued', { exp: payload.exp, nbf: payload.nbf, length: token.length });
  return token;
}

export async function submitMotionJob(
  prompt: string,
  imageBase64: string,
  duration: number,
  motionBearer: string
): Promise<CreateTaskResponse> {
  const { BASE_URL, CREATE_PATH, MOTION_WEBHOOK_URL } = getEnvConfig();
  if (!BASE_URL || !CREATE_PATH) {
    throw new Error('Motion API not configured: set MOTION_API_BASE and MOTION_CREATE_PATH');
  }
  const url = joinUrl(BASE_URL, CREATE_PATH);
  const authorization = `Bearer ${motionBearer}`;
  const headers: Record<string, string> = {
    'Authorization': authorization,
    'Content-Type': 'application/json',
  };
  const body: Record<string, any> = {
    model_name: 'kling-v2-5-turbo',
    mode: 'std',
    prompt,
    duration: String(duration),
    callback_url: MOTION_WEBHOOK_URL
  };
  // 传入参考图像（Base64 无 data: 前缀）或尾帧
  if (imageBase64) {
    body.image = imageBase64;
  }
  console.log('[motionEngine] createTask', { url, duration: body.duration, imageBytes: imageBase64?.length ?? 0 });
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    // Do not leak JWT token in error path
    throw new Error(`Motion create task failed: ${resp.status} POST ${url}\n${text}`);
  }
  try {
    const raw = (await resp.json()) as CreateTaskResponse;
    const idCandidate =
      (raw as any).task_id ||
      (raw as any)?.data?.task_id;

    if (!idCandidate) {
      console.warn('[motionEngine] createTask succeeded but no id found in response shape:', raw);
    }
    // Store the Authorization used for this task id for later status queries
    if (idCandidate) {
      tokenByTaskId.set(String(idCandidate), authorization);
      lastAuthorization = authorization;
    }
    return { ...raw, id: idCandidate } as CreateTaskResponse;
  } catch (e) {
    console.error('[motionEngine] createTask parse error', e);
    throw new Error('Failed to parse Motion create task response');
  }
}

export async function loadMotionJob(generationId: string): Promise<{ status: string; videoUrl?: string; raw: StatusResponse }> {
  const { BASE_URL, STATUS_PATH } = getEnvConfig();
  if (!BASE_URL || !STATUS_PATH) {
    throw new Error('Motion API not configured: set MOTION_API_BASE and MOTION_STATUS_PATH');
  }
  const url = joinUrl(BASE_URL, `${STATUS_PATH}/${generationId}`);
  const cachedAuth = tokenByTaskId.get(String(generationId));
  if (!cachedAuth) {
    throw new Error('No stored Authorization for this task_id; create task in this process to inherit token');
  }
  const authorization = cachedAuth;
  const headers: Record<string, string> = {
    'Authorization': authorization,
    'Content-Type': 'application/json',
  };
  const resp = await fetch(url, { method: 'GET', headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Motion get status failed: ${resp.status} GET ${url}\n${text}`);
  }
  const raw = (await resp.json()) as StatusResponse;
  const payload = (raw as any).data || raw;
  const videoUrl = payload.task_result?.videos?.[0]?.url;
  const status = payload.task_status || (videoUrl ? 'completed' : 'generating');
  if (status === 'failed') {
    throw new Error((raw as any).task_status, (raw as any).task_status_msg);
  }
  console.log('[motionEngine] getStatus parsed', { status, hasVideo: !!videoUrl });
  return { status, videoUrl, raw };
}
