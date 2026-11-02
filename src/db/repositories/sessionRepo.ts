import { db } from '../db'
import type { SetLog, WorkoutSession, WorkoutTemplate } from '../types'
import { newId } from '../../lib/utils'

/**
 * Fórmula de Epley para estimar 1RM (repetição máxima) a partir de peso × repetições:
 * 1RM ≈ peso × (1 + reps / 30). Para 1 repetição, é o próprio peso.
 */
export function estimate1Rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export interface ExerciseSessionSummary {
  sessionId: string
  sessionName: string
  date: number
  maxWeightKg: number
  best1RmKg: number
  volumeKg: number
  sets: SetLog[]
}

export interface PersonalRecord {
  maxWeightKg: number
  best1RmKg: number
  bestSet: SetLog | null
  totalSets: number
  sessions: ExerciseSessionSummary[]
}

export interface TrainedExerciseSummary {
  exerciseId: string
  maxWeightKg: number
  best1RmKg: number
  totalSets: number
  lastLoggedAt: number
}

/**
 * Descobre a qual "divisão" uma ficha pertence (ABC, Push/Pull/Legs ou personalizadas)
 * para que o ciclo A -> B -> C volte para A em vez de pular para outra divisão.
 */
function getSplitGroup(template: WorkoutTemplate, all: WorkoutTemplate[]): WorkoutTemplate[] {
  if (/^ABC\b/i.test(template.name)) {
    return all.filter((t) => /^ABC\b/i.test(t.name))
  }
  if (/^(Push|Pull|Legs)\b/i.test(template.name)) {
    return all.filter((t) => /^(Push|Pull|Legs)\b/i.test(t.name))
  }
  const customGroup = all.filter((t) => !/^ABC\b/i.test(t.name) && !/^(Push|Pull|Legs)\b/i.test(t.name))
  return customGroup.length > 0 ? customGroup : all
}

export const sessionRepo = {
  /** Treinos mais recentes primeiro. */
  listRecent: (limit = 50) => db.sessions.orderBy('startedAt').reverse().limit(limit).toArray(),

  get: (id: string) => db.sessions.get(id),

  /** Treino em andamento (iniciado e ainda não finalizado), se houver. */
  async getActive(): Promise<WorkoutSession | undefined> {
    const recent = await db.sessions.orderBy('startedAt').reverse().limit(5).toArray()
    return recent.find((s) => !s.finishedAt)
  },

  /** Começa um treino. Pode ser a partir de uma ficha ou "livre" (sem ficha). */
  async start(template?: WorkoutTemplate): Promise<WorkoutSession> {
    const session: WorkoutSession = {
      id: newId(),
      templateId: template?.id,
      name: template?.name ?? 'Treino livre',
      startedAt: Date.now(),
    }
    await db.sessions.add(session)
    return session
  },

  /**
   * Finaliza o treino e, se a sessão veio de uma ficha, atualiza automaticamente
   * o `targetWeightKg` dos exercícios da ficha caso você tenha levantado mais peso hoje.
   */
  async finish(id: string): Promise<void> {
    await db.transaction('rw', db.sessions, db.templates, db.setLogs, async () => {
      const session = await db.sessions.get(id)
      if (!session) return
      await db.sessions.update(id, { finishedAt: Date.now() })

      if (session.templateId) {
        const template = await db.templates.get(session.templateId)
        if (template) {
          const logs = await db.setLogs.where('sessionId').equals(id).toArray()
          let changed = false
          const updatedItems = template.items.map((item) => {
            const exLogs = logs.filter((l) => l.exerciseId === item.exerciseId)
            if (exLogs.length === 0) return item
            const maxToday = Math.max(...exLogs.map((l) => l.weightKg))
            if (maxToday > 0 && maxToday > (item.targetWeightKg ?? 0)) {
              changed = true
              return { ...item, targetWeightKg: maxToday }
            }
            return item
          })
          if (changed) {
            await db.templates.update(template.id, { items: updatedItems })
          }
        }
      }
    })
  },

  /** Inclui um exercício extra no treino em andamento (sem repetir e tirando de pulados). */
  async addExercise(id: string, exerciseId: string): Promise<void> {
    const s = await db.sessions.get(id)
    if (!s) return
    const extras = s.extraExerciseIds ?? []
    const skipped = (s.skippedExerciseIds ?? []).filter((x) => x !== exerciseId)
    await db.sessions.update(id, {
      extraExerciseIds: extras.includes(exerciseId) ? extras : [...extras, exerciseId],
      skippedExerciseIds: skipped,
    })
  },

  /** Pula/remove um exercício apenas na sessão de hoje (sem alterar a ficha original). */
  async skipExercise(id: string, exerciseId: string): Promise<void> {
    await db.transaction('rw', db.sessions, db.setLogs, async () => {
      const s = await db.sessions.get(id)
      if (!s) return
      const extras = (s.extraExerciseIds ?? []).filter((x) => x !== exerciseId)
      const skipped = s.skippedExerciseIds ?? []
      await db.sessions.update(id, {
        extraExerciseIds: extras,
        skippedExerciseIds: skipped.includes(exerciseId) ? skipped : [...skipped, exerciseId],
      })
      await db.setLogs
        .where('sessionId')
        .equals(id)
        .filter((l) => l.exerciseId === exerciseId)
        .delete()
    })
  },

  /** Substitui um exercício ocupado na academia por outro apenas na sessão de hoje. */
  async replaceExercise(id: string, oldExerciseId: string, newExerciseId: string): Promise<void> {
    if (oldExerciseId === newExerciseId) return
    await this.skipExercise(id, oldExerciseId)
    await this.addExercise(id, newExerciseId)
  },

  /** Apaga o treino e todas as suas séries juntos (transação = tudo ou nada). */
  remove: (id: string) =>
    db.transaction('rw', db.sessions, db.setLogs, async () => {
      await db.setLogs.where('sessionId').equals(id).delete()
      await db.sessions.delete(id)
    }),

  /**
   * Olha o último treino finalizado e sugere a próxima ficha da sequência
   * (ex.: se o último foi "ABC – Treino A", sugere "ABC – Treino B").
   */
  async suggestNext(templates: WorkoutTemplate[]): Promise<{
    suggested?: WorkoutTemplate
    lastSession?: WorkoutSession
  }> {
    if (templates.length === 0) return {}
    const recent = await db.sessions.orderBy('startedAt').reverse().limit(25).toArray()
    const finished = recent.filter((s) => Boolean(s.finishedAt))
    const lastWithTemplate = finished.find((s) => s.templateId && templates.some((t) => t.id === s.templateId))

    if (!lastWithTemplate) {
      return { lastSession: finished[0] }
    }

    const lastTemplate = templates.find((t) => t.id === lastWithTemplate.templateId)!
    const group = getSplitGroup(lastTemplate, templates)
    const idx = group.findIndex((t) => t.id === lastTemplate.id)
    const suggested = group[(idx + 1) % group.length]
    return { suggested, lastSession: lastWithTemplate }
  },
}

export const setLogRepo = {
  listBySession: (sessionId: string) => db.setLogs.where('sessionId').equals(sessionId).sortBy('loggedAt'),

  /** Registra uma série. O número da série é calculado automaticamente. */
  async add(data: {
    sessionId: string
    exerciseId: string
    weightKg: number
    reps: number
    note?: string
  }): Promise<SetLog> {
    const done = await db.setLogs
      .where('sessionId')
      .equals(data.sessionId)
      .filter((l) => l.exerciseId === data.exerciseId)
      .count()
    const log: SetLog = {
      id: newId(),
      ...data,
      setNumber: done + 1,
      loggedAt: Date.now(),
    }
    await db.setLogs.add(log)
    return log
  },

  update: (id: string, changes: Partial<Pick<SetLog, 'weightKg' | 'reps' | 'note'>>) =>
    db.setLogs.update(id, changes),

  remove: (id: string) => db.setLogs.delete(id),

  /**
   * Séries da ÚLTIMA sessão (anterior à atual) em que este exercício foi feito.
   * Usada para mostrar "da última vez você fez 60 kg x 10" durante o treino.
   * Usa o índice composto [exerciseId+loggedAt] para ser rápido.
   */
  async lastPerformance(exerciseId: string, excludeSessionId?: string): Promise<SetLog[]> {
    const logs = await db.setLogs
      .where('[exerciseId+loggedAt]')
      .between([exerciseId, MIN_TIME], [exerciseId, MAX_TIME])
      .reverse()
      .filter((l) => l.sessionId !== excludeSessionId)
      .toArray()
    if (logs.length === 0) return []
    const lastSessionId = logs[0].sessionId
    return logs.filter((l) => l.sessionId === lastSessionId).sort((a, b) => a.setNumber - b.setNumber)
  },

  /**
   * Calcula recordes pessoais (PR) e o histórico de evolução sessão a sessão
   * de um exercício para alimentar os cartões de recorde e o gráfico de carga.
   */
  async exerciseProgress(exerciseId: string): Promise<PersonalRecord> {
    const logs = await db.setLogs
      .where('[exerciseId+loggedAt]')
      .between([exerciseId, MIN_TIME], [exerciseId, MAX_TIME])
      .toArray()

    if (logs.length === 0) {
      return { maxWeightKg: 0, best1RmKg: 0, bestSet: null, totalSets: 0, sessions: [] }
    }

    const sessionIds = [...new Set(logs.map((l) => l.sessionId))]
    const sessionRows = await db.sessions.bulkGet(sessionIds)
    const sessionMap = new Map(
      sessionRows.filter((s): s is WorkoutSession => Boolean(s)).map((s) => [s.id, s]),
    )

    const grouped = new Map<string, SetLog[]>()
    let maxWeightKg = 0
    let best1RmKg = 0
    let bestSet: SetLog | null = null

    for (const log of logs) {
      const list = grouped.get(log.sessionId) ?? []
      list.push(log)
      grouped.set(log.sessionId, list)

      if (log.weightKg > maxWeightKg) maxWeightKg = log.weightKg
      const est = estimate1Rm(log.weightKg, log.reps)
      if (est > best1RmKg) best1RmKg = est
      if (
        !bestSet ||
        log.weightKg > bestSet.weightKg ||
        (log.weightKg === bestSet.weightKg && log.reps > bestSet.reps)
      ) {
        bestSet = log
      }
    }

    const sessions: ExerciseSessionSummary[] = [...grouped.entries()]
      .map(([sessionId, sets]) => {
        const session = sessionMap.get(sessionId)
        const sortedSets = [...sets].sort((a, b) => a.setNumber - b.setNumber)
        return {
          sessionId,
          sessionName: session?.name ?? 'Treino',
          date: session?.startedAt ?? sortedSets[0].loggedAt,
          maxWeightKg: Math.max(...sortedSets.map((s) => s.weightKg)),
          best1RmKg: Math.max(...sortedSets.map((s) => estimate1Rm(s.weightKg, s.reps))),
          volumeKg: sortedSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0),
          sets: sortedSets,
        }
      })
      .sort((a, b) => a.date - b.date)

    return { maxWeightKg, best1RmKg, bestSet, totalSets: logs.length, sessions }
  },

  /**
   * Resumo de todos os exercícios que o usuário já treinou (para a aba "Minha evolução"),
   * ordenados do mais recente para o mais antigo.
   */
  async listTrainedExercises(): Promise<TrainedExerciseSummary[]> {
    const logs = await db.setLogs.toArray()
    const map = new Map<string, TrainedExerciseSummary>()
    for (const l of logs) {
      const cur = map.get(l.exerciseId)
      const est = estimate1Rm(l.weightKg, l.reps)
      if (!cur) {
        map.set(l.exerciseId, {
          exerciseId: l.exerciseId,
          maxWeightKg: l.weightKg,
          best1RmKg: est,
          totalSets: 1,
          lastLoggedAt: l.loggedAt,
        })
      } else {
        if (l.weightKg > cur.maxWeightKg) cur.maxWeightKg = l.weightKg
        if (est > cur.best1RmKg) cur.best1RmKg = est
        cur.totalSets += 1
        if (l.loggedAt > cur.lastLoggedAt) cur.lastLoggedAt = l.loggedAt
      }
    }
    return [...map.values()].sort((a, b) => b.lastLoggedAt - a.lastLoggedAt)
  },
}

// Limites do índice composto: de "menor possível" a "maior possível" no campo de data.
const MIN_TIME = 0
const MAX_TIME = Number.MAX_SAFE_INTEGER
