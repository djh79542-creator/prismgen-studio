// API配置文件 - 统一管理API基础URL

/**
 * 动态获取API基础URL，支持局域网访问
 * 优先使用环境变量配置，如果没有配置则使用动态检测
 */
// 去除环境变量值两端的单/双引号并裁剪空格
const unwrapEnvValue = (v?: string): string | undefined => {
  const s = (v ?? '').trim();
  if (!s) return undefined;
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
};

export const resolveApiOrigin = (): string => {
  // 优先使用环境变量配置（去除可能的引号）
  const envBase = unwrapEnvValue(process.env.PRISM_API_BASE_URL);
  if (envBase) {
    return envBase;
  }

  // 在开发环境下，尝试使用当前页面的hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    // 合并后统一使用 7008 端口
    return `http://${hostname}:7008`;
  }
  // 服务端渲染或其他情况下的fallback
  return 'http://localhost:7008';
};

// 导出API基础URL常量
export const PRISM_API_BASE_URL = resolveApiOrigin();

// Token管理
const TOKEN_KEY = 'prism.session.token';

export const bearerStore = {
  // 获取token
  getToken: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  },

  // 设置token
  setToken: (token: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  // 删除token
  removeToken: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  // 检查token是否存在且有效（未过期）
  hasToken: (): boolean => {
    const token = bearerStore.getToken();
    if (!token) {
      return false;
    }

    try {
      // 解码JWT token检查过期时间
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);

      // 如果token已过期，清除它
      if (payload.exp && payload.exp < currentTime) {
        bearerStore.removeToken();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('prism.session.active');
          localStorage.removeItem('prism.session.account');
        }
        return false;
      }

      return true;
    } catch (error) {
      // 如果token格式无效，清除它
      bearerStore.removeToken();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('prism.session.active');
        localStorage.removeItem('prism.session.account');
      }
      return false;
    }
  }
};

// API请求配置
export const jsonAuthHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = bearerStore.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

// 创建带token的FormData请求头
export const formAuthHeaders = (): HeadersInit => {
  const headers: HeadersInit = {};

  const token = bearerStore.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

// API请求封装（使用相对路径，通过 Vite 代理）
export const authorizedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const isFormData = options.body instanceof FormData;

  const defaultHeaders = isFormData ? formAuthHeaders() : jsonAuthHeaders();

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  // 使用相对路径，让 Vite 代理处理
  const response = await fetch(url, config);

  // 如果返回401或403，说明token无效或已过期，清除所有登录状态
  if (response.status === 401 || response.status === 403) {
    bearerStore.removeToken();
    // 清除localStorage中的登录状态
    if (typeof window !== 'undefined') {
      localStorage.removeItem('prism.session.active');
      localStorage.removeItem('prism.session.account');
    }
    // 触发自定义事件通知应用token已过期
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('prism:session-expired'));
    }
  }

  return response;
};

// 登录API（使用相对路径，通过 Vite 代理）
export const signInRequest = async (username: string, password: string) => {
  const response = await fetch('/api/session/sign-in', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '登录失败');
  }

  const data = await response.json();

  // 保存token
  if (data.token) {
    bearerStore.setToken(data.token);
  }

  return data;
};
