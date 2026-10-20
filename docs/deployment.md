# 部署说明

两种玩法：本地两个进程跑开发联调，或者一个容器（nginx + 接口进程）加一个 MySQL 容器跑演示环境。

## 一、本地开发

```bash
npm install
npm --prefix server install

cp .env.example .env.local                 # 前端，可留空
cp server/.env.example server/.env.local   # 接口，必填会话密钥与数据库
mysql -u root -p < deployments/mysql/init.sql

npm run api    # 接口 http://localhost:7008
npm run dev    # 前台 http://localhost:5388
```

开发期不需要配跨域：`vite.config.ts` 把 `/api` 与 `/media` 代理到 `http://localhost:7008`。

常用校验：

```bash
npm run check                        # 前台类型检查
npm run build                        # 前台产物
npm --prefix server run check        # 接口类型检查
npm --prefix server run build        # 接口产物 → server/dist
```

## 二、容器化（推荐演示）

见 [../deployments/README.md](../deployments/README.md)，最短路径：

```bash
cd deployments
cp .env.example .env      # 填三个 :? 必填项与上游凭据
docker compose up -d --build
```

镜像内部由 supervisor 托管两个进程：`web`（nginx，对外 80）和 `api`（node，内部 7008）。nginx 站点配置在 `deployments/nginx/default.conf`，负责 SPA 兜底、`/api/` 与 `/media/` 反代、静态资源长缓存。

## 三、进程与端口对照

| 组件 | 端口 | 说明 |
|------|------|------|
| 前台 dev server | 5388 | 仅开发用 |
| 接口进程 | 7008 | `HTTP_PORT` 可改；容器内不对外暴露，由 nginx 反代 |
| MySQL | 3306 | 演示编排里不映射到宿主机，避免误暴露 |
| nginx | 80（宿主 `${APP_PORT:-8080}`） | 唯一对外入口 |

## 四、媒体文件

上传件与生成件写在 `MEDIA_ROOT`（默认 `server/media`，容器里 `/app/media`），按账号分桶：

```
media/<登录名>/inputs/...    # 上传的参考图
media/<登录名>/outputs/...   # 生成的成图与视频
```

对外 URL 前缀固定 `/media`，由接口进程直接 `express.static` 提供，因此 **必须持久化**：编排里挂 `./volumes/media:/app/media`。多实例部署时这块本地磁盘不共享，需要换成共享卷或对象存储，并让 `MEDIA_URL_PREFIX` 指向同一域名。

## 五、反向代理与 HTTPS

只改站点文件，不改镜像：

1. 证书放到 `deployments/volumes/nginx/ssl/`，在 compose 里追加一条只读挂载
2. `default.conf` 的 `server` 块加 `listen 443 ssl;` 与 `ssl_certificate*` 两行，80 端口改 301 跳转
3. 上传大图记得同步放大 `client_max_body_size`（当前 100M）与接口 json 上限（80mb）
4. 走 HTTPS 后把 `CORS_ORIGINS` 与实际前端 origin 对齐

## 六、外部回调

图生视频支持回调（`POST /api/motion/webhook`）。只有公网可访问时才需要配 `MOTION_WEBHOOK_URL`，没配也能靠前端轮询 `GET /api/motion/result` 拿到结果，所以两种模式可以共存。回调端点不做令牌校验，靠任务号兜底，重要场景请自行加签名。

## 七、出站代理

上游模型接口在部分网络环境不可直连，接口进程支持单独设代理：

```bash
OUTBOUND_PROXY_URL=http://127.0.0.1:7890
```

只影响服务端出站请求，不影响浏览器到本站的链路。

## 八、上线检查清单

- [ ] `ACCESS_TOKEN_SECRET` 换成随机长字符串，与开发环境不同值
- [ ] `init.sql` 的演示账号与演示流水删除或改密
- [ ] 应用连接的 MySQL 账号只给必要权限
- [ ] `CORS_ORIGINS` 明确写死，不要留空（留空=不限制）
- [ ] `MEDIA_ROOT` 落在持久卷上，并有备份
- [ ] `.env*`、`server/media/`、`deployments/volumes/` 不进版本库
- [ ] 健康检查 `GET /api/status/database` 接入你的监控
- [ ] 日志里不含令牌与凭据（本项目已去掉打印签名与请求体的语句）
