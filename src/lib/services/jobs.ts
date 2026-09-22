import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getJobState, getSettings, setJobState } from './settings.service'
import { runAllHealthChecks } from './health.service'
import { runFailoverChecks } from './failover.service'
import { scanExpiry } from './users.service'

/**
 * Background jobs — Railway-compatible scheduler.
 * A single 60s ticker evaluates which jobs are due based on persisted state,
 * so restarts never duplicate work. Intervals are bounded and configurable.
 */

const TICK_MS = 60_000

interface JobsGlobal {
  started: boolean
  running: boolean
}

const g = globalThis as unknown as { __ppJobs?: JobsGlobal }

async function dueState(job: keyof Awaited<ReturnType<typeof getJobState>>, intervalMs: number): Promise<boolean> {
  const state = await getJobState()
  const last = state[job] ? new Date(state[job] as string).getTime() : 0
  return Date.now() - last >= intervalMs
}

async function runTick(): Promise<void> {
  const g2 = g.__ppJobs
  if (!g2 || g2.running) return
  g2.running = true
  try {
    const settings = await getSettings()
    const nowIso = new Date().toISOString()

    // 1. Health checks (servers + endpoints).
    if (await dueState('healthCheck', settings.healthCheckIntervalMin * 60_000)) {
      await setJobState('healthCheck', nowIso)
      await runAllHealthChecks()
    }

    // 2. Expiry scan + alerts every 15 minutes.
    if (await dueState('expiryScan', 15 * 60_000)) {
      await setJobState('expiryScan', nowIso)
      const result = await scanExpiry(settings.expiryAlertDays, settings.notify.expiry)
      if (result.expired > 0 || result.alerted > 0) {
        logger.info('Expiry scan', { ...result })
      }
    }

    // 3. Session cleanup every 30 minutes.
    if (await dueState('sessionCleanup', 30 * 60_000)) {
      await setJobState('sessionCleanup', nowIso)
      const removed = await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
      if (removed.count > 0) logger.info('Session cleanup', { removed: removed.count })
    }

    // 4. Failover rule checks.
    if (await dueState('failoverCheck', 60_000)) {
      await setJobState('failoverCheck', nowIso)
      const checked = await runFailoverChecks()
      if (checked > 0) logger.debug('Failover checks', { checked })
    }
  } catch (err) {
    logger.error('Background job tick failed', { err: err instanceof Error ? err.message : String(err) })
  } finally {
    if (g.__ppJobs) g.__ppJobs.running = false
  }
}

export function startJobs(): void {
  if (g.__ppJobs?.started) return
  g.__ppJobs = { started: true, running: false }

  const timer = setInterval(() => {
    runTick().catch(() => undefined)
  }, TICK_MS)
  if (typeof timer.unref === 'function') timer.unref()

  logger.info('Background jobs scheduled', { tickMs: TICK_MS })

  // First run shortly after boot so health/status populate quickly.
  setTimeout(() => {
    runTick().catch(() => undefined)
  }, 15_000).unref?.()
}
