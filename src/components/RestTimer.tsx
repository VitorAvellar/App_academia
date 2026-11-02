import { useEffect, useState } from 'react'
import { useRestTimer } from '../store/restTimer'
import { formatClock } from '../lib/format'

const PRESETS = [60, 90, 120, 180]

/** Barra de descanso fixa acima do menu: mostra a contagem regressiva e avisa no fim. */
export function RestTimer() {
  const { endsAt, duration, start, stop } = useRestTimer()
  const [now, setNow] = useState(() => Date.now())

  // Atualiza o relógio 4x por segundo só enquanto há um descanso rodando.
  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [endsAt])

  const remaining = endsAt ? (endsAt - now) / 1000 : 0
  const finished = endsAt !== null && remaining <= 0

  // Ao terminar: vibra (se o aparelho suportar) e deixa o aviso na tela.
  useEffect(() => {
    if (finished) navigator.vibrate?.([200, 100, 200])
  }, [finished])

  if (!endsAt) return null

  return (
    <div
      className={`mx-3 mb-2 flex items-center justify-between rounded-xl px-4 py-2 shadow-lg ${
        finished ? 'bg-green-600' : 'bg-slate-700'
      }`}
      role="timer"
    >
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-200">
          {finished ? 'Descanso terminou!' : 'Descanso'}
        </div>
        <div className="text-2xl font-bold tabular-nums">{finished ? '0:00' : formatClock(remaining)}</div>
      </div>
      <div className="flex items-center gap-2">
        {!finished && (
          <button
            className="rounded-lg bg-slate-600 px-3 py-2 text-sm"
            onClick={() => start(Math.round(remaining) + 30)}
          >
            +30s
          </button>
        )}
        <button className="rounded-lg bg-slate-900/60 px-3 py-2 text-sm" onClick={() => start(duration)}>
          Reiniciar
        </button>
        <button className="rounded-lg bg-slate-900/60 px-3 py-2 text-sm" onClick={stop}>
          Fechar
        </button>
      </div>
    </div>
  )
}

/** Seletor da duração padrão do descanso (usado na tela de treino). */
export function RestDurationPicker() {
  const { duration, setDuration } = useRestTimer()
  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <span>Descanso:</span>
      {PRESETS.map((s) => (
        <button
          key={s}
          onClick={() => setDuration(s)}
          className={`rounded-full px-3 py-1 ${duration === s ? 'bg-green-600 text-white' : 'bg-slate-800'}`}
        >
          {s}s
        </button>
      ))}
    </div>
  )
}
