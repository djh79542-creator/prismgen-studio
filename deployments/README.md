# 容器编排

一条命令起「应用 + 数据库」，用于演示或单机试运行。

```
deployments/
├── compose.yaml          # app（nginx + 接口进程）与 db（MySQL 8）
├── .env.example          # 复制为 .env 后填写，.env 不进版本库
├── nginx/
│   ├── nginx.conf        # 主配置：上传体积上限、日志格式
│   └── default.conf      # 站点：SPA 兜底、/api/ 与 /media/ 反代
├── mysql/
│   ├── init.sql          # 建库建表 + 演示账号（首次启动自动执行）
│   └── my.cnf            # utf8mb4 与时区相关
└── volumes/              # 运行时生成，挂载点：db 数据、media 文件
```

应用镜像由仓库根目录的 `Dockerfile` 现场构建：多阶段产出前端静态包与接口 `dist/`，运行层是 nginx + Node + supervisor，容器内只监听 80。

## 启动

```bash
cp .env.example .env
${EDITOR:-vi} .env       # 三个 :? 必填项不填会直接拒绝启动
docker compose up -d --build
```

必填：`MYSQL_ROOT_PASSWORD`、`MYSQL_PASSWORD`、`ACCESS_TOKEN_SECRET`。选填：三路上游模型的凭据（不填则对应功能报错，其余照常）。

访问：<http://localhost:8080>（由 `APP_PORT` 决定），管理台 <http://localhost:8080/console/sign-in>。演示账号在仓库 [README](../README.md) 里。

## 日常操作

```bash
docker compose ps                      # 状态与健康检查
docker compose logs -f app             # nginx + 接口混合日志
docker compose logs -f db
docker compose exec app sh
docker compose restart app             # 改 .env 后重建环境变量
docker compose up -d --build           # 代码变更后重新出镜像
docker compose down                    # 保留数据卷
docker compose down -v                 # 连库数据一起删（不可恢复）
```

改完 `.env` 用 `up -d` 重建容器才生效，`restart` 不会重读环境变量。

## 数据在哪里

| 内容 | 宿主机路径 | 容器路径 |
|------|------------|----------|
| 数据库 | `deployments/volumes/db` | `/var/lib/mysql` |
| 上传件与生成件 | `deployments/volumes/media` | `/app/media` |

`volumes/` 目录首次启动时由 Docker 创建，备份时直接拷走即可（数据库建议在停写下用 `mysqldump`）。

```bash
docker compose exec db mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" prismgen > backup-$(date +%Y%m%d).sql
docker compose exec -T db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" prismgen < backup-YYYYMMDD.sql
```

## 重置

```bash
docker compose down
rm -rf volumes/db          # 会丢弃全部业务数据
docker compose up -d --build
```

删掉 `volumes/db` 后 MySQL 会重新执行 `mysql/init.sql`，回到演示初始状态。只想清文件时删 `volumes/media` 即可。

## 换端口与域名

- 改宿主端口：`.env` 里 `APP_PORT=9000`，然后 `docker compose up -d`
- 需要 HTTPS：把证书放到 `volumes/nginx/ssl/`，在 compose 的 `app.volumes` 追加只读挂载，并修改 `nginx/default.conf` 加 443 监听与 80 跳转；同时把 `CORS_ORIGINS` 改成实际域名
- 前端与接口同域（都由 nginx 出入口），所以不需要单独设 `VITE_CONSOLE_API_BASE`

## 故障排查

| 现象 | 先查 |
|------|------|
| 起不来，提示 `MYSQL_PASSWORD` 相关错误 | `.env` 没创建或没填，compose 用了 `:?` 强校验 |
| `app` 一直 unhealthy | `docker compose logs app`，多半是数据库密码与库内不一致 |
| 页面 502 | 接口进程还没起来（supervisor 会自愈，等 10 秒）或 `HTTP_PORT` 与 nginx upstream 不匹配（默认 7008） |
| 登录 401 循环 | `ACCESS_TOKEN_SECRET` 改过，旧令牌全失效，重新登录 |
| 上传 413 | `nginx/nginx.conf` 的 `client_max_body_size` 与接口 json 上限（80mb）都要够 |
| 生成件打不开 | `volumes/media` 权限（容器内属 `nginx` 用户）与 `MEDIA_ROOT` 是否指向挂载点 |
| 中文乱码 | `mysql/my.cnf` 是否挂载成功，容器是否重建过 |

## 上线前提醒

`mysql/init.sql` 里的演示账号口令与 MD5 摘要必须替换；`compose.yaml` 把 3306 留在内部网络、没有对外映射，别在其它地方把它打开。
