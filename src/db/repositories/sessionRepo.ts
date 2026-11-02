import { db } from '../db'
import type { SetLog, WorkoutSession, WorkoutTemplate } from '../types'
import { newId } from '../../lib/utils'

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

  finish: (id: string) => db.sessions.update(id, { finishedAt: Date.now() }),

  /** Inclui um exercício extra no treino em andamento (sem repetir). */
  async addExercise(id: string, exerciseId: string): Promise<void> {
    const s = await db.sessions.get(id)
    if (!s) return
    const extras = s.extraExerciseIds ?? []
    if (extras.includes(exerciseId)) return
    await db.sessions.update(id, { extraExerciseIds: [...extras, exerciseId] })
  },

  /** Apaga o treino e todas as suas séries juntos (transação = tudo ou nada). */
  remove: (id: string) =>
    db.transaction('rw', db.sessions, db.setLogs, async () => {
      await db.setLogs.where('sessionId').equals(id).delete()
      await db.sessions.delete(id)
    }),
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
}

// Limites do índice composto: de "menor possível" a "maior possível" no campo de data.
const MIN_TIME = 0
const MAX_TIME = Number.MAX_SAFE_INTEGER
