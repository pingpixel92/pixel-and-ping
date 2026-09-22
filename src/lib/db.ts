import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [{ emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
