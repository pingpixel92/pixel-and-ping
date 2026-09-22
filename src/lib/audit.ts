import { db } from './db'
import { logger } from './logger'
import type { LogLevel } from '@prisma/client'

export interface AuditInput {
  actorId?: string | null
  actorLabel: string
  action: string
  resourceType?: string | null
  resourceId?: string | null
  ip?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Records an audit entry for sensitive actions (login, delete, settings change…).
 * Metadata must never contain secrets — callers are responsible; redaction is a safety net.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        ip: input.ip ?? null,
        metadata: (input.metadata ?? null) as never,
      },
    })
  } catch (err) {
    logger.error('Failed to write audit log', { err: err instanceof Error ? err.message : String(err) })
  }
}

export interface LogInput {
  level?: LogLevel
  action: string
  actor?: string | null
  userId?: string | null
  resourceType?: string | null
  resourceId?: string | null
  message: string
  ip?: string | null
  meta?: Record<string, unknown> | null
}

export async function logEvent(input: LogInput): Promise<void> {
  try {
    await db.logEntry.create({
      data: {
        level: input.level ?? 'INFO',
        action: input.action,
        actor: input.actor ?? null,
        userId: input.userId ?? null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        message: input.message,
        ip: input.ip ?? null,
        meta: (input.meta ?? null) as never,
      },
    })
  } catch (err) {
    logger.error('Failed to write log entry', { err: err instanceof Error ? err.message : String(err) })
  }
}

export interface TrackInput {
  type: string
  level?: LogLevel
  source?: string
  message?: string | null
  meta?: Record<string, unknown> | null
}

export async function trackEvent(input: TrackInput): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        type: input.type,
        level: input.level ?? 'INFO',
        source: input.source ?? 'api',
        message: input.message ?? null,
        meta: (input.meta ?? null) as never,
      },
    })
  } catch (err) {
    logger.error('Failed to write analytics event', { err: err instanceof Error ? err.message : String(err) })
  }
}
