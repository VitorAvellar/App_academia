import type { ReactNode } from 'react'
import type { Exercise } from '../db/types'
import { ExerciseBrowser } from './ExerciseBrowser'

interface Props {
  title?: string
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

/** Janela (tela cheia no celular) para escolher um exercício do catálogo. */
export function ExercisePicker({ title = 'Adicionar exercício', onPick, onClose }: Props) {
  return (
    <Sheet title={title} onClose={onClose}>
      <ExerciseBrowser onSelect={onPick} actionLabel="Adicionar" />
    </Sheet>
  )
}

/** Painel que cobre a tela, com cabeçalho e botão fechar. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900" role="dialog" aria-label={title}>
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm">
          Fechar
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  )
}

