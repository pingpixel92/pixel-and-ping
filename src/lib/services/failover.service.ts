import { db } from '@/lib/db'
import { pushNotification } from './notifications.service'
import { checkEndpointById } from './health.service'
import { logger } from '@/lib/logger'

/**
 * Failover evaluation. Performs REAL endpoint probes and updates rule state:
 *  - HEALTHY     → primary reachable
 *  - FAILED      → primary down (after failureThreshold)
 *  - CONFIGURED  → created but not yet failing
 *  - NOT_CHECKED → never evaluated
 * The state is informational for operators; the panel does not reroute traffic itself.
 */
export async function evaluateRule(ruleId: string): Promise<void> {
  const rule = await db.failoverRule.findUnique({
    where: { id: ruleId },
    include: { primaryEndpoint: true, backupEndpoint: true },
  })
  if (!rule) return

  const primary = await checkEndpointById(rule.primaryEndpointId).catch(() => ({
    ok: false,
    latencyMs: null,
    error: 'probe failed',
  }))
  const backup = rule.backupEndpointId
    ? await checkEndpointById(rule.backupEndpointId).catch(() => ({
        ok: false,
        latencyMs: null,
        error: 'probe failed',
      }))
    : null

  const failures = primary.ok ? 0 : rule.consecutiveFailures + 1
  const successes = primary.ok ? rule.consecutiveSuccesses + 1 : 0

  let state = rule.state
  let note: string
  if (primary.ok) {
    state = 'HEALTHY'
    note = `Primary reachable (${primary.latencyMs ?? '?'} ms)`
  } else if (failures >= rule.failureThreshold) {
    state = 'FAILED'
    note = backup?.ok
      ? `Primary down ×${failures}. Backup reachable (${backup.latencyMs ?? '?'} ms).`
      : `Primary down ×${failures}. Backup not reachable.`
  } else {
    state = 'CONFIGURED'
    note = `Primary probe failed (${failures}/${rule.failureThreshold})`
  }

  await db.failoverRule.update({
    where: { id: rule.id },
    data: {
      state,
      consecutiveFailures: failures,
      consecutiveSuccesses: successes,
      lastCheckedAt: new Date(),
      lastNote: note,
    },
  })

  if (state === 'FAILED' && rule.state !== 'FAILED') {
    await pushNotification({
      type: 'HEALTH',
      title: 'Failover rule failed',
      message: `Rule "${rule.name}": ${note}`,
      dedupeKey: `failover:${rule.id}:failed:${Math.floor(Date.now() / 3_600_000)}`,
      resourceType: 'FAILOVER',
      resourceId: rule.id,
    })
  }
  logger.debug('Failover rule evaluated', { rule: rule.name, state })
}

export async function runFailoverChecks(): Promise<number> {
  const rules = await db.failoverRule.findMany({ where: { enabled: true } })
  const now = Date.now()
  let checked = 0
  for (const rule of rules) {
    const last = rule.lastCheckedAt?.getTime() ?? 0
    if (now - last >= rule.checkIntervalSec * 1000) {
      await evaluateRule(rule.id)
      checked++
    }
  }
  return checked
}
