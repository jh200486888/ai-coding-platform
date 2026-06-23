#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

# Read port from .preview if it exists, otherwise use DEPLOY_RUN_PORT or default 5000
if [ -f "${COZE_WORKSPACE_PATH}/.preview" ]; then
    PORT=$(cat "${COZE_WORKSPACE_PATH}/.preview" | grep -oE '[0-9]+' | head -1)
else
    PORT=${DEPLOY_RUN_PORT:-5000}
fi

export PORT
export HOSTNAME="0.0.0.0"
export COZE_PROJECT_ENV="${COZE_PROJECT_ENV:-PROD}"

echo "Starting Next.js server on port ${PORT}..."
exec pnpm next start -p "${PORT}"
