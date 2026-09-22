import { db } from '@/lib/db'

export interface PanelSettings {
  healthCheckIntervalMin: number
  sessionTimeoutMin: number
  expiryAlertDays: number
  notify: {
    expiry: boolean
    health: boolean
    integration: boolean
  }
  appearance: {
    accent: 'blue' | 'navy'
    density: 'comfortable' | 'compact'
  }
}

export const DEFAULT_SETTINGS: PanelSettings = {
  healthCheckIntervalMin: 5,
  sessionTimeoutMin: 12 * 60,
  expiryAlertDays: 7,
  notify: { expiry: true, health: true, integration: true },
  appearance: { accent: 'blue', density: 'comfortable' },
}

const SETTINGS_KEY = 'panel'
const JOBS_KEY = 'jobs'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

function mergeSettings(base: PanelSettings, patch: DeepPartial<PanelSettings>): PanelSettings {
  return {
    ...base,
    ...patch,
    notify: { ...base.notify, ...(patch.notify ?? {}) },
    appearance: { ...base.appearance, ...(patch.appearance ?? {}) },
  }
}

export async function getSettings(): Promise<PanelSettings> {
  const row = await db.setting.findUnique({ where: { key: SETTINGS_KEY } })
  if (!row) return DEFAULT_SETTINGS
  try {
    return mergeSettings(DEFAULT_SETTINGS, row.value as DeepPartial<PanelSettings>)
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function updateSettings(patch: DeepPartial<PanelSettings>): Promise<PanelSettings> {
  const current = await getSettings()
  const next = mergeSettings(current, patch)
  await db.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: next as never },
    update: { value: next as never },
  })
  return next
}

export interface JobState {
  healthCheck?: string
  expiryScan?: string
  sessionCleanup?: string
  failoverCheck?: string
}

export async function getJobState(): Promise<JobState> {
  const row = await db.setting.findUnique({ where: { key: JOBS_KEY } })
  if (!row) return {}
  try {
    return row.value as JobState
  } catch {
    return {}
  }
}

export async function setJobState(job: keyof JobState, at: string): Promise<void> {
  const current = await getJobState()
  const next: JobState = { ...current, [job]: at }
  await db.setting.upsert({
    where: { key: JOBS_KEY },
    create: { key: JOBS_KEY, value: next as never },
    update: { value: next as never },
  })
}
