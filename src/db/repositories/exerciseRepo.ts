import { db } from '../db'
import type { Exercise } from '../types'
import { newId } from '../../lib/utils'

// REPOSITÓRIO = a única porta de entrada para os dados de um assunto.
// As telas chamam estas funções; só aqui sabemos que o banco é o Dexie.
// Se um dia trocarmos por sincronização na nuvem, mudamos aqui e as telas nem notam.

/**
 * Se o usuário não preencher o equipamento ao criar um exercício próprio
 * (ex.: "Supino reto com halter"), inferimos pelo nome automaticamente.
 */
export function inferEquipment(name: string): string[] {
  const inferred: string[] = []
  if (/m[aáã]quina|leg press|hack|extensora|flexora|hammer|smith|peck|voador|adutora|abdutora|graviton/i.test(name)) {
    inferred.push('Máquina')
  }
  if (/halter/i.test(name)) inferred.push('Halteres')
  if (/barra fixa/i.test(name)) {
    inferred.push('Barra fixa')
  } else if (/\bbarra\b/i.test(name)) {
    inferred.push('Barra')
  }
  if (/polia|cabo|cross[- ]?over/i.test(name)) inferred.push('Polia')
  if (/kettlebell/i.test(name)) inferred.push('Kettlebell')
  if (/anilha/i.test(name)) inferred.push('Anilha')
  if (/el[aá]stico|banda/i.test(name)) inferred.push('Elástico')
  if (/banco/i.test(name)) inferred.push('Banco')
  return inferred
}

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
    const cleanName = data.name.trim()
    const providedEq = (data.equipment ?? []).map((e) => e.trim()).filter(Boolean)
    const exercise: Exercise = {
      id: newId(),
      name: cleanName,
      muscleGroup: data.muscleGroup,
      musclesPrimary: [],
      musclesSecondary: [],
      equipment: providedEq.length > 0 ? providedEq : inferEquipment(cleanName),
      description: data.description?.trim() ?? '',
      source: 'custom',
    }
    await db.exercises.add(exercise)
    return exercise
  },

  /** Atualiza um exercício próprio (`source === 'custom'`). */
  async updateCustom(
    id: string,
    data: {
      name: string
      muscleGroup: string
      equipment?: string[]
      description?: string
    },
  ): Promise<void> {
    const current = await db.exercises.get(id)
    if (current?.source !== 'custom') return
    const cleanName = data.name.trim()
    const providedEq = (data.equipment ?? []).map((e) => e.trim()).filter(Boolean)
    await db.exercises.update(id, {
      name: cleanName,
      muscleGroup: data.muscleGroup,
      equipment: providedEq.length > 0 ? providedEq : inferEquipment(cleanName),
      description: data.description?.trim() ?? '',
    })
  },

  /** Só exercícios próprios podem ser removidos; os da wger voltariam no próximo seed. */
  async removeCustom(id: string): Promise<void> {
    const ex = await db.exercises.get(id)
    if (ex?.source === 'custom') await db.exercises.delete(id)
  },
}
