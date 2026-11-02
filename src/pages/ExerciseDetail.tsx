import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ExerciseImage } from '../components/ExerciseImage'
import { NewExerciseForm, Sheet } from '../components/ExercisePicker'
import { ProgressChart } from '../components/ProgressChart'
import { exerciseRepo } from '../db/repositories/exerciseRepo'
import { setLogRepo } from '../db/repositories/sessionRepo'
import { formatDate, formatKg } from '../lib/format'

export function ExerciseDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const exercise = useLiveQuery(() => exerciseRepo.get(id), [id])
  const last = useLiveQuery(() => setLogRepo.lastPerformance(id), [id])
  const progress = useLiveQuery(() => setLogRepo.exerciseProgress(id), [id])

  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (exercise === undefined) return <p className="p-4 text-slate-400">Carregando…</p>

  return (
    <div className="p-4 pb-8">
      <button onClick={() => navigate(-1)} className="mb-3 text-sm text-slate-400">
        ← Voltar
      </button>

      <ExerciseImage exercise={exercise} className="mb-4 h-56 w-full" />
      <h1 className="text-2xl font-bold">{exercise.name}</h1>
      <p className="mt-1 text-sm text-slate-400">
        {exercise.muscleGroup}
        {exercise.equipment.length > 0 && ` · ${exercise.equipment.join(', ')}`}
        {exercise.source === 'custom' && ' · Exercício próprio'}
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

      {progress && progress.totalSets > 0 && (
        <section className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <div className="text-xs text-slate-400">🏆 Maior carga</div>
            <div className="mt-1 text-base font-bold text-green-400">{formatKg(progress.maxWeightKg)}</div>
          </div>
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <div className="text-xs text-slate-400">1RM estimado</div>
            <div className="mt-1 text-base font-bold text-slate-100">{formatKg(progress.best1RmKg)}</div>
          </div>
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <div className="text-xs text-slate-400">Melhor série</div>
            <div className="mt-1 text-base font-bold text-slate-100">
              {progress.bestSet ? `${formatKg(progress.bestSet.weightKg)}×${progress.bestSet.reps}` : '—'}
            </div>
          </div>
        </section>
      )}

      {progress && progress.sessions.length > 0 && <ProgressChart sessions={progress.sessions} />}

      {last && last.length > 0 && (
        <section className="mt-5 rounded-xl bg-slate-800 p-3">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Último treino deste exercício</h2>
          <ul className="space-y-1 text-sm">
            {last.map((l) => (
              <li key={l.id}>
                Série {l.setNumber}: {formatKg(l.weightKg)} × {l.reps}
                {l.note && <span className="text-slate-400"> · {l.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {progress && progress.sessions.length > 1 && (
        <section className="mt-5 rounded-xl bg-slate-800 p-3">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            Histórico no exercício ({progress.sessions.length} sessões)
          </h2>
          <ul className="divide-y divide-slate-700/60 text-sm">
            {[...progress.sessions].reverse().map((s) => (
              <li key={s.sessionId} className="py-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{s.sessionName}</span>
                  <span>{formatDate(s.date)}</span>
                </div>
                <div className="mt-0.5 text-slate-200">
                  {s.sets.map((l) => `${formatKg(l.weightKg)}×${l.reps}`).join(' · ')}
                </div>
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
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 rounded-lg bg-slate-700 py-3 text-sm font-medium text-slate-100 active:bg-slate-600"
          >
            Editar exercício
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg bg-red-900/60 px-4 py-3 text-sm text-red-200"
          >
            Excluir
          </button>
        </div>
      )}

      {editing && (
        <Sheet title="Editar exercício" onClose={() => setEditing(false)}>
          <NewExerciseForm
            exerciseId={exercise.id}
            initialName={exercise.name}
            initialGroup={exercise.muscleGroup}
            initialEquipment={exercise.equipment.join(', ')}
            initialDescription={exercise.description}
            submitLabel="Salvar alterações"
            onDone={() => setEditing(false)}
          />
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Excluir exercício"
          message={`Deseja excluir "${exercise.name}" do seu catálogo?`}
          confirmLabel="Excluir"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await exerciseRepo.removeCustom(exercise.id)
            navigate('/catalogo', { replace: true })
          }}
        />
      )}
    </div>
  )
}
