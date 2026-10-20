import axios from 'axios'

export const CONSOLE_TOKEN_KEY = 'prism.console.token';
export const CONSOLE_ACCOUNT_KEY = 'prism.console.account';
const SIGN_IN_PATH = '/console/sign-in';

const api = axios.create({
  // 开发态走相对路径，由 Vite 代理转发到接口进程；跨域部署时用 VITE_CONSOLE_API_BASE 覆盖
  baseURL: import.meta.env.VITE_CONSOLE_API_BASE || '/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(CONSOLE_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      try {
        localStorage.removeItem(CONSOLE_TOKEN_KEY);
        localStorage.removeItem(CONSOLE_ACCOUNT_KEY);
      } catch {}
      // 会话失效后回到管理台登录页
      if (typeof window !== 'undefined') {
        window.location.href = SIGN_IN_PATH;
      }
    }
    const msg = err?.response?.data?.message || err.message;
    return Promise.reject(new Error(msg));
  },
);

export default api;
