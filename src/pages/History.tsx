import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ExerciseImage } from '../components/ExerciseImage'
import { exportBackup, importBackup } from '../db/backup'
import { db } from '../db/db'
import { sessionRepo, setLogRepo } from '../db/repositories/sessionRepo'
import type { SetLog, WorkoutSession } from '../db/types'
import { formatDate, formatDuration, formatKg, formatTime } from '../lib/format'

const volumeOf = (logs: SetLog[]) => logs.reduce((s, l) => s + l.weightKg * l.reps, 0)
const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** Calcula os 7 dias da semana atual (domingo a sábado) e marca em quais houve treino concluído. */
function getWeekDays(sessions: WorkoutSession[]) {
  const now = new Date()
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
  return WEEKDAY_LABELS.map((label, idx) => {
    const dayStart = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate() + idx,
    ).getTime()
    const dayEnd = dayStart + 86400000
    const trained = sessions.some((s) => s.startedAt >= dayStart && s.startedAt < dayEnd)
    const isToday = idx === now.getDay()
    return { label, trained, isToday }
  })
}

export function History() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<'sessions' | 'evolution'>('sessions')

  // Busca sessões finalizadas, todas as séries e resumo dos exercícios treinados.
  const data = useLiveQuery(async () => {
    const [allSessions, logs, trained, exerciseList] = await Promise.all([
      sessionRepo.listRecent(100),
      db.setLogs.toArray(),
      setLogRepo.listTrainedExercises(),
      db.exercises.toArray(),
    ])
    const sessions = allSessions.filter((s) => s.finishedAt)
    const exercises = new Map(exerciseList.map((e) => [e.id, e]))
    return { sessions, logs, trained, exercises }
  }, [])

  if (!data) return <p className="p-4 text-slate-400">Carregando…</p>

  const totalVolume = volumeOf(data.logs)
  const weekDays = getWeekDays(data.sessions)
  const trainedDaysThisWeek = weekDays.filter((d) => d.trained).length

  async function handleExport() {
    const payload = await exportBackup()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `academia-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBackupMsg('Backup exportado!')
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const res = await importBackup(text)
      setBackupMsg(`Restaurado: ${res.sessions} treinos, ${res.setLogs} séries e ${res.templates} fichas.`)
    } catch (err) {
      setBackupMsg(err instanceof Error ? err.message : 'Erro ao importar backup.')
    }
  }

  return (
    <div className="p-4 pb-8">
      <h1 className="mb-3 text-2xl font-bold">Histórico</h1>

      {/* Frequência da semana atual */}
      <section className="mb-4 rounded-xl bg-slate-800 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span>Frequência nesta semana</span>
          <span className="font-semibold text-green-400">
            {trainedDaysThisWeek} {trainedDaysThisWeek === 1 ? 'dia treinado' : 'dias treinados'}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weekDays.map((d, idx) => (
            <div
              key={idx}
              className={`flex flex-col items-center rounded-lg py-1.5 text-xs ${
                d.trained
                  ? 'bg-green-600/25 font-bold text-green-300 ring-1 ring-green-600'
                  : d.isToday
                    ? 'bg-slate-700/70 text-slate-200'
                    : 'bg-slate-900/50 text-slate-500'
              }`}
            >
              <span>{d.label}</span>
              <span className="mt-0.5 text-[11px]">{d.trained ? '✓' : '·'}</span>
            </div>
          ))}
        </div>
      </section>

      {data.sessions.length > 0 && (
        <section className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <div className="text-xs text-slate-400">Treinos</div>
            <div className="mt-1 text-base font-bold text-slate-100">{data.sessions.length}</div>
          </div>
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <div className="text-xs text-slate-400">Séries</div>
            <div className="mt-1 text-base font-bold text-slate-100">{data.logs.length}</div>
          </div>
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <div className="text-xs text-slate-400">Volume total</div>
            <div className="mt-1 text-base font-bold text-green-400">{formatKg(totalVolume)}</div>
          </div>
        </section>
      )}

      {/* Alternador entre Sessões e Minha Evolução (PRs por exercício) */}
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-800 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setTab('sessions')}
          className={`rounded-lg py-2 ${tab === 'sessions' ? 'bg-green-600 text-white' : 'text-slate-400'}`}
        >
          Sessões ({data.sessions.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('evolution')}
          className={`rounded-lg py-2 ${tab === 'evolution' ? 'bg-green-600 text-white' : 'text-slate-400'}`}
        >
          Minha evolução ({data.trained.length})
        </button>
      </div>

      {tab === 'sessions' ? (
        <>
          {data.sessions.length === 0 && (
            <p className="py-8 text-center text-slate-500">Nenhum treino finalizado ainda.</p>
          )}
          <ul className="flex flex-col gap-2">
            {data.sessions.map((s) => {
              const logs = data.logs.filter((l) => l.sessionId === s.id)
              return (
                <li key={s.id}>
                  <button
                    onClick={() => navigate(`/historico/${s.id}`)}
                    className="w-full rounded-xl bg-slate-800 p-4 text-left active:bg-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-xs text-slate-400">{formatDate(s.startedAt)}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {formatDuration((s.finishedAt ?? s.startedAt) - s.startedAt)} · {logs.length} séries ·{' '}
                      {formatKg(volumeOf(logs))}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <>
          {data.trained.length === 0 && (
            <p className="py-8 text-center text-slate-500">
              Registre séries em um treino para ver sua evolução e recordes por exercício aqui.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {data.trained.map((item) => {
              const ex = data.exercises.get(item.exerciseId)
              if (!ex) return null
              return (
                <li key={item.exerciseId}>
                  <button
                    onClick={() => navigate(`/catalogo/${ex.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl bg-slate-800 p-3 text-left active:bg-slate-700"
                  >
                    <ExerciseImage exercise={ex} className="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{ex.name}</div>
                      <div className="text-xs text-slate-400">
                        {ex.muscleGroup} · {item.totalSets} séries feitas
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-amber-400">🏆 {formatKg(item.maxWeightKg)}</div>
                      <div className="text-[11px] text-slate-400">1RM est. {formatKg(item.best1RmKg)}</div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <section className="mt-6 rounded-xl bg-slate-800/80 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Backup dos dados</h2>
        <p className="mt-1 text-xs text-slate-400">
          Seus treinos e fichas ficam salvos só neste aparelho. Exporte um arquivo JSON para guardar cópia ou levar para
          outro celular.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 rounded-lg bg-slate-700 py-2.5 text-sm font-medium active:bg-slate-600"
          >
            Exportar (.json)
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-lg bg-slate-700 py-2.5 text-sm font-medium active:bg-slate-600"
          >
            Importar (.json)
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
        </div>
        {backupMsg && <p className="mt-2 text-xs text-green-400">{backupMsg}</p>}
      </section>
    </div>
  )
}

export function HistoryDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const data = useLiveQuery(async () => {
    const session = await sessionRepo.get(id)
    const logs = await setLogRepo.listBySession(id)
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
    return { session, logs, exercises }
  }, [id])

  if (!data) return <p className="p-4 text-slate-400">Carregando…</p>
  const { session, logs, exercises } = data
  if (!session) return <p className="p-4 text-slate-400">Treino não encontrado.</p>

  // Agrupa as séries por exercício, mantendo a ordem em que foram feitos.
  const groups = new Map<string, SetLog[]>()
  for (const l of logs) groups.set(l.exerciseId, [...(groups.get(l.exerciseId) ?? []), l])

  return (
    <div className="p-4 pb-8">
      <button onClick={() => navigate('/historico')} className="mb-3 text-sm text-slate-400">
        ← Histórico
      </button>
      <h1 className="text-2xl font-bold">{session.name}</h1>
      <p className="text-sm text-slate-400">
        {formatDate(session.startedAt)} às {formatTime(session.startedAt)}
        {session.finishedAt && ` · ${formatDuration(session.finishedAt - session.startedAt)}`} · {logs.length} séries ·{' '}
        {formatKg(volumeOf(logs))}
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {[...groups].map(([exerciseId, sets]) => (
          <section key={exerciseId} className="rounded-xl bg-slate-800 p-3">
            <h2 className="mb-1 font-semibold">{exercises.get(exerciseId)?.name ?? 'Exercício removido'}</h2>
            <ul className="text-sm text-slate-300">
              {sets.map((l) => (
                <li key={l.id}>
                  Série {l.setNumber}: {formatKg(l.weightKg)} × {l.reps}
                  {l.note && <span className="text-slate-400"> · 💬 {l.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="mt-6 w-full rounded-lg bg-red-900/60 py-3 text-sm text-red-200"
      >
        Apagar treino
      </button>

      {confirmDelete && (
        <ConfirmDialog
          title="Apagar treino do histórico?"
          message="Esta ação remove a sessão e todas as séries registradas nela."
          confirmLabel="Apagar"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await sessionRepo.remove(session.id)
            navigate('/historico', { replace: true })
          }}
        />
      )}
    </div>
  )
}
