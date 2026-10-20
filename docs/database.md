# 数据库说明

三张表撑起全部运营数据：操作员、成员、额度流水。没有 ORM，SQL 直接写在 `server/src/data/` 下，表名与列名在那里集中定义。

## 建库

```bash
mysql -u root -p < deployments/mysql/init.sql
```

脚本自带 `CREATE DATABASE IF NOT EXISTS prismgen` 与 `DROP TABLE IF EXISTS`，重复执行会把表重置为演示状态——**已有数据会被清掉**，别在生产上直接跑。

字符集是 utf8mb4 / utf8mb4_general_ci，`deployments/mysql/my.cnf` 里用 `skip-character-set-client-handshake` 强制统一，避免中文写进去变问号。

## 表结构

### console_operator — 运营台操作员

| 列 | 类型 | 说明 |
|----|------|------|
| `operator_id` | BIGINT | 主键，`AUTO_INCREMENT=100` |
| `login_name` | VARCHAR(30) | 登录名，建有索引 |
| `secret_digest` | VARCHAR(255) | 口令的 MD5 摘要 |
| `account_state` | CHAR(1) | `0` 启用 / `1` 停用 |
| `deleted_flag` | CHAR(1) | `0` 存在 / `2` 已删除 |
| `registered_by`、`updated_by` | VARCHAR(64) | 登记人 / 更新人 |
| `created_at`、`updated_at` | DATETIME | 时间戳 |

登录时把用户口令做 MD5 后与 `secret_digest` 比对（`server/src/data/operator-store.ts`）。

### app_member — 使用端成员

| 列 | 类型 | 说明 |
|----|------|------|
| `member_id` | BIGINT | 主键，`AUTO_INCREMENT=100` |
| `login_name` | VARCHAR(30) | 登录名，索引 |
| `display_name` | VARCHAR(30) | 展示名 |
| `email`、`mobile` | VARCHAR | 预留字段，当前逻辑不校验 |
| `secret` | VARCHAR(100) | 登录口令，演示为明文 |
| `credit_balance` | INT | 额度余额，默认 100 |
| `account_state`、`deleted_flag` | CHAR(1) | 同上 |

扣额度的语句自带余额守卫，余额不足时 `affectedRows = 0`，接口据此返回 `INSUFFICIENT_CREDITS`：

```sql
UPDATE app_member SET credit_balance = credit_balance - ?
WHERE login_name = ? AND credit_balance >= ? AND <未停用且未删除>
```

### credit_journal — 额度流水

| 列 | 类型 | 说明 |
|----|------|------|
| `entry_id` | BIGINT | 主键，列表按它倒序分页 |
| `member_id` | BIGINT | 关联 `app_member.member_id` |
| `operator_id` | BIGINT | 关联 `console_operator`；`0` 表示系统自动记账 |
| `entry_kind` | CHAR(1) | 见下表 |
| `delta` | INT | 变动数量 |
| `balance_before`、`balance_after` | INT | 变动前后余额 |
| `created_at` | DATETIME | 发生时间 |

`entry_kind` 取值（`server/src/data/credit-store.ts` 的 `ENTRY_KIND`）：

| 值 | 含义 | 谁写 |
|----|------|------|
| `0` | 充值 | 管理台 |
| `1` | 手动扣除 | 管理台 |
| `2` | 静帧生成消耗 | 工作台 |
| `3` | 动态生成消耗 | 工作台 |
| `4` | 失败返还 | 工作台 |

流水与余额更新在同一个事务里完成（`server/src/services/credit-service.ts`），事务内通过 `runOn(conn)` 复用连接。

## 环境配置

接口侧读 `server/.env.local`：

```bash
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD="你的密码"
MYSQL_DATABASE=prismgen
MYSQL_POOL_SIZE=10
```

密码含 `!@#` 等特殊字符时用引号包起来，否则 dotenv 会把 `#` 之后当注释。

## 日常运维

```bash
# 查看数据量
mysql -u root -p -e "SELECT COUNT(*) FROM prismgen.app_member; SELECT COUNT(*) FROM prismgen.credit_journal;"

# 备份
mysqldump -u root -p prismgen > backup-$(date +%Y%m%d).sql

# 恢复
mysql -u root -p prismgen < backup-YYYYMMDD.sql

# 重置到演示状态
mysql -u root -p -e "DROP DATABASE IF EXISTS prismgen;" && mysql -u root -p < deployments/mysql/init.sql
```

改口令：

```sql
-- 操作员（MD5）
UPDATE console_operator SET secret_digest = MD5('新口令') WHERE login_name = 'operator_demo';
-- 成员（明文，与当前登录逻辑一致）
UPDATE app_member SET secret = '新口令' WHERE login_name = 'studio_demo';
```

加成员：

```sql
INSERT INTO app_member (login_name, display_name, secret, credit_balance, account_state, deleted_flag, created_at)
VALUES ('new_member', '新成员', '初始口令', 100, '0', '0', NOW());
```

## 常见问题

| 现象 | 处理 |
|------|------|
| `connect ECONNREFUSED 127.0.0.1:3306` | MySQL 未启动，或 `MYSQL_HOST` 指错（容器里应为服务名） |
| `Access denied for user` | 用户名/密码不匹配；容器部署时注意 `MYSQL_USER` 与 root 的区别 |
| `Unknown database 'prismgen'` | 没跑过 `init.sql` |
| 管理台流水里成员名空白 | `credit_journal.member_id` 指向了已删除的账号，JOIN 用 LEFT JOIN 不会报错但会缺名 |
| 中文变问号 | 确认 `my.cnf` 已挂载，且库表字符集为 utf8mb4 |

## 上线前必做

- 删除或改掉 `init.sql` 里所有演示账号与演示流水
- `secret_digest` 换成 bcrypt/argon2 摘要，并同步改 `operator-store.ts` 的比对方式
- 成员口令同样改为加盐哈希，别继续明文
- 给应用账号最小权限（只允许 `prismgen` 库的 DML），不要用 root 跑业务
