import 'fake-indexeddb/auto' // simula o IndexedDB do navegador dentro do Node
import { beforeEach, describe, expect, it } from 'vitest'
import { AcademiaDB } from './db'
import { seedExercises } from './seed'
import { seedTemplates, TEMPLATE_BLUEPRINTS } from './templates.seed'
import type { CatalogEntry } from './types'
import catalogJson from '../data/exercises.pt.json'
import { normalize } from '../lib/utils'

const catalog = catalogJson as CatalogEntry[]

// Cada teste usa um banco novinho (nome único) para um não interferir no outro.
let db: AcademiaDB
let n = 0
beforeEach(() => {
  db = new AcademiaDB(`test-${n++}`)
})

const entry = (uuid: string, name: string): CatalogEntry => ({
  wgerUuid: uuid,
  name,
  muscleGroup: 'Peito',
  musclesPrimary: [],
  musclesSecondary: [],
  equipment: [],
  description: '',
})

describe('catálogo importado da wger', () => {
  it('tem exercícios em português, sem uuid repetido e sem descrição vazia', () => {
    expect(catalog.length).toBeGreaterThan(400)
    expect(new Set(catalog.map((e) => e.wgerUuid)).size).toBe(catalog.length)
    expect(catalog.every((e) => e.description.length > 0)).toBe(true)
  })

  it('todos os exercícios das fichas prontas existem no catálogo', () => {
    const names = new Set(catalog.map((e) => normalize(e.name)))
    const missing = TEMPLATE_BLUEPRINTS.flatMap((t) => t.items.map((i) => i[0])).filter(
      (name) => !names.has(normalize(name)),
    )
    expect(missing).toEqual([])
  })

  it('preenche equipamento inferido pelo nome em máquinas como Leg press e Cadeira extensora', () => {
    const legPress = catalog.find((e) => normalize(e.name) === 'leg press')
    const extensora = catalog.find((e) => normalize(e.name) === 'cadeira extensora')
    expect(legPress?.equipment).toContain('Máquina')
    expect(extensora?.equipment).toContain('Máquina')
  })
})

describe('seedExercises', () => {
  it('importa o catálogo completo na primeira vez', async () => {
    const res = await seedExercises(db, catalog)
    expect(res).toEqual({ added: catalog.length, updated: 0, skipped: false })
    expect(await db.exercises.count()).toBe(catalog.length)
  })

  it('não duplica ao rodar de novo (pula quando nada mudou)', async () => {
    await seedExercises(db, catalog)
    const res = await seedExercises(db, catalog)
    expect(res.skipped).toBe(true)
    expect(await db.exercises.count()).toBe(catalog.length)
  })

  it('merge: atualiza existente mantendo o id, adiciona novo e preserva exercício custom', async () => {
    await seedExercises(db, [entry('u1', 'Supino')])
    const original = (await db.exercises.toArray())[0]
    await db.exercises.add({ ...entry('', 'Meu exercício'), id: 'custom-1', wgerUuid: undefined, source: 'custom' })

    const res = await seedExercises(db, [entry('u1', 'Supino reto'), entry('u2', 'Crucifixo')])

    expect(res).toEqual({ added: 1, updated: 1, skipped: false })
    const updated = await db.exercises.get(original.id) // mesmo id de antes
    expect(updated?.name).toBe('Supino reto')
    expect(await db.exercises.get('custom-1')).toBeDefined()
    expect(await db.exercises.count()).toBe(3)
  })
})

describe('seedTemplates', () => {
  it('cria as fichas ligadas a exercícios reais, uma única vez', async () => {
    await seedExercises(db, catalog)
    const res = await seedTemplates(db)
    expect(res.missing).toEqual([])
    expect(res.created).toBe(TEMPLATE_BLUEPRINTS.length)

    const templates = await db.templates.toArray()
    for (const t of templates) {
      expect(t.items.length).toBeGreaterThan(0)
      for (const item of t.items) expect(await db.exercises.get(item.exerciseId)).toBeDefined()
    }

    expect((await seedTemplates(db)).created).toBe(0) // não repete
    expect(await db.templates.count()).toBe(TEMPLATE_BLUEPRINTS.length)
  })

  it('lista as fichas na mesma ordem em que foram definidas', async () => {
    await seedExercises(db, catalog)
    await seedTemplates(db)
    const ordered = await db.templates.orderBy('createdAt').toArray()
    expect(ordered.map((t) => t.name)).toEqual(TEMPLATE_BLUEPRINTS.map((b) => b.name))
  })

  it('não marca como feito se o catálogo ainda está vazio', async () => {
    expect((await seedTemplates(db)).created).toBe(0)
    await seedExercises(db, catalog)
    expect((await seedTemplates(db)).created).toBe(TEMPLATE_BLUEPRINTS.length)
  })
})

