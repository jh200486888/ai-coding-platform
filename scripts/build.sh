#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install --frozen-lockfile --prefer-offline

echo "Generating Prisma Client..."
pnpm prisma generate

echo "Building Next.js..."
pnpm next build

echo "Build completed!"
