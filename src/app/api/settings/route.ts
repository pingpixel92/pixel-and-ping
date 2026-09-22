import { z } from 'zod'
import { ok, parseBody, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getSettings, updateSettings } from '@/lib/services/settings.service'

export const GET = withAuth(async () => {
  return ok(await getSettings())
})

const schema = z.object({
  healthCheckIntervalMin: z.number().int().min(1).max(1440).optional(),
  sessionTimeoutMin: z.number().int().min(15).max(60 * 24 * 30).optional(),
  expiryAlertDays: z.number().int().min(1).max(90).optional(),
  notify: z
    .object({
      expiry: z.boolean().optional(),
      health: z.boolean().optional(),
      integration: z.boolean().optional(),
    })
    .optional(),
  appearance: z
    .object({
      accent: z.enum(['blue', 'navy']).optional(),
      density: z.enum(['comfortable', 'compact']).optional(),
    })
    .optional(),
})

export const PUT = withAuth(async (req, ctx) => {
  const body = await parseBody(req, schema)
  const next = await updateSettings(body)
  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: 'SETTINGS_CHANGE',
    resourceType: 'SETTINGS',
    resourceId: 'panel',
    ip: getIp(req),
  })
  return ok(next)
}, { roles: rolesFor('settings:manage') })
