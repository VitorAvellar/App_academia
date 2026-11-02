import { useState } from 'react'
import type { ExerciseSessionSummary } from '../db/repositories/sessionRepo'
import { formatDate, formatKg } from '../lib/format'

type Metric = 'maxWeightKg' | 'best1RmKg'

interface Props {
  sessions: ExerciseSessionSummary[]
}

/**
 * Gráfico de evolução em SVG puro (sem bibliotecas pesadas).
 * Permite alternar entre a maior carga levantada na sessão e o 1RM estimado (Epley).
 */
export function ProgressChart({ sessions }: Props) {
  const [metric, setMetric] = useState<Metric>('maxWeightKg')

  if (sessions.length === 0) return null

  const points = sessions.slice(-12) // últimas 12 sessões para caber bem na tela do celular
  const values = points.map((p) => p[metric])
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const span = maxVal - minVal || 1

  const W = 320
  const H = 140
  const padX = 28
  const padY = 24
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? W / 2 : padX + (i / (points.length - 1)) * innerW
    const y = padY + innerH - ((p[metric] - minVal) / span) * innerH
    return { x, y, value: p[metric], date: p.date }
  })

  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')

  return (
    <section className="mt-5 rounded-xl bg-slate-800 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-300">Evolução de carga</h2>
        <div className="flex rounded-lg bg-slate-900 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMetric('maxWeightKg')}
            className={`rounded-md px-2 py-1 ${
              metric === 'maxWeightKg' ? 'bg-green-600 text-white' : 'text-slate-400'
            }`}
          >
            Carga máx.
          </button>
          <button
            type="button"
            onClick={() => setMetric('best1RmKg')}
            className={`rounded-md px-2 py-1 ${
              metric === 'best1RmKg' ? 'bg-green-600 text-white' : 'text-slate-400'
            }`}
          >
            1RM est.
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="Gráfico de evolução de carga"
      >
        {/* Linhas de base superior e inferior */}
        <line x1={padX} y1={padY} x2={W - padX} y2={padY} stroke="#334155" strokeDasharray="3 3" />
        <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="#334155" strokeDasharray="3 3" />

        {coords.length > 1 && (
          <polyline
            fill="none"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline}
          />
        )}

        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={4} fill="#22c55e" />
            <text
              x={c.x}
              y={c.y - 8}
              textAnchor="middle"
              className="fill-slate-200 text-[10px] font-medium"
            >
              {c.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{formatDate(points[0].date)}</span>
        <span>
          {points.length > 1
            ? `${formatDate(points[points.length - 1].date)} · máx ${formatKg(maxVal)}`
            : `1 sessão · ${formatKg(maxVal)}`}
        </span>
      </div>
    </section>
  )
}

