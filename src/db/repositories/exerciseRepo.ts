import { db } from '../db'
import type { Exercise } from '../types'
import { newId } from '../../lib/utils'

// REPOSITÓRIO = a única porta de entrada para os dados de um assunto.
// As telas chamam estas funções; só aqui sabemos que o banco é o Dexie.
// Se um dia trocarmos por sincronização na nuvem, mudamos aqui e as telas nem notam.

export const exerciseRepo = {
  list: () => db.exercises.orderBy('name').toArray(),

  get: (id: string) => db.exercises.get(id),

  /** Cria um exercício próprio (fora do catálogo da wger). */
  async createCustom(data: {
    name: string
    muscleGroup: string
    equipment?: string[]
    description?: string
  }): Promise<Exercise> {
    const exercise: Exercise = {
      id: newId(),
      name: data.name.trim(),
      muscleGroup: data.muscleGroup,
      musclesPrimary: [],
      musclesSecondary: [],
      equipment: data.equipment ?? [],
      description: data.description?.trim() ?? '',
      source: 'custom',
    }
    await db.exercises.add(exercise)
    return exercise
  },

  /** Só exercícios próprios podem ser removidos; os da wger voltariam no próximo seed. */
  async removeCustom(id: string): Promise<void> {
    const ex = await db.exercises.get(id)
    if (ex?.source === 'custom') await db.exercises.delete(id)
  },
}

