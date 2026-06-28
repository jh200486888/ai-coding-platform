---
name: Database Migration
description: 数据库结构变更和迁移操作，包含备份、迁移、验证和回滚流程
globs: ["*.sql", "*.prisma", "*.ts"]
priority: 140
alwaysApply: false
---

# 数据库迁移技能

当用户要求修改数据库结构、添加表、修改字段、数据迁移时使用。

## 执行前

1. 用 ssh_execute 执行数据库备份：PGPASSWORD=i3m8x5a2e8 pg_dump -h 127.0.0.1 -U agent -d agent > /tmp/db_backup_日期.sql
2. 确认备份文件存在且大小合理
3. 用 ssh_execute 查看当前表结构：PGPASSWORD=i3m8x5a2e8 psql -h 127.0.0.1 -U agent -d agent -c "\d 表名"

## 迁移执行

1. 根据用户需求编写SQL语句
2. 用 ssh_execute 执行SQL，添加 ON CONFLICT 或事务保护
3. 对于破坏性操作（DROP/ALTER/DELETE），必须先获得用户确认

## 验证

1. 检查表结构是否正确：\d 表名
2. 检查数据完整性：SELECT count(*) FROM 表名
3. 测试应用功能是否正常

## 回滚

如果迁移失败：
1. 停止应用（PM2 stop）
2. 恢复备份：PGPASSWORD=i3m8x5a2e8 psql -h 127.0.0.1 -U agent -d agent < /tmp/db_backup_xxx.sql
3. 重启应用
4. 验证恢复成功

## 安全规则

- 所有写操作需要用户审批
- 永远先备份再修改
- 破坏性操作必须有回滚方案
- 生产环境使用 production 服务器，5432端口
