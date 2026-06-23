import { PrismaClient } from '@prisma/client';

// 全局 Prisma 客户端实例（避免开发环境热重载时创建多个实例）
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 数据库初始化函数
export async function initDatabase(): Promise<void> {
  try {
    // Prisma 会自动处理数据库迁移
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

// 关闭数据库连接
export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export default prisma;
