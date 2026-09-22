import { z } from 'zod'
import { ok, parseBody, withAuth, ApiError } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { rateLimit } from '@/lib/rate-limit'
import { scanTarget } from '@/lib/services/scanner.service'

const HOSTNAME = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^\d{1,3}(\.\d{1,3}){3}$/

const schema = z.object({
  host: z.string().min(3).max(253).regex(HOSTNAME, 'Enter a valid hostname or IPv4 address'),
  port: z.number().int().min(1).max(65535).optional(),
  http: z.boolean().optional(),
})

/**
 * POST /api/scanner — controlled diagnostic for hosts the operator manages.
 * Real results only: DNS, TCP, optional HTTP. Rate limited per user.
 */
export const POST = withAuth(async (req, ctx) => {
  if (!rateLimit(`scanner:${ctx.auth.id}`, 10, 60_000)) {
    throw new ApiError(429, 'RATE_LIMITED', 'Scanner limit reached (10 scans/min). Wait a moment.')
  }
  const body = await parseBody(req, schema)
  const result = await scanTarget({ host: body.host, port: body.port, http: body.http })
  return ok(result)
}, { roles: rolesFor('infra:write') })
