import { db } from '@/lib/db'
import { ok, searchParams, withAuth } from '@/lib/api'

/** GET /api/search?q= — feeds the command palette with real database results. */
export const GET = withAuth(async (req) => {
  const q = (searchParams(req).get('q') ?? '').trim().slice(0, 64)
  if (q.length < 2) {
    return ok({ users: [], servers: [], endpoints: [], configs: [] })
  }
  const contains = { contains: q, mode: 'insensitive' as const }

  const [users, servers, endpoints, configs] = await Promise.all([
    db.vpnUser.findMany({
      where: { OR: [{ username: contains }, { displayName: contains }, { email: contains }] },
      take: 5,
      select: { id: true, username: true, displayName: true, status: true },
    }),
    db.server.findMany({
      where: { OR: [{ name: contains }, { host: contains }, { ip: contains }] },
      take: 5,
      select: { id: true, name: true, host: true, status: true },
    }),
    db.endpoint.findMany({
      where: { OR: [{ name: contains }, { address: contains }] },
      take: 5,
      select: { id: true, name: true, address: true, port: true, status: true },
    }),
    db.config.findMany({
      where: { name: contains },
      take: 5,
      select: { id: true, name: true, protocol: true, createdAt: true },
    }),
  ])

  return ok({ users, servers, endpoints, configs })
})
