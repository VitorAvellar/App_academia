import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ExerciseImage } from '../components/ExerciseImage'
import { ExercisePicker } from '../components/ExercisePicker'
import { RestDurationPicker } from '../components/RestTimer'
import { db } from '../db/db'
import { sessionRepo, setLogRepo } from '../db/repositories/sessionRepo'
import { templateRepo } from '../db/repositories/templateRepo'
import type { Exercise, SetLog, WorkoutSession } from '../db/types'
import { formatDuration, formatKg, parseDecimal } from '../lib/format'
import { useRestTimer } from '../store/restTimer'

/** Rota "/": se há treino em andamento mostra o treino; senão, o menu para começar. */
export function Workout() {
  // Embrulhamos em objeto para diferenciar "ainda carregando" (undefined) de "sem treino ativo".
  const state = useLiveQuery(async () => ({ session: await sessionRepo.getActive() }), [])
  if (!state) return <p className="p-4 text-slate-400">Carregando…</p>
  return state.session ? <ActiveWorkout session={state.session} /> : <StartWorkout />
}

// ---------------------------------------------------------------- iniciar

function StartWorkout() {
  const navigate = useNavigate()
  const templates = useLiveQuery(() => templateRepo.list(), [])

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Bora treinar 💪</h1>
      <p className="mb-4 text-sm text-slate-400">Escolha uma ficha para começar.</p>

      <ul className="flex flex-col gap-2">
        {templates?.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => sessionRepo.start(t)}
              className="flex w-full items-center justify-between rounded-xl bg-slate-800 p-4 text-left active:bg-slate-700"
            >
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-sm text-slate-400">{t.items.length} exercícios</div>
              </div>
              <span className="text-green-400">Iniciar ▶</span>
            </button>
          </li>
        ))}
      </ul>

      <button onClick={() => sessionRepo.start()} className="mt-3 w-full rounded-xl bg-slate-700 py-3 font-medium">
        Treino livre (sem ficha)
      </button>
      <button onClick={() => navigate('/fichas')} className="mt-2 w-full py-2 text-sm text-slate-400">
        Gerenciar fichas
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- treino ativo

interface Block {
  exercise: Exercise
  targetSets?: number
  targetReps?: string
}

function ActiveWorkout({ session }: { session: WorkoutSession }) {
  const navigate = useNavigate()
  const startRest = useRestTimer((s) => s.start)
  const stopRest = useRestTimer((s) => s.stop)
  const [picking, setPicking] = useState(false)

  const template = useLiveQuery(
    async () => (session.templateId ? { value: await templateRepo.get(session.templateId) } : { value: undefined }),
    [session.templateId],
  )
  const logs = useLiveQuery(() => setLogRepo.listBySession(session.id), [session.id])
  const exercises = useLiveQuery(() => db.exercises.toArray().then((l) => new Map(l.map((e) => [e.id, e]))), [])

  // Cronômetro do treino (minutos decorridos), atualizado a cada 30s.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  if (!template || !logs || !exercises) return <p className="p-4 text-slate-400">Carregando…</p>

  // Monta os blocos: primeiro os da ficha (na ordem), depois os extras adicionados no treino.
  const blocks: Block[] = []
  const seen = new Set<string>()
  for (const item of template.value?.items ?? []) {
    const exercise = exercises.get(item.exerciseId)
    if (exercise && !seen.has(exercise.id)) {
      blocks.push({ exercise, targetSets: item.targetSets, targetReps: item.targetReps })
      seen.add(exercise.id)
    }
  }
  const extraIds = [...(session.extraExerciseIds ?? []), ...logs.map((l) => l.exerciseId)]
  for (const id of extraIds) {
    const exercise = exercises.get(id)
    if (exercise && !seen.has(id)) {
      blocks.push({ exercise })
      seen.add(id)
    }
  }

  const totalSets = logs.length
  const volume = logs.reduce((sum, l) => sum + l.weightKg * l.reps, 0)

  async function finish() {
    if (totalSets === 0) {
      if (!confirm('Nenhuma série registrada. Descartar este treino?')) return
      await sessionRepo.remove(session.id)
    } else {
      if (!confirm('Finalizar o treino?')) return
      await sessionRepo.finish(session.id)
      stopRest()
      navigate(`/historico/${session.id}`)
      return
    }
    stopRest()
  }

  async function discard() {
    if (!confirm('Cancelar e apagar este treino e suas séries?')) return
    await sessionRepo.remove(session.id)
    stopRest()
  }

  return (
    <div className="p-4 pb-8">
      <header className="mb-3">
        <h1 className="text-xl font-bold">{session.name}</h1>
        <p className="text-sm text-slate-400">
          {formatDuration(now - session.startedAt)} · {totalSets} séries · {formatKg(volume)} de volume
        </p>
        <div className="mt-2">
          <RestDurationPicker />
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {blocks.map((b) => (
          <ExerciseBlock
            key={b.exercise.id}
            block={b}
            sessionId={session.id}
            logs={logs.filter((l) => l.exerciseId === b.exercise.id)}
            onLogged={() => startRest()}
          />
        ))}
      </div>

      <button onClick={() => setPicking(true)} className="mt-4 w-full rounded-lg bg-slate-700 py-3 text-sm font-medium">
        + Adicionar exercício
      </button>

      <div className="mt-6 flex gap-2">
        <button onClick={finish} className="flex-1 rounded-lg bg-green-600 py-3 font-semibold">
          Finalizar treino
        </button>
        <button onClick={discard} className="rounded-lg bg-red-900/60 px-4 py-3 text-sm text-red-200">
          Cancelar
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={async (ex) => {
            await sessionRepo.addExercise(session.id, ex.id)
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- bloco de exercício

interface BlockProps {
  block: Block
  sessionId: string
  logs: SetLog[]
  onLogged: () => void
}

function ExerciseBlock({ block, sessionId, logs, onLogged }: BlockProps) {
  const { exercise, targetSets, targetReps } = block
  const navigate = useNavigate()
  const previous = useLiveQuery(() => setLogRepo.lastPerformance(exercise.id, sessionId), [exercise.id, sessionId])

  // `null` = o usuário ainda não digitou -> mostramos a sugestão.
  const [weight, setWeight] = useState<string | null>(null)
  const [reps, setReps] = useState<string | null>(null)

  const nextSet = logs.length + 1
  // Sugestão: a última série feita hoje; senão a mesma série do treino anterior; senão a última dele.
  const lastToday = logs[logs.length - 1]
  const lastTime = previous?.[nextSet - 1] ?? previous?.[previous.length - 1]
  const suggestion = lastToday ?? lastTime

  const weightValue = weight ?? (suggestion ? String(suggestion.weightKg).replace('.', ',') : '')
  const repsValue = reps ?? (suggestion ? String(suggestion.reps) : '')

  const done = targetSets !== undefined && logs.length >= targetSets

  async function register() {
    const w = parseDecimal(weightValue)
    const r = Math.round(parseDecimal(repsValue))
    if (r <= 0 || w < 0) return
    await setLogRepo.add({ sessionId, exerciseId: exercise.id, weightKg: w, reps: r })
    setWeight(null)
    setReps(null)
    onLogged()
  }

  const input =
    'w-full rounded-lg bg-slate-900 px-3 py-3 text-center text-xl font-semibold outline-none focus:ring-2 focus:ring-green-500'

  return (
    <section className={`rounded-xl p-3 ${done ? 'bg-green-950/50 ring-1 ring-green-700' : 'bg-slate-800'}`}>
      <button onClick={() => navigate(`/catalogo/${exercise.id}`)} className="flex w-full items-center gap-3 text-left">
        <ExerciseImage exercise={exercise} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{exercise.name}</div>
          {targetSets !== undefined && (
            <div className="text-xs text-slate-400">
              Meta: {targetSets} × {targetReps} · feitas {logs.length}
              {done && ' ✓'}
            </div>
          )}
        </div>
      </button>

      {previous && previous.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          Última vez: {previous.map((l) => `${formatKg(l.weightKg)}×${l.reps}`).join(' · ')}
        </p>
      )}

      {logs.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-700/60 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-1.5">
              <span>
                <span className="text-slate-400">Série {l.setNumber}</span> · {formatKg(l.weightKg)} × {l.reps}
              </span>
              <button
                onClick={() => setLogRepo.remove(l.id)}
                className="px-2 text-slate-500"
                aria-label={`Remover série ${l.setNumber}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-end gap-2">
        <label className="flex-1 text-xs text-slate-400">
          Carga (kg)
          <input
            className={input}
            inputMode="decimal"
            value={weightValue}
            onChange={(e) => setWeight(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <label className="flex-1 text-xs text-slate-400">
          Reps
          <input
            className={input}
            inputMode="numeric"
            value={repsValue}
            onChange={(e) => setReps(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <button onClick={register} className="rounded-lg bg-green-600 px-4 py-3.5 font-semibold active:bg-green-700">
          ＋ Série {nextSet}
        </button>
      </div>
    </section>
  )
}

