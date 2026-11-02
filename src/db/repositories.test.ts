import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportBackup, importBackup } from './backup'
import { db } from './db'
import { exerciseRepo } from './repositories/exerciseRepo'
import { estimate1Rm, sessionRepo, setLogRepo } from './repositories/sessionRepo'
import { templateRepo } from './repositories/templateRepo'
import { newId } from '../lib/utils'

// Aqui usamos o `db` global (é o que os repositórios usam); limpamos entre os testes.
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('newId em contexto HTTP sem crypto.randomUUID (ex.: 192.168.x.x)', () => {
  it('gera UUID v4 válido mesmo quando crypto.randomUUID não existe', () => {
    const spy = vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
      // Simula navegador no celular acessando via HTTP na rede local
      undefined as unknown as () => `${string}-${string}-${string}-${string}-${string}`,
    )
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })

    try {
      const id1 = newId()
      const id2 = newId()
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(id1).not.toBe(id2)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('exerciseRepo', () => {
  it('cria, edita e remove exercício custom (inferindo equipamento pelo nome)', async () => {
    const mine = await exerciseRepo.createCustom({
      name: '  Supino reto com halter ',
      muscleGroup: 'Peito',
    })
    expect(mine.name).toBe('Supino reto com halter')
    expect(mine.source).toBe('custom')
    expect(mine.equipment).toEqual(['Halteres'])

    await exerciseRepo.updateCustom(mine.id, {
      name: 'Supino reto na máquina',
      muscleGroup: 'Peito',
      description: 'Banco na altura 3',
    })
    const edited = await exerciseRepo.get(mine.id)
    expect(edited?.name).toBe('Supino reto na máquina')
    expect(edited?.equipment).toEqual(['Máquina'])
    expect(edited?.description).toBe('Banco na altura 3')

    await db.exercises.add({ ...mine, id: 'wger-1', source: 'wger' })
    await exerciseRepo.removeCustom('wger-1') // ignorado: veio da wger
    await exerciseRepo.removeCustom(mine.id)
    expect(await db.exercises.get('wger-1')).toBeDefined()
    expect(await db.exercises.get(mine.id)).toBeUndefined()
  })
})

describe('templateRepo', () => {
  it('cria, atualiza e remove fichas com peso, séries e repetições alvo', async () => {
    const t = await templateRepo.create({ name: 'Treino X' })
    await templateRepo.update(t.id, {
      items: [{ exerciseId: 'e1', targetSets: 4, targetReps: '8-12', targetWeightKg: 62.5 }],
    })
    const saved = await templateRepo.get(t.id)
    expect(saved?.items).toEqual([
      { exerciseId: 'e1', targetSets: 4, targetReps: '8-12', targetWeightKg: 62.5 },
    ])
    await templateRepo.remove(t.id)
    expect(await templateRepo.get(t.id)).toBeUndefined()
  })
})

describe('sessões, séries e evolução (PR)', () => {
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

  it('exerciseProgress calcula PR, 1RM estimado e histórico por sessão', async () => {
    const s1 = await sessionRepo.start()
    await setLogRepo.add({ sessionId: s1.id, exerciseId: 'supino', weightKg: 60, reps: 10 })
    await sessionRepo.finish(s1.id)

    await new Promise((r) => setTimeout(r, 5))
    const s2 = await sessionRepo.start()
    await setLogRepo.add({ sessionId: s2.id, exerciseId: 'supino', weightKg: 70, reps: 8 })
    await sessionRepo.finish(s2.id)

    const progress = await setLogRepo.exerciseProgress('supino')
    expect(progress.maxWeightKg).toBe(70)
    expect(progress.best1RmKg).toBe(estimate1Rm(70, 8))
    expect(progress.bestSet?.weightKg).toBe(70)
    expect(progress.totalSets).toBe(2)
    expect(progress.sessions.map((s) => s.maxWeightKg)).toEqual([60, 70])
  })

  it('edita peso, reps e observação (note) de uma série já registrada', async () => {
    const s = await sessionRepo.start()
    const log = await setLogRepo.add({
      sessionId: s.id,
      exerciseId: 'supino',
      weightKg: 600,
      reps: 10,
      note: 'pegada aberta',
    })
    expect(log.note).toBe('pegada aberta')

    await setLogRepo.update(log.id, { weightKg: 60, reps: 12, note: 'drop-set' })
    const updated = await db.setLogs.get(log.id)
    expect(updated?.weightKg).toBe(60)
    expect(updated?.reps).toBe(12)
    expect(updated?.note).toBe('drop-set')
  })

  it('suggestNext sugere a próxima ficha dentro da mesma divisão (ex.: ABC A -> B -> C -> A)', async () => {
    const a = await templateRepo.create({ name: 'ABC – Treino A (Peito/Tríceps)' })
    const b = await templateRepo.create({ name: 'ABC – Treino B (Costas/Bíceps)' })
    const c = await templateRepo.create({ name: 'ABC – Treino C (Pernas/Ombros)' })
    const push = await templateRepo.create({ name: 'Push (Empurrar)' })
    const templates = [a, b, c, push]

    // Sem treino concluído ainda -> não sugere nada
    expect((await sessionRepo.suggestNext(templates)).suggested).toBeUndefined()

    // Concluiu Treino A -> sugere Treino B
    const s1 = await sessionRepo.start(a)
    await sessionRepo.finish(s1.id)
    expect((await sessionRepo.suggestNext(templates)).suggested?.id).toBe(b.id)

    // Concluiu Treino C -> volta para Treino A (sem pular para Push)
    await new Promise((r) => setTimeout(r, 5))
    const s2 = await sessionRepo.start(c)
    await sessionRepo.finish(s2.id)
    expect((await sessionRepo.suggestNext(templates)).suggested?.id).toBe(a.id)
  })

  it('skipExercise, replaceExercise e atualização automática de targetWeightKg ao finalizar', async () => {
    const tpl = await templateRepo.create({
      name: 'Treino Peito',
      items: [
        { exerciseId: 'supino-barra', targetSets: 3, targetReps: '8-12', targetWeightKg: 50 },
        { exerciseId: 'voador', targetSets: 3, targetReps: '12', targetWeightKg: 40 },
      ],
    })
    const s = await sessionRepo.start(tpl)

    // Substitui 'voador' ocupado por 'crossover' só hoje
    await sessionRepo.replaceExercise(s.id, 'voador', 'crossover')
    const afterReplace = await sessionRepo.get(s.id)
    expect(afterReplace?.skippedExerciseIds).toEqual(['voador'])
    expect(afterReplace?.extraExerciseIds).toEqual(['crossover'])

    // Supera a carga planejada no supino-barra (fez 55 kg vs 50 kg na ficha)
    await setLogRepo.add({ sessionId: s.id, exerciseId: 'supino-barra', weightKg: 55, reps: 10 })
    await sessionRepo.finish(s.id)

    const updatedTpl = await templateRepo.get(tpl.id)
    expect(updatedTpl?.items[0].targetWeightKg).toBe(55)
    expect(updatedTpl?.items[1].targetWeightKg).toBe(40)

    const trained = await setLogRepo.listTrainedExercises()
    expect(trained).toHaveLength(1)
    expect(trained[0].exerciseId).toBe('supino-barra')
    expect(trained[0].maxWeightKg).toBe(55)
  })

  it('remover sessão apaga também as séries dela', async () => {
    const s = await sessionRepo.start()
    await setLogRepo.add({ sessionId: s.id, exerciseId: 'a', weightKg: 10, reps: 10 })
    await sessionRepo.remove(s.id)
    expect(await db.setLogs.count()).toBe(0)
    expect(await db.sessions.count()).toBe(0)
  })
})

describe('backup JSON (exportBackup e importBackup)', () => {
  it('exporta e restaura exercícios custom, fichas, sessões e séries', async () => {
    const custom = await exerciseRepo.createCustom({ name: 'Remada Meadows', muscleGroup: 'Costas' })
    const tpl = await templateRepo.create({
      name: 'Ficha Costas',
      items: [{ exerciseId: custom.id, targetSets: 3, targetReps: '10' }],
    })
    const sess = await sessionRepo.start(tpl)
    await setLogRepo.add({ sessionId: sess.id, exerciseId: custom.id, weightKg: 35, reps: 10 })
    await sessionRepo.finish(sess.id)

    const backup = await exportBackup(db)
    const raw = JSON.stringify(backup)

    // Limpa tudo e restaura a partir do JSON
    await Promise.all(db.tables.map((t) => t.clear()))
    expect(await db.sessions.count()).toBe(0)

    const res = await importBackup(raw, db)
    expect(res).toEqual({ exercises: 1, templates: 1, sessions: 1, setLogs: 1 })
    expect((await db.exercises.get(custom.id))?.name).toBe('Remada Meadows')
    expect((await db.setLogs.toArray())[0].weightKg).toBe(35)
  })
})
