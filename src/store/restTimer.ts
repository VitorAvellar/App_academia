import { create } from 'zustand'

// ZUSTAND: estado global minúsculo. `create` devolve um "hook" (useRestTimer) que
// qualquer componente pode usar; quando o estado muda, só quem o lê é redesenhado.
//
// Guardamos o INSTANTE em que o descanso termina (endsAt), e não "segundos restantes".
// Assim o cronômetro continua certo mesmo se a tela do celular apagar por um tempo.
interface RestTimerState {
  endsAt: number | null
  /** Duração padrão escolhida, em segundos. */
  duration: number
  start: (seconds?: number) => void
  stop: () => void
  setDuration: (seconds: number) => void
}

export const useRestTimer = create<RestTimerState>((set, get) => ({
  endsAt: null,
  duration: 90,
  start: (seconds) => {
    const total = seconds ?? get().duration
    set({ endsAt: Date.now() + total * 1000, duration: total })
  },
  stop: () => set({ endsAt: null }),
  setDuration: (seconds) => set({ duration: seconds }),
}))

