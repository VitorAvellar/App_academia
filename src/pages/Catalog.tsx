import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExerciseBrowser } from '../components/ExerciseBrowser'
import { Sheet } from '../components/ExercisePicker'
import { exerciseRepo } from '../db/repositories/exerciseRepo'

const GROUPS = ['Peito', 'Costas', 'Ombros', 'Braços', 'Pernas', 'Panturrilha', 'Abdômen', 'Cardio']

export function Catalog() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <button onClick={() => setCreating(true)} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium">
          + Meu exercício
        </button>
      </div>

      <ExerciseBrowser onSelect={(ex) => navigate(`/catalogo/${ex.id}`)} />

      <p className="mt-6 text-center text-xs text-slate-500">
        Exercícios da <a className="underline" href="https://wger.de" target="_blank" rel="noreferrer">wger</a> ·{' '}
        <button className="underline" onClick={() => navigate('/creditos')}>
          créditos
        </button>
      </p>

      {creating && (
        <Sheet title="Novo exercício" onClose={() => setCreating(false)}>
          <NewExerciseForm
            onDone={(id) => {
              setCreating(false)
              navigate(`/catalogo/${id}`)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}

function NewExerciseForm({ onDone }: { onDone: (id: string) => void }) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState(GROUPS[0])
  const [equipment, setEquipment] = useState('')
  const [description, setDescription] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const ex = await exerciseRepo.createCustom({
      name,
      muscleGroup: group,
      equipment: equipment.trim() ? [equipment.trim()] : [],
      description,
    })
    onDone(ex.id)
  }

  const field = 'w-full rounded-lg bg-slate-800 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-500'
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Nome
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Grupo muscular
        <select className={field} value={group} onChange={(e) => setGroup(e.target.value)}>
          {GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Equipamento (opcional)
        <input className={field} value={equipment} onChange={(e) => setEquipment(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Observações (opcional)
        <textarea className={field} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <button type="submit" className="rounded-lg bg-green-600 py-3 font-medium">
        Salvar exercício
      </button>
    </form>
  )
}

