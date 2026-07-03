#!/bin/bash
# Automated PostgreSQL backup with rotation
BACKUP_DIR="/www/wwwroot/agent.piyiguo.com/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.dump"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

# Dump database
PGPASSWORD=i3m8x5a2e8 pg_dump -h 127.0.0.1 -U agent -d agent -F c -f "$BACKUP_FILE" 2>/dev/null

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup created: $BACKUP_FILE"
  # Remove old backups
  find "$BACKUP_DIR" -name "db_backup_*.dump" -mtime +$KEEP_DAYS -delete
  echo "[$(date)] Cleaned backups older than $KEEP_DAYS days"
else
  echo "[$(date)] Backup FAILED" >&2
fi
