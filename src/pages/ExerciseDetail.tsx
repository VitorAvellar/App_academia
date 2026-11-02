import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ExerciseImage } from '../components/ExerciseImage'
import { exerciseRepo } from '../db/repositories/exerciseRepo'
import { setLogRepo } from '../db/repositories/sessionRepo'
import { formatKg } from '../lib/format'

export function ExerciseDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const exercise = useLiveQuery(() => exerciseRepo.get(id), [id])
  const last = useLiveQuery(() => setLogRepo.lastPerformance(id), [id])

  if (exercise === undefined) return <p className="p-4 text-slate-400">Carregando…</p>

  return (
    <div className="p-4">
      <button onClick={() => navigate(-1)} className="mb-3 text-sm text-slate-400">
        ← Voltar
      </button>

      <ExerciseImage exercise={exercise} className="mb-4 h-56 w-full" />
      <h1 className="text-2xl font-bold">{exercise.name}</h1>
      <p className="mt-1 text-sm text-slate-400">
        {exercise.muscleGroup}
        {exercise.equipment.length > 0 && ` · ${exercise.equipment.join(', ')}`}
      </p>

      {(exercise.musclesPrimary.length > 0 || exercise.musclesSecondary.length > 0) && (
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {exercise.musclesPrimary.length > 0 && (
            <>
              <dt className="text-slate-400">Principais</dt>
              <dd>{exercise.musclesPrimary.join(', ')}</dd>
            </>
          )}
          {exercise.musclesSecondary.length > 0 && (
            <>
              <dt className="text-slate-400">Secundários</dt>
              <dd>{exercise.musclesSecondary.join(', ')}</dd>
            </>
          )}
        </dl>
      )}

      {last && last.length > 0 && (
        <section className="mt-5 rounded-xl bg-slate-800 p-3">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Último treino deste exercício</h2>
          <ul className="space-y-1 text-sm">
            {last.map((l) => (
              <li key={l.id}>
                Série {l.setNumber}: {formatKg(l.weightKg)} × {l.reps}
              </li>
            ))}
          </ul>
        </section>
      )}

      {exercise.description && (
        <section className="mt-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-300">Como fazer</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">{exercise.description}</p>
        </section>
      )}

      {exercise.source === 'custom' && (
        <button
          onClick={async () => {
            if (confirm(`Excluir "${exercise.name}"?`)) {
              await exerciseRepo.removeCustom(exercise.id)
              navigate('/catalogo', { replace: true })
            }
          }}
          className="mt-6 w-full rounded-lg bg-red-900/60 py-3 text-sm text-red-200"
        >
          Excluir exercício
        </button>
      )}
    </div>
  )
}

