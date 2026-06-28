---
name: Fix Bug
description: 诊断和修复代码Bug的标准流程，包含定位、修复、验证和部署的完整闭环
globs: ["*.ts", "*.tsx", "*.js", "*.jsx"]
priority: 140
alwaysApply: false
---

# Bug修复技能

当用户报告Bug或要求修复问题时，按以下标准流程执行。

## 第一步：复现与定位

1. 用 `ssh_read_file` 读取相关源代码
2. 用 `ssh_execute` 查看PM2日志：`pm2 logs ai-coding-platform --lines 50 --nostream`
3. 用 `ssh_execute` 查看浏览器控制台可能报的错误
4. 分析问题根因，形成修复方案

## 第二步：修复

1. 用 `ssh_read_file` 先读取要修改的文件完整内容
2. 规划修改方案（最小改动原则）
3. 用 `ssh_write_file` 写入修改后的文件（自动备份原文件）
4. 一次只改一个问题，不要同时改多处

## 第三步：验证

1. 用 `build_project` 构建项目
2. 如果构建失败，分析错误并修复
3. 构建成功后，用 `deploy_service` 部署
4. 用 `health_check` 验证服务正常
5. 验证Bug是否修复（检查日志或请求相关接口）

## 第四步：收尾

1. 用 `git_commit` 提交修复
2. 汇报修复结果

## 重要规则

- **先备份再修改**：ssh_write_file 默认自动备份
- **修完先验证**：必须 build + deploy + 验证后才算完成
- **不要猜测**：先读代码和日志，基于事实判断问题
- **最小改动**：只改必要的部分，不做额外重构
- **构建失败不要部署**：先修复构建错误
