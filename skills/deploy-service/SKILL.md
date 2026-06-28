---
name: Deploy Service
description: 将Next.js项目构建并部署到宝塔服务器，包含完整的验证和回滚流程
globs: ["*.ts", "*.tsx", "*.js", "*.jsx", "*.json"]
priority: 150
alwaysApply: false
---

# 部署服务技能

当用户要求部署、上线、发布、更新服务时，按以下标准流程执行。

## 执行前检查

1. 用 `health_check` 检查当前服务状态，记录当前状态
2. 用 `ssh_execute` 执行 `git status --short` 检查是否有未提交的变更
3. 如果有未提交变更，先询问用户是否需要提交

## 构建阶段

1. 用 `build_project` 执行构建
2. 如果构建失败：
   - 读取错误信息
   - 分析失败原因
   - 不要尝试部署，先修复问题
3. 如果构建成功，继续部署

## 部署阶段

1. 用 `deploy_service` 重启PM2并验证
2. 等待健康检查通过

## 验证阶段

1. 用 `health_check` 全面检查（http + pm2 + memory）
2. 用 `ssh_execute` 执行 `curl -s https://域名 | head -5` 验证页面可访问
3. 如果验证失败：
   - 检查PM2日志：`pm2 logs ai-coding-platform --lines 30`
   - 检查Nginx错误日志
   - 如需回滚，用 `ssh_execute` 执行 `git checkout HEAD~1 -- .` 回退代码

## 收尾

1. 用 `git_commit` 提交当前变更（如果有）
2. 汇报部署结果，包括：
   - 构建状态
   - 部署状态
   - 健康检查结果
   - Git commit hash
   - 服务URL

## 安全规则

- 构建和部署都需要用户审批确认
- 不要在未构建的情况下重启PM2
- 构建失败时不要尝试部署
- 始终验证部署结果
