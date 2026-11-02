import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ExerciseImage } from '../components/ExerciseImage'
import { ExercisePicker } from '../components/ExercisePicker'
import { db } from '../db/db'
import { templateRepo } from '../db/repositories/templateRepo'
import type { Exercise, TemplateItem, WorkoutTemplate } from '../db/types'
import { parseDecimal } from '../lib/format'

/**
 * Carrega a ficha e os exercícios; quando ambos chegam, entrega ao formulário.
 * Separar "carregar" de "editar" evita copiar dados com useEffect: o formulário
 * simplesmente recebe o valor inicial no useState (e só é criado quando há dados).
 */
export function TemplateEditor() {
  const { id = '' } = useParams()
  const saved = useLiveQuery(() => templateRepo.get(id), [id])
  // Mapa id -> exercício, para mostrar nome/imagem de cada item da ficha.
  const exercises = useLiveQuery(() => db.exercises.toArray().then((l) => new Map(l.map((e) => [e.id, e]))), [])

  if (!saved || !exercises) return <p className="p-4 text-slate-400">Carregando…</p>
  return <TemplateForm key={saved.id} initial={saved} exercises={exercises} />
}

function TemplateForm({ initial, exercises }: { initial: WorkoutTemplate; exercises: Map<string, Exercise> }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<WorkoutTemplate>(initial)
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)

  /**
   * Auto-save: atualiza o estado local E já grava no IndexedDB imediatamente,
   * evitando perder edições se o usuário tocar em "← Fichas" ou trocar de aba.
   */
  function applyDraft(next: WorkoutTemplate) {
    setDraft(next)
    setAutoSaved(true)
    void templateRepo.update(next.id, {
      name: next.name.trim() || 'Ficha sem nome',
      description: next.description,
      items: next.items,
    })
  }

  const setItems = (items: TemplateItem[]) => applyDraft({ ...draft, items })
  const updateItem = (index: number, changes: Partial<TemplateItem>) =>
    setItems(draft.items.map((it, i) => (i === index ? { ...it, ...changes } : it)))
  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= draft.items.length) return
    const items = [...draft.items]
    ;[items[index], items[to]] = [items[to], items[index]]
    setItems(items)
  }

  async function save() {
    await templateRepo.update(draft.id, {
      name: draft.name.trim() || 'Ficha sem nome',
      description: draft.description,
      items: draft.items,
    })
    navigate('/fichas')
  }

  const headerInput =
    'w-full rounded-lg bg-slate-800 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500'
  // Fundo mais escuro (slate-900) para destacar os campos dentro do cartão (slate-800).
  const itemInput =
    'mt-1 w-full rounded-lg bg-slate-900 px-3 py-2 text-center text-base font-semibold outline-none focus:ring-2 focus:ring-green-500'

  return (
    <div className="p-4 pb-8">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => navigate('/fichas')} className="text-sm text-slate-400">
          ← Fichas
        </button>
        {autoSaved && <span className="text-xs text-green-400">✓ Salvo automaticamente</span>}
      </div>

      <input
        className={`${headerInput} text-xl font-bold`}
        value={draft.name}
        onChange={(e) => applyDraft({ ...draft, name: e.target.value })}
        aria-label="Nome da ficha"
      />

      <ul className="mt-4 flex flex-col gap-3">
        {draft.items.map((item, i) => {
          const ex = exercises.get(item.exerciseId)
          return (
            <li key={`${item.exerciseId}-${i}`} className="rounded-xl bg-slate-800 p-3">
              <div className="flex items-center gap-3">
                {ex && <ExerciseImage exercise={ex} className="h-12 w-12" />}
                <div className="min-w-0 flex-1 font-medium">{ex?.name ?? 'Exercício removido'}</div>
                <div className="flex items-center gap-1">
                  <button onClick={() => move(i, -1)} className="px-2 py-1 text-slate-400" aria-label="Subir">
                    ▲
                  </button>
                  <button onClick={() => move(i, 1)} className="px-2 py-1 text-slate-400" aria-label="Descer">
                    ▼
                  </button>
                  <button
                    onClick={() => setItems(draft.items.filter((_, idx) => idx !== i))}
                    className="ml-1 rounded-lg bg-red-900/60 px-2.5 py-1 text-xs text-red-200"
                  >
                    Remover
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <label className="text-xs text-slate-400">
                  Séries
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className={itemInput}
                    value={item.targetSets}
                    onChange={(e) => updateItem(i, { targetSets: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Reps
                  <input
                    className={itemInput}
                    value={item.targetReps}
                    placeholder="8-12"
                    onChange={(e) => updateItem(i, { targetReps: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Peso (kg)
                  <input
                    inputMode="decimal"
                    className={itemInput}
                    placeholder="Ex: 20"
                    value={item.targetWeightKg !== undefined ? String(item.targetWeightKg).replace('.', ',') : ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim()
                      updateItem(i, {
                        targetWeightKg: raw === '' ? undefined : Math.max(0, parseDecimal(raw)),
                      })
                    }}
                  />
                </label>
              </div>
            </li>
          )
        })}
      </ul>

      <button onClick={() => setPicking(true)} className="mt-4 w-full rounded-lg bg-slate-700 py-3 text-sm font-medium">
        + Adicionar exercício
      </button>

      <div className="mt-6 flex gap-2">
        <button onClick={save} className="flex-1 rounded-lg bg-green-600 py-3 font-medium">
          Salvar
        </button>
        <button onClick={() => setConfirmDelete(true)} className="rounded-lg bg-red-900/60 px-4 py-3 text-sm text-red-200">
          Excluir
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            setItems([...draft.items, { exerciseId: ex.id, targetSets: 3, targetReps: '8-12' }])
            setPicking(false)
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Excluir ficha"
          message={`Deseja excluir a ficha "${draft.name}"? O histórico de treinos realizados será mantido.`}
          confirmLabel="Excluir"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await templateRepo.remove(draft.id)
            navigate('/fichas', { replace: true })
          }}
        />
      )}
    </div>
  )
}
