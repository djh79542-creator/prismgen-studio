-- ============================================
-- PrismGen 数据库初始化脚本
-- ============================================
-- 说明：
-- 1. 创建库、三张业务表与若干演示账号
-- 2. 演示凭据仅供本地体验，部署前请删除或替换
-- 3. 运营台口令按 MD5 摘要比对，工作台口令按明文比对（沿用示例逻辑，生产请改为加盐哈希）
-- ============================================

CREATE DATABASE IF NOT EXISTS prismgen DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE prismgen;

-- ============================================
-- 1. 运营台操作员
-- ============================================
DROP TABLE IF EXISTS console_operator;
CREATE TABLE console_operator (
    operator_id      BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '操作员ID',
    login_name       VARCHAR(30)  DEFAULT '' COMMENT '登录名',
    secret_digest    VARCHAR(255) DEFAULT '' COMMENT '口令摘要（MD5）',
    account_state    CHAR(1)      DEFAULT '0' COMMENT '账号状态（0启用 1停用）',
    deleted_flag     CHAR(1)      DEFAULT '0' COMMENT '删除标记（0存在 2删除）',
    registered_by    VARCHAR(64)  DEFAULT '' COMMENT '登记人',
    created_at       DATETIME COMMENT '创建时间',
    updated_by       VARCHAR(64)  DEFAULT '' COMMENT '更新人',
    updated_at       DATETIME COMMENT '更新时间',
    PRIMARY KEY (operator_id),
    KEY idx_operator_login (login_name)
) ENGINE=InnoDB AUTO_INCREMENT=100 COMMENT='运营台操作员';

-- 演示操作员，口令 prism-dev-2026
INSERT INTO console_operator (login_name, secret_digest, account_state, deleted_flag, created_at)
VALUES ('operator_demo', '77b8f4e5b6f60d68d4b43a0282269b82', '0', '0', NOW());

-- ============================================
-- 2. 使用端账号
-- ============================================
DROP TABLE IF EXISTS app_member;
CREATE TABLE app_member (
    member_id       BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '账号ID',
    login_name      VARCHAR(30)  DEFAULT '' COMMENT '登录名',
    display_name    VARCHAR(30)  DEFAULT '' COMMENT '展示名',
    email           VARCHAR(50)  DEFAULT '' COMMENT '邮箱',
    mobile          VARCHAR(11)  DEFAULT '' COMMENT '手机号',
    secret          VARCHAR(100) DEFAULT '' COMMENT '登录口令（示例为明文）',
    credit_balance  INT          DEFAULT 100 COMMENT '额度余额',
    account_state   CHAR(1)      DEFAULT '0' COMMENT '账号状态（0启用 1停用）',
    deleted_flag    CHAR(1)      DEFAULT '0' COMMENT '删除标记（0存在 2删除）',
    registered_by   VARCHAR(64)  DEFAULT '' COMMENT '登记人',
    created_at      DATETIME COMMENT '创建时间',
    updated_by      VARCHAR(64)  DEFAULT '' COMMENT '更新人',
    updated_at      DATETIME COMMENT '更新时间',
    PRIMARY KEY (member_id),
    KEY idx_member_login (login_name)
) ENGINE=InnoDB AUTO_INCREMENT=100 COMMENT='使用端账号';

-- 演示账号，口令统一为 demo-credit-2026
INSERT INTO app_member (login_name, display_name, secret, credit_balance, account_state, deleted_flag, created_at)
VALUES
('studio_demo',   '演示账号 A', 'demo-credit-2026', 1000, '0', '0', NOW()),
('studio_member1', '成员一号',  'demo-credit-2026', 200, '0', '0', NOW()),
('studio_member2', '成员二号',  'demo-credit-2026', 200, '0', '0', NOW()),
('studio_member3', '成员三号',  'demo-credit-2026', 120, '0', '0', NOW());

-- ============================================
-- 3. 额度流水
-- ============================================
DROP TABLE IF EXISTS credit_journal;
CREATE TABLE credit_journal (
    entry_id        BIGINT(20)  NOT NULL AUTO_INCREMENT COMMENT '流水ID',
    member_id       BIGINT(20)  NOT NULL COMMENT '账号ID',
    operator_id     BIGINT(20)  NOT NULL COMMENT '操作员ID（0 表示系统自动）',
    entry_kind      CHAR(1)     NOT NULL COMMENT '类别：0=充值 1=扣除 2=静帧生成 3=动态生成 4=返还',
    delta           INT         NOT NULL COMMENT '变动数量',
    balance_before  INT         NOT NULL COMMENT '变动前余额',
    balance_after   INT         NOT NULL COMMENT '变动后余额',
    created_at      DATETIME COMMENT '发生时间',
    PRIMARY KEY (entry_id),
    KEY idx_journal_member (member_id),
    KEY idx_journal_operator (operator_id),
    KEY idx_journal_created (created_at)
) ENGINE=InnoDB AUTO_INCREMENT=100 COMMENT='额度流水';

-- 演示流水，便于管理台一进页面就有数据（AUTO_INCREMENT=100，首个成员即 member_id=100）
INSERT INTO credit_journal (member_id, operator_id, entry_kind, delta, balance_before, balance_after, created_at)
VALUES
(100, 100, '0', 1000, 0, 1000, NOW()),
(100, 0,   '2', 1, 1000, 999, NOW()),
(101, 100, '0', 200, 0, 200, NOW());

-- ============================================
-- 初始化完成
-- ============================================
SELECT '数据库初始化完成' AS message;
SELECT COUNT(*) AS operator_count FROM console_operator;
SELECT COUNT(*) AS member_count FROM app_member;
SELECT COUNT(*) AS journal_count FROM credit_journal;
