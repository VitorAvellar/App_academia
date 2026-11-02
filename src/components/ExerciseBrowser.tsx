import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { exerciseRepo } from '../db/repositories/exerciseRepo'
import type { Exercise } from '../db/types'
import { normalize } from '../lib/utils'
import { ExerciseImage } from './ExerciseImage'

const PAGE = 40

interface Props {
  /** Chamado ao tocar num exercício. */
  onSelect: (exercise: Exercise) => void
  /** Rótulo opcional à direita de cada item (ex.: "Adicionar"). */
  actionLabel?: string
  /** Se informado, exibe botão para criar um exercício próprio já com o texto buscado. */
  onCreateRequest?: (prefill: { name: string; muscleGroup?: string }) => void
}

/**
 * Lista de exercícios com busca + filtros (grupo muscular e equipamento).
 * Reutilizada no Catálogo e no seletor "Adicionar exercício".
 */
export function ExerciseBrowser({ onSelect, actionLabel, onCreateRequest }: Props) {
  // useLiveQuery: re-executa a consulta sempre que a tabela muda e atualiza a tela sozinha.
  const exercises = useLiveQuery(() => exerciseRepo.list(), [])
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [equipment, setEquipment] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const groups = useMemo(() => [...new Set((exercises ?? []).map((e) => e.muscleGroup))].sort(), [exercises])
  const equipments = useMemo(
    () => [...new Set((exercises ?? []).flatMap((e) => e.equipment))].sort(),
    [exercises],
  )

  const filtered = useMemo(() => {
    const q = normalize(query)
    return (exercises ?? []).filter(
      (e) =>
        (!group || e.muscleGroup === group) &&
        (!equipment || e.equipment.includes(equipment)) &&
        (!q || normalize(e.name).includes(q)),
    )
  }, [exercises, query, group, equipment])

  // Qualquer mudança de filtro volta para a primeira "página".
  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setLimit(PAGE)
  }

  if (!exercises) return <p className="p-4 text-slate-400">Carregando…</p>

  const trimmedQuery = query.trim()

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        placeholder="Buscar exercício…"
        value={query}
        onChange={(e) => change(setQuery)(e.target.value)}
        className="w-full rounded-lg bg-slate-800 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-500"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {['', ...groups].map((g) => (
          <button
            key={g || 'todos'}
            onClick={() => change(setGroup)(g)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
              group === g ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {g || 'Todos'}
          </button>
        ))}
      </div>

      <select
        value={equipment}
        onChange={(e) => change(setEquipment)(e.target.value)}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm"
        aria-label="Filtrar por equipamento"
      >
        <option value="">Qualquer equipamento</option>
        {equipments.map((eq) => (
          <option key={eq} value={eq}>
            {eq}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{filtered.length} exercícios</p>
        {onCreateRequest && trimmedQuery.length > 0 && (
          <button
            type="button"
            onClick={() => onCreateRequest({ name: trimmedQuery, muscleGroup: group || undefined })}
            className="text-xs font-medium text-green-400 hover:underline"
          >
            + Criar "{trimmedQuery}"
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {filtered.slice(0, limit).map((ex) => (
          <li key={ex.id}>
            <button
              onClick={() => onSelect(ex)}
              className="flex w-full items-center gap-3 rounded-xl bg-slate-800 p-2 text-left active:bg-slate-700"
            >
              <ExerciseImage exercise={ex} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{ex.name}</div>
                <div className="truncate text-xs text-slate-400">
                  {ex.muscleGroup}
                  {ex.equipment.length > 0 && ` · ${ex.equipment.join(', ')}`}
                  {ex.source === 'custom' && ' · meu'}
                </div>
              </div>
              {actionLabel && <span className="shrink-0 pr-2 text-sm text-green-400">{actionLabel}</span>}
            </button>
          </li>
        ))}
      </ul>

      {filtered.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="rounded-lg bg-slate-800 py-3 text-sm text-slate-300"
        >
          Mostrar mais ({filtered.length - limit} restantes)
        </button>
      )}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-slate-500">Nenhum exercício encontrado na lista.</p>
          {onCreateRequest && (
            <button
              type="button"
              onClick={() => onCreateRequest({ name: trimmedQuery, muscleGroup: group || undefined })}
              className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white active:bg-green-700"
            >
              {trimmedQuery ? `+ Criar "${trimmedQuery}" e usar` : '+ Criar exercício próprio'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
