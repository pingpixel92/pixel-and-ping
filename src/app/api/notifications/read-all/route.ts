import { db } from '@/lib/db'
import { ok, withAuth } from '@/lib/api'

export const POST = withAuth(async () => {
  await db.notification.updateMany({ where: { read: false }, data: { read: true, readAt: new Date() } })
  const unreadCount = await db.notification.count({ where: { read: false } })
  return ok({ unreadCount })
})
