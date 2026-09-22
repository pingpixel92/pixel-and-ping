import { NextResponse } from 'next/server'

/**
 * Railway health endpoint.
 * GET /health → {"ok":true}
 */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
}
