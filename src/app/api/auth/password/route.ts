import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/crypto'
import { ApiError, ok, parseBody, withAuth } from '@/lib/api'
import { getIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(10, 'New password must be at least 10 characters')
    .max(200)
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z0-9]/, 'Must contain an uppercase letter or a digit'),
})

export const POST = withAuth(async (req, ctx) => {
  const body = await parseBody(req, schema)
  const ip = getIp(req)

  const user = await db.user.findUnique({ where: { id: ctx.auth.id } })
  if (!user || !verifyPassword(body.currentPassword, user.passwordHash)) {
    throw new ApiError(400, 'INVALID_CREDENTIALS', 'Current password is incorrect.')
  }
  if (verifyPassword(body.newPassword, user.passwordHash)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'New password must differ from the current one.')
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(body.newPassword) },
  })
  await audit({
    actorId: user.id,
    actorLabel: user.username,
    action: 'PASSWORD_CHANGE',
    resourceType: 'USER',
    resourceId: user.id,
    ip,
  })
  return ok({ changed: true })
})
