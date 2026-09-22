import { ok, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { listDnsRecords } from '@/lib/services/cloudflare.service'

/** GET /api/cloudflare/zones/:zoneId — live DNS records from the Cloudflare API. */
export const GET = withAuth<{ zoneId: string }>(async (_req, ctx) => {
  const records = await listDnsRecords(ctx.params.zoneId)
  return ok({ records })
}, { roles: rolesFor('cloudflare:manage') })
