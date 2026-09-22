import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, parseBody, searchParams, withAuth } from '@/lib/api'

export const GET = withAuth(async (req) => {
  const sp = searchParams(req)
  const page = Math.max(1, Number(sp.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') ?? 20)))
  const unreadOnly = sp.get('unreadOnly') === '1'
  const type = sp.get('type') ?? 'ALL'

  const where = {
    ...(unreadOnly ? { read: false } : {}),
    ...(type === 'SYSTEM' || type === 'EXPIRY' || type === 'HEALTH' || type === 'INTEGRATION' ? { type } : {}),
  }

  const [total, unreadCount, items] = await Promise.all([
    db.notification.count({ where }),
    db.notification.count({ where: { read: false } }),
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return ok({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
    })),
    total,
    unreadCount,
    page,
    pageSize,
  })
})

const patchSchema = z.object({
  ids: z.array(z.string()).max(100).optional(),
  all: z.boolean().optional(),
})

export const PATCH = withAuth(async (req, ctx) => {
  const body = await parseBody(req, patchSchema)
  if (body.all) {
    await db.notification.updateMany({ where: { read: false }, data: { read: true, readAt: new Date() } })
  } else if (body.ids?.length) {
    await db.notification.updateMany({
      where: { id: { in: body.ids }, read: false },
      data: { read: true, readAt: new Date() },
    })
  }
  const unreadCount = await db.notification.count({ where: { read: false } })
  return ok({ unreadCount, actor: ctx.auth.username })
})
