import { db } from '../db'
import type { TemplateItem, WorkoutTemplate } from '../types'
import { newId } from '../../lib/utils'

export const templateRepo = {
  list: () => db.templates.orderBy('createdAt').toArray(),

  get: (id: string) => db.templates.get(id),

  async create(data: { name: string; description?: string; items?: TemplateItem[] }): Promise<WorkoutTemplate> {
    const template: WorkoutTemplate = {
      id: newId(),
      name: data.name.trim(),
      description: data.description?.trim(),
      items: data.items ?? [],
      createdAt: Date.now(),
    }
    await db.templates.add(template)
    return template
  },

  /** Atualiza só os campos informados (o resto fica como estava). */
  update: (id: string, changes: Partial<Pick<WorkoutTemplate, 'name' | 'description' | 'items'>>) =>
    db.templates.update(id, changes),

  remove: (id: string) => db.templates.delete(id),
}

