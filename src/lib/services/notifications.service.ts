import { db } from '@/lib/db'
import type { NotificationType } from '@prisma/client'

export interface PushNotificationInput {
  type: NotificationType
  title: string
  message: string
  /** When set, duplicate notifications with the same key are skipped. */
  dedupeKey?: string | null
  resourceType?: string | null
  resourceId?: string | null
}

export async function pushNotification(input: PushNotificationInput): Promise<void> {
  try {
    if (input.dedupeKey) {
      const existing = await db.notification.findUnique({ where: { dedupeKey: input.dedupeKey } })
      if (existing) return
    }
    await db.notification.create({
      data: {
        type: input.type,
        title: input.title,
        message: input.message,
        dedupeKey: input.dedupeKey ?? null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
      },
    })
  } catch (err) {
    // A failed notification must never break the caller.
    console.error('[notifications] push failed:', err instanceof Error ? err.message : err)
  }
}
