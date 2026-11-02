import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, SetLog, WorkoutSession, WorkoutTemplate } from './types'

// Dexie é um "envelope" amigável em volta do IndexedDB (o banco de dados
// que vive dentro do navegador e continua funcionando offline).
//
// Em `stores()` listamos só os campos que precisam de ÍNDICE (para buscar rápido).
// O primeiro nome é a chave primária; os demais são índices. Os outros campos do
// objeto são gravados normalmente, mesmo sem aparecer aqui.
export class AcademiaDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  templates!: EntityTable<WorkoutTemplate, 'id'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  setLogs!: EntityTable<SetLog, 'id'>
  meta!: EntityTable<{ key: string; value: string }, 'key'>

  constructor(name = 'academia') {
    super(name)
    // Se um dia mudarmos o schema, criamos `version(2)` e o Dexie migra os dados.
    this.version(1).stores({
      exercises: 'id, wgerUuid, name, muscleGroup, source',
      templates: 'id, name, createdAt',
      sessions: 'id, startedAt, templateId',
      // Índice composto [exerciseId+loggedAt]: busca "última carga deste exercício".
      setLogs: 'id, sessionId, exerciseId, loggedAt, [exerciseId+loggedAt]',
      // Pequena tabela chave/valor para guardar flags internas (ex.: "fichas já criadas").
      meta: 'key',
    })
  }
}

export const db = new AcademiaDB()
