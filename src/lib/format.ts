/** Formatadores de exibição (datas, duração, carga). Tudo em pt-BR. */

export const formatDate = (ms: number): string =>
  new Date(ms).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })

export const formatTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** 3725 segundos -> "1h02" ; 125 -> "2 min". */
export function formatDuration(totalMs: number): string {
  const minutes = Math.max(0, Math.round(totalMs / 60000))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

/** 62.5 -> "62,5 kg"; 60 -> "60 kg". */
export const formatKg = (kg: number): string =>
  `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`

/** 135 -> "2:15" (cronômetro de descanso). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Aceita "62,5" ou "62.5" digitado no celular brasileiro. */
export function parseDecimal(text: string): number {
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

