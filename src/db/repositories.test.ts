import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { exerciseRepo } from './repositories/exerciseRepo'
import { sessionRepo, setLogRepo } from './repositories/sessionRepo'
import { templateRepo } from './repositories/templateRepo'

// Aqui usamos o `db` global (é o que os repositórios usam); limpamos entre os testes.
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('exerciseRepo', () => {
  it('cria exercício custom e só permite remover custom', async () => {
    const mine = await exerciseRepo.createCustom({ name: '  Rosca Zottman ', muscleGroup: 'Braços' })
    expect(mine.name).toBe('Rosca Zottman')
    expect(mine.source).toBe('custom')

    await db.exercises.add({ ...mine, id: 'wger-1', source: 'wger' })
    await exerciseRepo.removeCustom('wger-1') // ignorado: veio da wger
    await exerciseRepo.removeCustom(mine.id)
    expect(await db.exercises.get('wger-1')).toBeDefined()
    expect(await db.exercises.get(mine.id)).toBeUndefined()
  })
})

describe('templateRepo', () => {
  it('cria, atualiza e remove fichas', async () => {
    const t = await templateRepo.create({ name: 'Treino X' })
    await templateRepo.update(t.id, { items: [{ exerciseId: 'e1', targetSets: 3, targetReps: '10' }] })
    expect((await templateRepo.get(t.id))?.items).toHaveLength(1)
    await templateRepo.remove(t.id)
    expect(await templateRepo.get(t.id)).toBeUndefined()
  })
})

describe('sessões e séries', () => {
  it('numera as séries automaticamente por exercício', async () => {
    const s = await sessionRepo.start()
    const a1 = await setLogRepo.add({ sessionId: s.id, exerciseId: 'a', weightKg: 20, reps: 10 })
    const b1 = await setLogRepo.add({ sessionId: s.id, exerciseId: 'b', weightKg: 30, reps: 8 })
    const a2 = await setLogRepo.add({ sessionId: s.id, exerciseId: 'a', weightKg: 22.5, reps: 8 })
    expect([a1.setNumber, a2.setNumber, b1.setNumber]).toEqual([1, 2, 1])
  })

  it('getActive acha o treino não finalizado; finish encerra', async () => {
    const s = await sessionRepo.start()
    expect((await sessionRepo.getActive())?.id).toBe(s.id)
    await sessionRepo.finish(s.id)
    expect(await sessionRepo.getActive()).toBeUndefined()
  })

  it('lastPerformance devolve as séries da última sessão anterior', async () => {
    const old = await sessionRepo.start()
    await setLogRepo.add({ sessionId: old.id, exerciseId: 'a', weightKg: 40, reps: 10 })
    await setLogRepo.add({ sessionId: old.id, exerciseId: 'a', weightKg: 42.5, reps: 8 })
    await sessionRepo.finish(old.id)

    await new Promise((r) => setTimeout(r, 5)) // garante loggedAt diferente
    const current = await sessionRepo.start()
    await setLogRepo.add({ sessionId: current.id, exerciseId: 'a', weightKg: 45, reps: 6 })

    const last = await setLogRepo.lastPerformance('a', current.id)
    expect(last.map((l) => [l.weightKg, l.reps])).toEqual([
      [40, 10],
      [42.5, 8],
    ])
    expect(await setLogRepo.lastPerformance('nunca-feito', current.id)).toEqual([])
  })

  it('remover sessão apaga também as séries dela', async () => {
    const s = await sessionRepo.start()
    await setLogRepo.add({ sessionId: s.id, exerciseId: 'a', weightKg: 10, reps: 10 })
    await sessionRepo.remove(s.id)
    expect(await db.setLogs.count()).toBe(0)
    expect(await db.sessions.count()).toBe(0)
  })
})

