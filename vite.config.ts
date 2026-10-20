import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

const API_ORIGIN = 'http://localhost:7008';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    // 浏览器侧读不到 process.env，这里把需要暴露的两项在构建期注入
    define: {
      'process.env.PRISM_MODELHUB_KEY': JSON.stringify(env.PRISM_MODELHUB_KEY ?? ''),
      'process.env.PRISM_API_BASE_URL': JSON.stringify(env.PRISM_API_BASE_URL ?? ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5388,
      host: '0.0.0.0',
      cors: true,
      proxy: {
        // 开发态统一走本地接口进程，避开跨域
        '/api': {
          target: API_ORIGIN,
          changeOrigin: true,
        },
        // 用户上传与生成物的静态目录
        '/media': {
          target: API_ORIGIN,
          changeOrigin: true,
        },
      },
    },
  };
});
