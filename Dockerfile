# 一体化镜像：前端静态产物由 nginx 提供，接口进程由 supervisor 拉起
FROM node:20-alpine AS console-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

# 接口进程构建
FROM node:20-alpine AS api-builder

WORKDIR /app

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build
RUN npm prune --omit=dev

# 运行镜像
FROM nginx:alpine

RUN apk add --no-cache nodejs npm supervisor

WORKDIR /app

# 前端产物
COPY --from=console-builder /app/dist /usr/share/nginx/html

# 接口产物
COPY --from=api-builder /app/node_modules ./node_modules
COPY --from=api-builder /app/dist ./dist
COPY --from=api-builder /app/package*.json ./

# supervisor 同时托管 nginx 与接口进程
RUN mkdir -p /etc/supervisor.d && \
    echo '[supervisord]' > /etc/supervisor.d/services.ini && \
    echo 'nodaemon=true' >> /etc/supervisor.d/services.ini && \
    echo 'user=root' >> /etc/supervisor.d/services.ini && \
    echo 'logfile=/dev/null' >> /etc/supervisor.d/services.ini && \
    echo 'logfile_maxbytes=0' >> /etc/supervisor.d/services.ini && \
    echo 'pidfile=/var/run/supervisord.pid' >> /etc/supervisor.d/services.ini && \
    echo '' >> /etc/supervisor.d/services.ini && \
    echo '[program:web]' >> /etc/supervisor.d/services.ini && \
    echo 'command=nginx -g "daemon off;"' >> /etc/supervisor.d/services.ini && \
    echo 'autostart=true' >> /etc/supervisor.d/services.ini && \
    echo 'autorestart=true' >> /etc/supervisor.d/services.ini && \
    echo 'priority=10' >> /etc/supervisor.d/services.ini && \
    echo 'stdout_logfile=/dev/stdout' >> /etc/supervisor.d/services.ini && \
    echo 'stdout_logfile_maxbytes=0' >> /etc/supervisor.d/services.ini && \
    echo 'stderr_logfile=/dev/stderr' >> /etc/supervisor.d/services.ini && \
    echo 'stderr_logfile_maxbytes=0' >> /etc/supervisor.d/services.ini && \
    echo '' >> /etc/supervisor.d/services.ini && \
    echo '[program:api]' >> /etc/supervisor.d/services.ini && \
    echo 'command=node /app/dist/index.js' >> /etc/supervisor.d/services.ini && \
    echo 'directory=/app' >> /etc/supervisor.d/services.ini && \
    echo 'autostart=true' >> /etc/supervisor.d/services.ini && \
    echo 'autorestart=true' >> /etc/supervisor.d/services.ini && \
    echo 'priority=20' >> /etc/supervisor.d/services.ini && \
    echo 'environment=NODE_ENV=production' >> /etc/supervisor.d/services.ini && \
    echo 'stdout_logfile=/dev/stdout' >> /etc/supervisor.d/services.ini && \
    echo 'stdout_logfile_maxbytes=0' >> /etc/supervisor.d/services.ini && \
    echo 'stderr_logfile=/dev/stderr' >> /etc/supervisor.d/services.ini && \
    echo 'stderr_logfile_maxbytes=0' >> /etc/supervisor.d/services.ini

# 媒体目录（上传件与生成件）
RUN mkdir -p /var/log/supervisor /app/media && \
    chown -R nginx:nginx /app/media

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor.d/services.ini"]
