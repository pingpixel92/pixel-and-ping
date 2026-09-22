import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { SESSION_COOKIE } from '@/lib/auth'
import { ok, withAuth } from '@/lib/api'
import { getIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ip = getIp(req)
  await db.session.delete({ where: { id: ctx.auth.sessionId } }).catch(() => undefined)
  await audit({ actorId: ctx.auth.id, actorLabel: ctx.auth.username, action: 'LOGOUT', ip })

  const res = ok({ loggedOut: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
})
