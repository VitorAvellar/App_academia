import type { AcademiaDB } from './db'
import { db as defaultDb } from './db'
import type { Exercise, SetLog, WorkoutSession, WorkoutTemplate } from './types'

/**
 * Formato do arquivo de backup (.json).
 * Inclui apenas exercícios `custom` (os da wger já vêm no próprio app),
 * além de todas as fichas, sessões de treino e séries registradas.
 */
export interface BackupPayload {
  version: 1
  exportedAt: string
  customExercises: Exercise[]
  templates: WorkoutTemplate[]
  sessions: WorkoutSession[]
  setLogs: SetLog[]
}

/** Gera o objeto de backup pronto para salvar como JSON. */
export async function exportBackup(database: AcademiaDB = defaultDb): Promise<BackupPayload> {
  const [customExercises, templates, sessions, setLogs] = await Promise.all([
    database.exercises.where('source').equals('custom').toArray(),
    database.templates.toArray(),
    database.sessions.toArray(),
    database.setLogs.toArray(),
  ])

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    customExercises,
    templates,
    sessions,
    setLogs,
  }
}

/**
 * Restaura um backup JSON fazendo MERGE (`bulkPut`):
 * - se um item com o mesmo `id` já existir, é atualizado;
 * - itens novos são adicionados;
 * - nada do catálogo wger é apagado.
 */
export async function importBackup(
  rawJson: string,
  database: AcademiaDB = defaultDb,
): Promise<{ exercises: number; templates: number; sessions: number; setLogs: number }> {
  let parsed: Partial<BackupPayload>
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error('Arquivo JSON inválido.')
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray(parsed.templates) ||
    !Array.isArray(parsed.sessions) ||
    !Array.isArray(parsed.setLogs)
  ) {
    throw new Error('Formato de backup não reconhecido.')
  }

  const customExercises = Array.isArray(parsed.customExercises)
    ? parsed.customExercises.map((e) => ({ ...e, source: 'custom' as const }))
    : []

  await database.transaction(
    'rw',
    database.exercises,
    database.templates,
    database.sessions,
    database.setLogs,
    async () => {
      if (customExercises.length > 0) await database.exercises.bulkPut(customExercises)
      if (parsed.templates!.length > 0) await database.templates.bulkPut(parsed.templates!)
      if (parsed.sessions!.length > 0) await database.sessions.bulkPut(parsed.sessions!)
      if (parsed.setLogs!.length > 0) await database.setLogs.bulkPut(parsed.setLogs!)
    },
  )

  return {
    exercises: customExercises.length,
    templates: parsed.templates.length,
    sessions: parsed.sessions.length,
    setLogs: parsed.setLogs.length,
  }
}

