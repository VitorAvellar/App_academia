import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExerciseBrowser } from '../components/ExerciseBrowser'
import { NewExerciseForm, Sheet } from '../components/ExercisePicker'

export function Catalog() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState<{ name: string; muscleGroup?: string } | null>(null)

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <button
          onClick={() => setCreating({ name: '' })}
          className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium"
        >
          + Meu exercício
        </button>
      </div>

      <ExerciseBrowser
        onSelect={(ex) => navigate(`/catalogo/${ex.id}`)}
        onCreateRequest={(prefill) => setCreating(prefill)}
      />

      <p className="mt-6 text-center text-xs text-slate-500">
        Exercícios da <a className="underline" href="https://wger.de" target="_blank" rel="noreferrer">wger</a> ·{' '}
        <button className="underline" onClick={() => navigate('/creditos')}>
          créditos
        </button>
      </p>

      {creating && (
        <Sheet title="Novo exercício" onClose={() => setCreating(null)}>
          <NewExerciseForm
            initialName={creating.name}
            initialGroup={creating.muscleGroup}
            onDone={(ex) => {
              setCreating(null)
              navigate(`/catalogo/${ex.id}`)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}
