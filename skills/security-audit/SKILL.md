---
name: Security Audit
description: 安全审计和漏洞检查，包括依赖漏洞、配置安全、SSH安全、API安全
globs: ["*.ts", "*.tsx", "*.js", "*.jsx", "*.json", "*.env"]
priority: 120
alwaysApply: false
---

# 安全审计技能

当用户要求安全检查、漏洞扫描、安全加固时使用。

## 依赖安全

1. 用 ssh_execute 执行 pnpm audit 检查依赖漏洞
2. 检查是否有已知高危CVE：关注 critical 和 high 级别
3. 建议升级方案：pnpm update 依赖名

## 配置安全

1. 检查 .env 文件权限：ls -la .env（应为600）
2. 检查 JWT_SECRET 强度
3. 检查 ADMIN_PASSWORD 是否为默认值
4. 检查 CORS 配置
5. 检查是否有 debug 模式开启

## SSH安全

1. 检查SSH密钥权限：ls -la /root/.ssh/
2. 检查是否禁用密码登录：grep PasswordAuthentication /etc/ssh/sshd_config
3. 检查是否有异常登录：last -10

## API安全

1. 检查是否有未保护的API路由
2. 检查 rate limiting 配置
3. 检查输入验证（Zod schema）
4. 检查 XSS 防护

## 数据库安全

1. 检查是否允许远程连接：pg_hba.conf
2. 检查默认密码是否修改
3. 检查是否有SQL注入风险

## 安全加固建议

- 定期更新依赖
- 使用HTTPS（检查SSL证书有效期）
- 启用HSTS
- 限制API访问速率
- 日志监控异常请求

## 安全规则

- 不要在日志中输出密钥或密码
- 安全漏洞修复需要用户确认
- 不要自动执行安全加固操作
