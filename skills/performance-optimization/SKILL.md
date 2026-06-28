---
name: Performance Optimization
description: 分析和优化应用性能，包括构建优化、内存优化、数据库查询优化
globs: ["*.ts", "*.tsx", "*.js", "*.jsx", "*.json"]
priority: 130
alwaysApply: false
---

# 性能优化技能

当用户要求优化性能、加速构建、减少内存占用、优化查询时使用。

## 诊断阶段

1. 用 health_check 检查内存和磁盘使用率
2. 用 ssh_execute 检查PM2内存占用：pm2 show ai-coding-platform | grep memory
3. 用 ssh_execute 检查构建时间：记录 pnpm build 耗时
4. 用 ssh_execute 检查慢查询：PGPASSWORD=i3m8x5a2e8 psql -h 127.0.0.1 -U agent -d agent -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10"

## 优化方向

### 构建优化
- 检查 next.config.ts 是否有优化配置
- 检查是否有不必要的依赖：du -sh node_modules/*
- 构建内存限制：NODE_OPTIONS=--max-old-space-size=3072

### 内存优化
- 检查DB连接池配置：max=10, idleTimeout=30s
- 检查是否有内存泄漏：对比多次PM2内存占用
- SSH连接池：空闲5分钟自动释放

### 数据库优化
- 检查缺失索引：pg_stat_user_tables 中 seq_scan 远大于 idx_scan
- 检查连接数：SELECT count(*) FROM pg_stat_activity
- 检查表膨胀：VACUUM ANALYZE

## 验证

1. 优化后重新构建，对比耗时
2. 检查内存使用是否降低
3. 用 health_check 验证服务正常
4. 查询响应时间对比

## 安全规则

- 数据库优化操作需要用户审批
- 不要在生产环境执行VACUUM FULL（会锁表）
- 优化后必须验证服务正常
