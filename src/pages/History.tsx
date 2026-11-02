import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { sessionRepo, setLogRepo } from '../db/repositories/sessionRepo'
import type { SetLog } from '../db/types'
import { formatDate, formatDuration, formatKg, formatTime } from '../lib/format'

const volumeOf = (logs: SetLog[]) => logs.reduce((s, l) => s + l.weightKg * l.reps, 0)

export function History() {
  const navigate = useNavigate()
  // Busca sessões finalizadas + todas as séries de uma vez, para somar volume por sessão.
  const data = useLiveQuery(async () => {
    const sessions = (await sessionRepo.listRecent(100)).filter((s) => s.finishedAt)
    const logs = await db.setLogs.toArray()
    return { sessions, logs }
  }, [])

  if (!data) return <p className="p-4 text-slate-400">Carregando…</p>

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Histórico</h1>
      {data.sessions.length === 0 && <p className="py-8 text-center text-slate-500">Nenhum treino finalizado ainda.</p>}
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
    </div>
  )
}

export function HistoryDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
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
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <button
        onClick={async () => {
          if (confirm('Apagar este treino do histórico?')) {
            await sessionRepo.remove(session.id)
            navigate('/historico', { replace: true })
          }
        }}
        className="mt-6 w-full rounded-lg bg-red-900/60 py-3 text-sm text-red-200"
      >
        Apagar treino
      </button>
    </div>
  )
}

