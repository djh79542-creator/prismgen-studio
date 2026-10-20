# PrismGen 影像工坊

一个「图生图 + 图生视频」的演示型工作台：浏览器端选效果、上传参考图、拿到成图后再把成图丢进视频生成；配套一个管理台做成员与额度（credit）运营。整套代码只有两个进程——Vite 托管的 React 前台，和 Express 托管的接口，中间用一组 JSON 接口和一个本地媒体目录打通。

> 本项目是教学/演示用外壳：接口层保留，上游模型凭据需要你自备；库表、路由与环境变量都是自洽命名，不依赖任何外部系统。

## 它能做什么

- **免提示词出图**：内置 60+ 效果预设（风格迁移、材质替换、模特试穿、线稿→上色等），选中即用，也可自由填写提示词
- **连续编辑**：上一次的结果图可一键作为下一次输入，形成创作链
- **局部重绘**：在前端画蒙版，只把蒙版区域交给模型，其余像素保持原样
- **图生视频**：成图直接投递到 image2video 任务，支持轮询与回调两种取结果方式
- **额度账本**：成员每次生成扣额度，失败返还；管理台可充值/扣除并翻页查流水
- **双语双主题**：中英界面、浅深色切换，状态全部留在浏览器本地

## 30 分钟跑起来

前置：Node 20+、MySQL 8、一个可用的图像生成接口凭据（下面按变量名说明，不限定厂商）。

```bash
# 1. 建库
mysql -u root -p < deployments/mysql/init.sql

# 2. 接口配置
cp server/.env.example server/.env.local
#   必填：ACCESS_TOKEN_SECRET、MYSQL_*
#   按用到的能力选填：PRISM_MODELHUB_KEY / RASTER_* / MOTION_KEY_ID+MOTION_KEY_SECRET

# 3. 前端配置（可选，仅当接口不在本机 7008）
cp .env.example .env.local

# 4. 起两个进程
npm install && npm run dev                 # 前台 http://localhost:5388
npm --prefix server install && npm run api # 接口 http://localhost:7008
```

打开 http://localhost:5388 用演示成员登录（见下表），管理台在 http://localhost:5388/console/sign-in。

**演示账号**（来自 `deployments/mysql/init.sql`，仅本地用，上线前务必改掉）：

| 用途 | 账号 | 口令 | 初始额度 |
|------|------|------|----------|
| 成员 | `studio_demo` | `demo-credit-2026` | 1000 |
| 成员 | `studio_member1` / `studio_member2` | `demo-credit-2026` | 200 |
| 成员 | `studio_member3` | `demo-credit-2026` | 120 |
| 管理台 | `operator_demo` | `prism-dev-2026` | — |

管理台口令在库里是 MD5 摘要，重新生成：

```bash
node -e "console.log(require('crypto').createHash('md5').update('你的口令').digest('hex'))"
```

## 目录结构

```
prismgen/
├── src/                    # 浏览器端（React 19 + Vite 6）
│   ├── app/                # 工作台装配：Studio.tsx、效果预设、领域类型
│   ├── ui/                 # 展示组件；ui/console/ 是管理台页面
│   ├── clients/            # 按能力划分的接口调用（出图/色板/视频/素材/额度）
│   ├── platform/           # 运行环境相关：接口 origin、令牌存放
│   ├── toolkit/            # 纯函数工具：图片处理、签名算法
│   ├── i18n/               # 双语字典与 t() 实现
│   └── theme/              # 主题变量与切换
├── server/                 # 接口端（Express 4 + TypeScript）
│   └── src/
│       ├── app.ts          # 组装中间件与路由，导出 createApp()
│       ├── index.ts        # 进程入口，监听 HTTP_PORT
│       ├── config.ts       # 环境变量收敛为一处导出
│       ├── http/routes/    # 接口层：只做校验、鉴权与响应形状
│       ├── services/       # 能力层：上游模型调用与业务编排
│       ├── data/           # 数据层：表访问，返回领域对象
│       ├── database/       # 连接池与 SQL 执行器
│       ├── http/middleware/# 令牌校验与统一错误处理
│       └── toolkit/        # 工作区目录、签名、并发闸门
├── deployments/            # 单机部署：compose、nginx 站点、建库脚本
├── dev-tools/              # 本地排查脚本（如签名自测）
└── docs/                   # 数据库与部署说明
```

数据流一句话概括：`src/clients/*` → `/api/*`（Vite 代理或 nginx 反代）→ `server/src/http/routes` → `services` → 上游模型；成图落 `server/media/<账号>/outputs`，经 `/media/*` 静态目录回给浏览器。

## 接口一览

成员侧（`Authorization: Bearer <成员令牌>`）：

| 方法与路径 | 作用 |
|------------|------|
| `POST /api/session/sign-in` | 成员登录，返回令牌与额度余额（连续失败 5 次锁定 24h） |
| `GET /api/credits/balance` | 查询余额 |
| `GET /api/credits/entries` | 自己的额度流水 |
| `POST /api/credits/consume` | 扣额度（`kind`：2=静帧，3=动态） |
| `POST /api/credits/restore` | 失败返还 |
| `POST /api/studio/image-edit` | 提示词/蒙版驱动的图改图 |
| `POST /api/studio/palette-edit` | 线稿 + 参考色板上色（提交任务） |
| `POST /api/studio/palette-result` | 拉取上一步任务结果 |
| `POST /api/motion/jobs` | 图生视频任务 |
| `GET /api/motion/result?task_id=` | 轮询视频状态 |
| `POST /api/motion/webhook` | 外部回调别名（无鉴权，只写状态） |
| `POST /api/assets` | 上传参考图（≤80MB，jpeg/png/gif/webp） |
| `GET /api/assets` | 列出某目录下的文件 |
| `DELETE /api/assets/:bucket/:filename` | 删除文件（`bucket`：inputs/outputs） |
| `POST /api/gallery/archive` / `GET /api/gallery` | 归档结果图 / 读取历史 |

管理台侧（`Authorization: Bearer <管理令牌>`）：

| 方法与路径 | 作用 |
|------------|------|
| `POST /api/console/session/sign-in` | 管理员登录 |
| `GET /api/console/members` | 成员分页列表 |
| `GET /api/console/members/:id/credits` | 单成员余额 |
| `POST /api/console/credits` | 充值 / 扣除并记账 |
| `GET /api/console/credits/entries` | 全量流水，可按成员与类型过滤 |

健康检查：`GET /api/status`、`GET /api/status/database`。

## 环境变量

两份模板各自独立，别混用：

- `server/.env.example` → 接口进程（端口、跨域白名单、会话密钥、MySQL、媒体根目录、三路上游能力、出站代理）
- `.env.example` → 浏览器端（接口 origin 覆盖、管理台 baseURL）
- `deployments/.env.example` → compose 编排

只填你要用到的能力：静帧走 `PRISM_MODELHUB_KEY`，色板走 `RASTER_ACCESS_KEY_ID/RASTER_SECRET_ACCESS_KEY`，视频走 `MOTION_KEY_ID/MOTION_KEY_SECRET`。缺凭据时对应按钮会明确报错，不影响其余功能。

上游地址、动作名与版本号属于接口契约，已经写进模板默认值；换厂商时改 `*_API_BASE`、`*_PATH`、`*_ACTION` 即可，不必动代码。

## 联调建议

- 接口独立起在 7008，前台通过 Vite 代理转发 `/api` 与 `/media`，开发期不需要配 CORS
- 需要跨机访问时把 `CORS_ORIGINS` 填成前端实际 origin，多个用逗号分隔
- 上传报 413 时，同时放大 nginx 的 `client_max_body_size` 和接口的 json 体积上限
- 出站网络受限时设 `OUTBOUND_PROXY_URL=http://127.0.0.1:7890`，接口内部走代理
- 排查签名问题：`npm run verify:signature`（读取根目录 `.env.local` 里的 `RASTER_*`）

## 部署

单机容器化（应用 + MySQL）见 [deployments/README.md](deployments/README.md)；建库与库表字段说明见 [docs/database.md](docs/database.md)。

## 已知边界

- 额度扣减与返还走 MySQL 事务，但没有幂等键；重复提交同一请求可能重复记账
- 媒体文件存本地磁盘，多实例部署需换成共享存储或对象存储
- 管理台口令沿用 MD5，仅为演示；生产请替换为 bcrypt/argon2 并强制改密
- 视频回调端点无鉴权，靠任务号本身兜底，重要场景请自行加校验
