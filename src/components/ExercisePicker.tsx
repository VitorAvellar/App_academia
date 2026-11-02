import { useState, type ReactNode } from 'react'
import { exerciseRepo } from '../db/repositories/exerciseRepo'
import type { Exercise } from '../db/types'
import { ExerciseBrowser } from './ExerciseBrowser'

const MUSCLE_GROUPS = [
  'Peito',
  'Costas',
  'Ombros',
  'Braços',
  'Pernas',
  'Panturrilha',
  'Abdômen',
  'Cardio',
]

interface Props {
  title?: string
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

/**
 * Janela (tela cheia no celular) para escolher um exercício do catálogo
 * OU criar um exercício próprio na hora (caso não exista na API da wger)
 * e já adicioná-lo direto na ficha/treino.
 */
export function ExercisePicker({ title = 'Adicionar exercício', onPick, onClose }: Props) {
  const [creating, setCreating] = useState<{ name: string; muscleGroup?: string } | null>(null)

  if (creating) {
    return (
      <Sheet title="Criar exercício próprio" onClose={() => setCreating(null)} closeLabel="← Voltar">
        <NewExerciseForm
          initialName={creating.name}
          initialGroup={creating.muscleGroup}
          submitLabel="Salvar e adicionar à ficha"
          onDone={(exercise) => {
            setCreating(null)
            onPick(exercise)
          }}
        />
      </Sheet>
    )
  }

  return (
    <Sheet
      title={title}
      onClose={onClose}
      headerExtra={
        <button
          type="button"
          onClick={() => setCreating({ name: '' })}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white active:bg-green-700"
        >
          + Criar novo
        </button>
      }
    >
      <ExerciseBrowser
        onSelect={onPick}
        actionLabel="Adicionar"
        onCreateRequest={(prefill) => setCreating(prefill)}
      />
    </Sheet>
  )
}

/** Formulário reutilizável para criar ou editar um exercício próprio (no Catálogo ou dentro da Ficha). */
export function NewExerciseForm({
  exerciseId,
  initialName = '',
  initialGroup,
  initialEquipment = '',
  initialDescription = '',
  submitLabel = 'Salvar exercício',
  onDone,
}: {
  exerciseId?: string
  initialName?: string
  initialGroup?: string
  initialEquipment?: string
  initialDescription?: string
  submitLabel?: string
  onDone: (exercise: Exercise) => void
}) {
  const [name, setName] = useState(initialName)
  const [group, setGroup] = useState(
    initialGroup && MUSCLE_GROUPS.includes(initialGroup) ? initialGroup : MUSCLE_GROUPS[0],
  )
  const [equipment, setEquipment] = useState(initialEquipment)
  const [description, setDescription] = useState(initialDescription)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const eqList = equipment
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (exerciseId) {
      await exerciseRepo.updateCustom(exerciseId, {
        name,
        muscleGroup: group,
        equipment: eqList,
        description,
      })
      const updated = await exerciseRepo.get(exerciseId)
      if (updated) onDone(updated)
      return
    }
    const ex = await exerciseRepo.createCustom({
      name,
      muscleGroup: group,
      equipment: eqList,
      description,
    })
    onDone(ex)
  }

  const field = 'w-full rounded-lg bg-slate-800 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-500'
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Nome do exercício
        <input
          className={field}
          placeholder="Ex: Supino reto com halter"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Grupo muscular
        <select className={field} value={group} onChange={(e) => setGroup(e.target.value)}>
          {MUSCLE_GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Equipamento (opcional)
        <input
          className={field}
          placeholder="Ex: Halteres, Máquina, Polia…"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Observações / Como fazer (opcional)
        <textarea className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <button type="submit" className="rounded-lg bg-green-600 py-3 font-semibold text-white active:bg-green-700">
        {submitLabel}
      </button>
    </form>
  )
}

/** Painel que cobre a tela, com cabeçalho e botão fechar. */
export function Sheet({
  title,
  onClose,
  closeLabel = 'Fechar',
  headerExtra,
  children,
}: {
  title: string
  onClose: () => void
  closeLabel?: string
  headerExtra?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900" role="dialog" aria-label={title}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <h2 className="truncate text-lg font-semibold">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          {headerExtra}
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm">
            {closeLabel}
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  )
}
