import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, searchParams, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'

export const GET = withAuth(async (req) => {
  const sp = searchParams(req)
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') ?? 20)))
  const search = (sp.get('search') ?? '').trim().slice(0, 100)
  const action = (sp.get('action') ?? '').trim().slice(0, 64)

  const AND: Prisma.AuditLogWhereInput[] = []
  if (search) {
    AND.push({
      OR: [
        { actorLabel: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
      ],
    })
  }
  if (action) AND.push({ action: { contains: action.toUpperCase() } })
  const where: Prisma.AuditLogWhereInput = AND.length ? { AND } : {}

  const [total, items] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return ok({
    items: items.map((a) => ({
      id: a.id,
      at: a.at.toISOString(),
      actorLabel: a.actorLabel,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      ip: a.ip,
    })),
    total,
    page,
    pageSize,
  })
}, { roles: rolesFor('audit:read') })
