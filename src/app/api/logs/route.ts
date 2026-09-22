import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, searchParams, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'

export const GET = withAuth(async (req) => {
  const sp = searchParams(req)
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') ?? 20)))
  const search = (sp.get('search') ?? '').trim().slice(0, 100)
  const level = sp.get('level') ?? 'ALL'
  const from = sp.get('from')
  const to = sp.get('to')

  const AND: Prisma.LogEntryWhereInput[] = []
  if (search) {
    AND.push({
      OR: [
        { message: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { actor: { contains: search, mode: 'insensitive' } },
      ],
    })
  }
  if (level === 'DEBUG' || level === 'INFO' || level === 'WARN' || level === 'ERROR') AND.push({ level })
  if (from) {
    const d = new Date(from)
    if (!Number.isNaN(d.getTime())) AND.push({ at: { gte: d } })
  }
  if (to) {
    const d = new Date(to)
    if (!Number.isNaN(d.getTime())) AND.push({ at: { lte: d } })
  }

  const where: Prisma.LogEntryWhereInput = AND.length ? { AND } : {}

  const [total, items] = await Promise.all([
    db.logEntry.count({ where }),
    db.logEntry.findMany({
      where,
      orderBy: { at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return ok({
    items: items.map((l) => ({
      id: l.id,
      at: l.at.toISOString(),
      level: l.level,
      action: l.action,
      actor: l.actor,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      message: l.message,
      ip: l.ip,
    })),
    total,
    page,
    pageSize,
  })
}, { roles: rolesFor('infra:read') })
