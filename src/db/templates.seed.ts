import type { AcademiaDB } from './db'
import type { TemplateItem, WorkoutTemplate } from './types'
import { newId, normalize } from '../lib/utils'

interface TemplateBlueprint {
  name: string
  description: string
  /** [nome do exercício no catálogo wger, séries, repetições] */
  items: [string, number, string][]
}

// A wger NÃO fornece fichas prontas, então montamos as nossas.
// Cada ficha referencia exercícios do catálogo pelo NOME (comparação sem acento/pontuação).
export const TEMPLATE_BLUEPRINTS: TemplateBlueprint[] = [
  {
    name: 'ABC – Treino A (Peito/Tríceps)',
    description: 'Divisão ABC: peito e tríceps.',
    items: [
      ['Supino reto', 4, '8-12'],
      ['Supino Inclinado com Halteres', 3, '8-12'],
      ['Crucifixo com halteres', 3, '10-12'],
      ['Cross-over na polia', 3, '12-15'],
      ['Extensão de tríceps na polia', 3, '10-12'],
      ['Tríceps testa com barra EZ', 3, '10-12'],
    ],
  },
  {
    name: 'ABC – Treino B (Costas/Bíceps)',
    description: 'Divisão ABC: costas e bíceps.',
    items: [
      ['Puxada Alta', 4, '8-12'],
      ['Remada Curvada', 4, '8-12'],
      ['Remada baixa', 3, '10-12'],
      ['Rosca direta com barra reta', 3, '10-12'],
      ['Rosca martelo alternada com halteres', 3, '10-12'],
    ],
  },
  {
    name: 'ABC – Treino C (Pernas/Ombros)',
    description: 'Divisão ABC: pernas, panturrilha e ombros.',
    items: [
      ['Agachamento completo com barra', 4, '8-10'],
      ['Leg press', 3, '10-12'],
      ['Cadeira extensora', 3, '12-15'],
      ['Flexora', 3, '12-15'],
      ['Desenvolvimento inclinado com halteres', 3, '8-12'],
      ['Elevação lateral na polia alta', 3, '12-15'],
      ['Panturrilha no Leg Press', 4, '12-15'],
    ],
  },
  {
    name: 'Push (Empurrar)',
    description: 'Push/Pull/Legs: peito, ombros e tríceps.',
    items: [
      ['Supino reto', 4, '8-10'],
      ['Supino Inclinado com Halteres', 3, '8-12'],
      ['Desenvolvimento inclinado com halteres', 3, '8-12'],
      ['Elevação lateral na polia alta', 3, '12-15'],
      ['Extensão de tríceps na polia', 3, '10-12'],
      ['Tríceps testa com barra EZ', 3, '10-12'],
    ],
  },
  {
    name: 'Pull (Puxar)',
    description: 'Push/Pull/Legs: costas e bíceps.',
    items: [
      ['Puxada Alta', 4, '8-12'],
      ['Remada Curvada', 4, '8-10'],
      ['Remada baixa', 3, '10-12'],
      ['Encolhimento com halteres', 3, '10-12'],
      ['Rosca direta com barra reta', 3, '10-12'],
      ['Rosca martelo alternada com halteres', 3, '10-12'],
    ],
  },
  {
    name: 'Legs (Pernas)',
    description: 'Push/Pull/Legs: pernas e panturrilha.',
    items: [
      ['Agachamento completo com barra', 4, '8-10'],
      ['Leg press', 4, '10-12'],
      ['Cadeira extensora', 3, '12-15'],
      ['Flexora', 3, '12-15'],
      ['Stiff', 3, '8-12'],
      ['Panturrilha no Leg Press', 4, '12-15'],
    ],
  },
  {
    name: 'Full Body',
    description: 'Corpo inteiro numa sessão só (2-3x por semana).',
    items: [
      ['Agachamento completo com barra', 3, '8-10'],
      ['Supino reto', 3, '8-10'],
      ['Remada Curvada', 3, '8-10'],
      ['Desenvolvimento inclinado com halteres', 3, '8-12'],
      ['Rosca direta com halteres', 2, '10-12'],
      ['Extensão de tríceps na polia', 2, '10-12'],
      ['Abdominal', 3, '15-20'],
    ],
  },
]

/**
 * Cria as fichas prontas UMA vez (flag na tabela `meta`).
 * Assim, se você apagar uma ficha pronta, ela não ressuscita ao reabrir o app.
 *
 * Retorna os nomes de exercícios que não foram encontrados no catálogo.
 */
export async function seedTemplates(db: AcademiaDB): Promise<{ created: number; missing: string[] }> {
  if ((await db.meta.get('templatesSeeded'))?.value === '1') return { created: 0, missing: [] }

  const exercises = await db.exercises.toArray()
  const byName = new Map(exercises.map((e) => [normalize(e.name), e.id]))
  const missing: string[] = []
  const templates: WorkoutTemplate[] = []

  const now = Date.now()
  for (const [index, bp] of TEMPLATE_BLUEPRINTS.entries()) {
    const items: TemplateItem[] = []
    for (const [name, targetSets, targetReps] of bp.items) {
      const exerciseId = byName.get(normalize(name))
      if (!exerciseId) {
        missing.push(name) // não quebra: a ficha só fica sem esse exercício
        continue
      }
      items.push({ exerciseId, targetSets, targetReps })
    }
    templates.push({
      id: newId(),
      name: bp.name,
      description: bp.description,
      items,
      // +index: todas seriam criadas no mesmo milissegundo e a ordenação por data
      // ficaria arbitrária. Somar o índice preserva a ordem da lista acima.
      createdAt: now + index,
    })
  }

  // Só marca como "semeado" se o catálogo existia; senão tenta de novo depois.
  if (exercises.length === 0) return { created: 0, missing: [] }

  await db.transaction('rw', db.templates, db.meta, async () => {
    await db.templates.bulkAdd(templates)
    await db.meta.put({ key: 'templatesSeeded', value: '1' })
  })

  if (missing.length) console.warn('[seed] exercícios de fichas não encontrados no catálogo:', missing)
  return { created: templates.length, missing }
}

