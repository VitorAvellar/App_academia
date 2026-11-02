import type { AcademiaDB } from './db'
import type { CatalogEntry, Exercise } from './types'
import { newId } from '../lib/utils'

/**
 * Importa o catálogo da wger (JSON empacotado no app) para o IndexedDB.
 *
 * É um MERGE idempotente — pode rodar várias vezes sem duplicar nada:
 *  - exercício da wger que já existe (mesmo `wgerUuid`) -> atualiza os dados do catálogo,
 *    mantendo o `id` local (assim fichas e histórico continuam apontando para ele);
 *  - exercício novo -> é criado;
 *  - exercícios `custom` (criados por você) nunca são tocados.
 *
 * Para não gastar tempo a cada abertura do app, só roda se o catálogo mudou
 * (comparamos uma "assinatura" guardada na tabela `meta`).
 */
export async function seedExercises(
  db: AcademiaDB,
  catalog: CatalogEntry[],
): Promise<{ added: number; updated: number; skipped: boolean }> {
  const signature = `${catalog.length}:${JSON.stringify(catalog).length}`
  const saved = await db.meta.get('catalogSignature')
  if (saved?.value === signature) return { added: 0, updated: 0, skipped: true }

  let added = 0
  let updated = 0

  // Uma única transação: ou grava tudo, ou nada (evita catálogo pela metade).
  await db.transaction('rw', db.exercises, db.meta, async () => {
    const existing = await db.exercises.where('source').equals('wger').toArray()
    const byUuid = new Map(existing.map((e) => [e.wgerUuid, e]))

    const toAdd: Exercise[] = []
    const toPut: Exercise[] = []

    for (const entry of catalog) {
      const current = byUuid.get(entry.wgerUuid)
      if (current) {
        toPut.push({ ...entry, id: current.id, source: 'wger' })
        updated++
      } else {
        toAdd.push({ ...entry, id: newId(), source: 'wger' })
        added++
      }
    }

    await db.exercises.bulkAdd(toAdd)
    await db.exercises.bulkPut(toPut)
    await db.meta.put({ key: 'catalogSignature', value: signature })
  })

  return { added, updated, skipped: false }
}

