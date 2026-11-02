import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'

/**
 * Atribuição exigida pelas licenças CC-BY-SA dos conteúdos da wger.
 * Mostra os autores dos exercícios (textos e imagens) e a licença de cada um.
 */
export function Credits() {
  const navigate = useNavigate()
  const authors = useLiveQuery(async () => {
    const list = await db.exercises.where('source').equals('wger').toArray()
    const map = new Map<string, number>()
    for (const e of list) {
      const key = e.licenseAuthor?.trim() || 'Comunidade wger'
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    const licenses = [...new Set(list.map((e) => e.license).filter(Boolean))]
    return { rows: [...map].sort((a, b) => b[1] - a[1]), licenses }
  }, [])

  return (
    <div className="p-4 pb-8">
      <button onClick={() => navigate(-1)} className="mb-3 text-sm text-slate-400">
        ← Voltar
      </button>
      <h1 className="text-2xl font-bold">Créditos</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        O catálogo de exercícios (nomes, descrições e imagens) vem do projeto aberto{' '}
        <a className="underline" href="https://wger.de" target="_blank" rel="noreferrer">
          wger Workout Manager
        </a>
        , licenciado sob {authors?.licenses.join(', ') || 'CC-BY-SA'} (
        <a
          className="underline"
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br"
          target="_blank"
          rel="noreferrer"
        >
          Creative Commons Atribuição-CompartilhaIgual
        </a>
        ). Obrigado aos autores abaixo!
      </p>

      <ul className="mt-4 divide-y divide-slate-800 rounded-xl bg-slate-800/60 text-sm">
        {authors?.rows.map(([name, count]) => (
          <li key={name} className="flex justify-between px-4 py-2">
            <span className="truncate">{name}</span>
            <span className="text-slate-400">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

