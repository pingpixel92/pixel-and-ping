import { z } from 'zod'
import { ok, parseBody, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { connect } from '@/lib/services/cloudflare.service'

const schema = z.object({
  token: z.string().min(20, 'Token looks too short').max(200),
  name: z.string().min(1).max(100).default('Cloudflare'),
})

/**
 * POST /api/cloudflare/connect
 * Verifies the token against the real Cloudflare API, stores it AES-256-GCM encrypted.
 * The token is never returned or logged.
 */
export const POST = withAuth(async (req, ctx) => {
  const body = await parseBody(req, schema)
  const status = await connect(body.token, body.name, { id: ctx.auth.id, label: ctx.auth.username }, getIp(req))
  return ok(status)
}, { roles: rolesFor('cloudflare:manage') })
