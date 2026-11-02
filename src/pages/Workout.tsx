import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ExerciseImage } from '../components/ExerciseImage'
import { ExercisePicker } from '../components/ExercisePicker'
import { RestDurationPicker } from '../components/RestTimer'
import { db } from '../db/db'
import { sessionRepo, setLogRepo } from '../db/repositories/sessionRepo'
import { templateRepo } from '../db/repositories/templateRepo'
import type { Exercise, SetLog, WorkoutSession } from '../db/types'
import { formatDate, formatDuration, formatKg, parseDecimal } from '../lib/format'
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
  const data = useLiveQuery(async () => {
    const templates = await templateRepo.list()
    const next = await sessionRepo.suggestNext(templates)
    return { templates, ...next }
  }, [])

  const templates = data?.templates
  const suggested = data?.suggested
  const lastSession = data?.lastSession

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Bora treinar 💪</h1>
      <p className="mb-4 text-sm text-slate-400">Escolha uma ficha para começar.</p>

      {suggested && lastSession && (
        <section className="mb-4 rounded-xl bg-green-950/60 p-4 ring-1 ring-green-700">
          <div className="text-xs font-medium uppercase tracking-wide text-green-400">
            Próximo da sequência
          </div>
          <div className="mt-0.5 text-lg font-bold text-slate-100">{suggested.name}</div>
          <div className="mt-0.5 text-xs text-slate-400">
            Último: {lastSession.name} ({formatDate(lastSession.startedAt)})
          </div>
          <button
            onClick={() => sessionRepo.start(suggested)}
            className="mt-3 w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white active:bg-green-700"
          >
            Iniciar {suggested.name} ▶
          </button>
        </section>
      )}

      <ul className="flex flex-col gap-2">
        {templates?.map((t) => {
          const isSuggested = suggested?.id === t.id
          return (
            <li key={t.id}>
              <button
                onClick={() => sessionRepo.start(t)}
                className="flex w-full items-center justify-between rounded-xl bg-slate-800 p-4 text-left active:bg-slate-700"
              >
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <span>{t.name}</span>
                    {isSuggested && (
                      <span className="rounded bg-green-900/80 px-1.5 py-0.5 text-[10px] font-medium text-green-300">
                        Sugerido
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400">{t.items.length} exercícios</div>
                </div>
                <span className="text-green-400">Iniciar ▶</span>
              </button>
            </li>
          )
        })}
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
  targetWeightKg?: number
}

function ActiveWorkout({ session }: { session: WorkoutSession }) {
  const navigate = useNavigate()
  const startRest = useRestTimer((s) => s.start)
  const stopRest = useRestTimer((s) => s.stop)
  const [picking, setPicking] = useState(false)
  const [replacingId, setReplacingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'finish' | 'discard' | null>(null)

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

  const skipped = new Set(session.skippedExerciseIds ?? [])

  // Monta os blocos: primeiro os da ficha (na ordem, exceto pulados), depois os extras adicionados no treino.
  const blocks: Block[] = []
  const seen = new Set<string>()
  for (const item of template.value?.items ?? []) {
    if (skipped.has(item.exerciseId)) continue
    const exercise = exercises.get(item.exerciseId)
    if (exercise && !seen.has(exercise.id)) {
      blocks.push({
        exercise,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        targetWeightKg: item.targetWeightKg,
      })
      seen.add(exercise.id)
    }
  }
  const extraIds = [...(session.extraExerciseIds ?? []), ...logs.map((l) => l.exerciseId)]
  for (const id of extraIds) {
    if (skipped.has(id)) continue
    const exercise = exercises.get(id)
    if (exercise && !seen.has(id)) {
      blocks.push({ exercise })
      seen.add(id)
    }
  }

  const totalSets = logs.length
  const plannedSets = blocks.reduce((sum, b) => sum + (b.targetSets ?? 0), 0)
  const progressPct = plannedSets > 0 ? Math.min(100, Math.round((totalSets / plannedSets) * 100)) : 0
  const volume = logs.reduce((sum, l) => sum + l.weightKg * l.reps, 0)

  async function executeFinish() {
    setConfirmAction(null)
    if (totalSets === 0) {
      await sessionRepo.remove(session.id)
      stopRest()
      return
    }
    await sessionRepo.finish(session.id)
    stopRest()
    navigate(`/historico/${session.id}`)
  }

  async function executeDiscard() {
    setConfirmAction(null)
    await sessionRepo.remove(session.id)
    stopRest()
  }

  return (
    <div className="p-4 pb-8">
      <header className="mb-3">
        <h1 className="text-xl font-bold">{session.name}</h1>
        <p className="text-sm text-slate-400">
          {formatDuration(now - session.startedAt)} · {totalSets}
          {plannedSets > 0 ? `/${plannedSets}` : ''} séries · {formatKg(volume)} de volume
        </p>

        {plannedSets > 0 && (
          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-1 text-right text-[11px] text-slate-400">{progressPct}% concluído</div>
          </div>
        )}

        <div className="mt-2">
          <RestDurationPicker />
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {blocks.map((b) => (
          <ExerciseBlock
            key={b.exercise.id}
            block={b}
            sessionId={session.id}
            logs={logs.filter((l) => l.exerciseId === b.exercise.id)}
            onLogged={() => startRest()}
            onReplace={() => setReplacingId(b.exercise.id)}
            onSkip={() => sessionRepo.skipExercise(session.id, b.exercise.id)}
          />
        ))}
      </div>

      <button onClick={() => setPicking(true)} className="mt-4 w-full rounded-lg bg-slate-700 py-3 text-sm font-medium">
        + Adicionar exercício
      </button>

      <div className="mt-6 flex gap-2">
        <button onClick={() => setConfirmAction('finish')} className="flex-1 rounded-lg bg-green-600 py-3 font-semibold">
          Finalizar treino
        </button>
        <button
          onClick={() => setConfirmAction('discard')}
          className="rounded-lg bg-red-900/60 px-4 py-3 text-sm text-red-200"
        >
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

      {replacingId && (
        <ExercisePicker
          title="Substituir exercício hoje"
          onClose={() => setReplacingId(null)}
          onPick={async (ex) => {
            const oldId = replacingId
            setReplacingId(null)
            await sessionRepo.replaceExercise(session.id, oldId, ex.id)
          }}
        />
      )}

      {confirmAction === 'finish' && (
        <ConfirmDialog
          title={totalSets === 0 ? 'Descartar treino vazio?' : 'Finalizar treino?'}
          message={
            totalSets === 0
              ? 'Nenhuma série foi registrada ainda. Deseja encerrar e descartar esta sessão?'
              : 'Suas séries serão salvas no histórico e as cargas superadas atualizarão sua ficha.'
          }
          confirmLabel={totalSets === 0 ? 'Descartar' : 'Finalizar'}
          danger={totalSets === 0}
          onCancel={() => setConfirmAction(null)}
          onConfirm={executeFinish}
        />
      )}

      {confirmAction === 'discard' && (
        <ConfirmDialog
          title="Cancelar treino?"
          message="Tem certeza que deseja apagar este treino em andamento e as séries feitas nele?"
          confirmLabel="Apagar treino"
          danger
          onCancel={() => setConfirmAction(null)}
          onConfirm={executeDiscard}
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
  onReplace: () => void
  onSkip: () => void
}

function ExerciseBlock({ block, sessionId, logs, onLogged, onReplace, onSkip }: BlockProps) {
  const { exercise, targetSets, targetReps, targetWeightKg } = block
  const navigate = useNavigate()
  const previous = useLiveQuery(() => setLogRepo.lastPerformance(exercise.id, sessionId), [exercise.id, sessionId])
  const progress = useLiveQuery(() => setLogRepo.exerciseProgress(exercise.id), [exercise.id])

  // `null` = o usuário ainda não digitou -> mostramos a sugestão.
  const [weight, setWeight] = useState<string | null>(null)
  const [reps, setReps] = useState<string | null>(null)
  const [note, setNote] = useState('')

  // Modo sanfona (Accordion): recolhe automaticamente ao atingir a meta de séries,
  // mas permite abrir/fechar manualmente a qualquer momento.
  const done = targetSets !== undefined && logs.length >= targetSets
  const [manualExpand, setManualExpand] = useState<boolean | null>(null)
  const isCollapsed = manualExpand !== null ? !manualExpand : done

  // Estado de edição inline de uma série já registrada
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editReps, setEditReps] = useState('')
  const [editNote, setEditNote] = useState('')

  const nextSet = logs.length + 1
  // Sugestão: 1) última série feita hoje; 2) mesma série do treino anterior; 3) meta cadastrada na ficha.
  const lastToday = logs[logs.length - 1]
  const lastTime = previous?.[nextSet - 1] ?? previous?.[previous.length - 1]
  const suggestion = lastToday ?? lastTime

  const suggestedWeight =
    suggestion !== undefined
      ? String(suggestion.weightKg).replace('.', ',')
      : targetWeightKg !== undefined
        ? String(targetWeightKg).replace('.', ',')
        : ''

  // Se não há histórico ainda, extrai o primeiro número de `targetReps` (ex.: "8-12" -> "8", "10" -> "10").
  const fallbackReps = targetReps?.match(/\d+/)?.[0] ?? ''
  const suggestedReps = suggestion !== undefined ? String(suggestion.reps) : fallbackReps

  const weightValue = weight ?? suggestedWeight
  const repsValue = reps ?? suggestedReps
  const maxEver = progress?.maxWeightKg ?? 0

  function stepWeight(delta: number) {
    const current = parseDecimal(weightValue)
    const next = Math.max(0, Math.round((current + delta) * 100) / 100)
    setWeight(String(next).replace('.', ','))
  }

  async function register() {
    const w = parseDecimal(weightValue)
    const r = Math.round(parseDecimal(repsValue))
    if (r <= 0 || w < 0) return
    const nextCount = logs.length + 1
    await setLogRepo.add({
      sessionId,
      exerciseId: exercise.id,
      weightKg: w,
      reps: r,
      note: note.trim() || undefined,
    })
    setWeight(null)
    setReps(null)
    setNote('')
    // Se acabou de bater a meta de séries, volta para o comportamento automático (recolher).
    if (targetSets !== undefined && nextCount >= targetSets) {
      setManualExpand(null)
    }
    onLogged()
  }

  function startEdit(log: SetLog) {
    setEditingId(log.id)
    setEditWeight(String(log.weightKg).replace('.', ','))
    setEditReps(String(log.reps))
    setEditNote(log.note ?? '')
  }

  async function saveEdit(id: string) {
    const w = parseDecimal(editWeight)
    const r = Math.round(parseDecimal(editReps))
    if (r <= 0 || w < 0) return
    await setLogRepo.update(id, {
      weightKg: w,
      reps: r,
      note: editNote.trim() || undefined,
    })
    setEditingId(null)
  }

  const input =
    'w-full rounded-lg bg-slate-900 px-3 py-3 text-center text-xl font-semibold outline-none focus:ring-2 focus:ring-green-500'

  // Visual compacto (Modo Sanfona recolhido) quando o exercício já foi concluído.
  if (isCollapsed) {
    return (
      <section className="rounded-xl bg-green-950/40 p-3 ring-1 ring-green-700/80">
        <div className="flex items-center gap-3">
          <ExerciseImage exercise={exercise} className="h-10 w-10" />
          <button
            type="button"
            onClick={() => setManualExpand(true)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="truncate font-semibold text-green-300">✓ {exercise.name}</div>
            <div className="truncate text-xs text-slate-300">
              {logs.map((l) => `${formatKg(l.weightKg)}×${l.reps}`).join(' · ')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setManualExpand(true)}
            className="shrink-0 rounded-lg bg-slate-800/90 px-2.5 py-1.5 text-xs text-slate-300"
          >
            Expandir ▼
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className={`rounded-xl p-3 ${done ? 'bg-green-950/50 ring-1 ring-green-700' : 'bg-slate-800'}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate(`/catalogo/${exercise.id}`)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ExerciseImage exercise={exercise} className="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{exercise.name}</div>
            {targetSets !== undefined && (
              <div className="text-xs text-slate-400">
                Meta: {targetSets} × {targetReps}
                {targetWeightKg !== undefined && ` · ${formatKg(targetWeightKg)}`} · feitas {logs.length}
                {done && ' ✓'}
              </div>
            )}
          </div>
        </button>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {maxEver > 0 && (
            <span className="rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] text-amber-300">
              PR {formatKg(maxEver)}
            </span>
          )}
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <button
              type="button"
              onClick={onReplace}
              className="rounded bg-slate-900/60 px-2 py-0.5 hover:text-slate-200"
              title="Substituir este exercício hoje"
            >
              ⇄ Trocar
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded bg-slate-900/60 px-2 py-0.5 hover:text-red-300"
              title="Pular este exercício hoje"
            >
              Pular
            </button>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => setManualExpand(false)}
                className="rounded bg-slate-900/60 px-2 py-0.5 text-slate-300"
                title="Recolher bloco"
              >
                ▲
              </button>
            )}
          </div>
        </div>
      </div>

      {previous && previous.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          Última vez: {previous.map((l) => `${formatKg(l.weightKg)}×${l.reps}`).join(' · ')}
        </p>
      )}

      {logs.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-700/60 text-sm">
          {logs.map((l) => {
            const isPr = l.weightKg > 0 && maxEver > 0 && l.weightKg >= maxEver
            if (editingId === l.id) {
              return (
                <li key={l.id} className="flex flex-col gap-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Série {l.setNumber}</span>
                    <input
                      inputMode="decimal"
                      aria-label={`Editar carga série ${l.setNumber}`}
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      className="w-20 rounded bg-slate-900 px-2 py-1 text-center font-semibold"
                    />
                    <span className="text-xs text-slate-400">kg ×</span>
                    <input
                      inputMode="numeric"
                      aria-label={`Editar reps série ${l.setNumber}`}
                      value={editReps}
                      onChange={(e) => setEditReps(e.target.value)}
                      className="w-16 rounded bg-slate-900 px-2 py-1 text-center font-semibold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Observação (ex.: drop-set, falha)…"
                      aria-label={`Editar nota série ${l.setNumber}`}
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="flex-1 rounded bg-slate-900 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(l.id)}
                      className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded bg-slate-700 px-2.5 py-1.5 text-xs text-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </li>
              )
            }
            return (
              <li key={l.id} className="flex items-center justify-between py-1.5">
                <div className="min-w-0 flex-1">
                  <span>
                    <span className="text-slate-400">Série {l.setNumber}</span> · {formatKg(l.weightKg)} × {l.reps}
                    {isPr && <span className="ml-1.5 text-xs text-amber-400">🏆 PR</span>}
                  </span>
                  {l.note && <div className="truncate text-xs text-slate-400">💬 {l.note}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(l)}
                    className="px-2 text-slate-400 hover:text-slate-200"
                    aria-label={`Editar série ${l.setNumber}`}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogRepo.remove(l.id)}
                    className="px-2 text-slate-500"
                    aria-label={`Remover série ${l.setNumber}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 flex items-end gap-2">
        <label className="flex-1 text-xs text-slate-400">
          <span className="flex items-center justify-between">
            <span>Carga (kg)</span>
            <span className="inline-flex gap-1">
              <button
                type="button"
                onClick={() => stepWeight(-2.5)}
                className="rounded bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-200"
              >
                -2,5
              </button>
              <button
                type="button"
                onClick={() => stepWeight(2.5)}
                className="rounded bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-200"
              >
                +2,5
              </button>
            </span>
          </span>
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

      <input
        type="text"
        placeholder="Observação da série (opcional, ex.: drop-set)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-2 w-full rounded-lg bg-slate-900/70 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-green-500"
      />
    </section>
  )
}
