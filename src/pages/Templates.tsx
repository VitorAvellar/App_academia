import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { sessionRepo } from '../db/repositories/sessionRepo'
import { templateRepo } from '../db/repositories/templateRepo'

export function Templates() {
  const navigate = useNavigate()
  const templates = useLiveQuery(() => templateRepo.list(), [])

  async function createNew() {
    const t = await templateRepo.create({ name: 'Nova ficha' })
    navigate(`/fichas/${t.id}`)
  }

  async function startFrom(id: string) {
    const active = await sessionRepo.getActive()
    if (active && !confirm('Já existe um treino em andamento. Iniciar outro mesmo assim?')) return
    const template = await db.templates.get(id)
    if (template) await sessionRepo.start(template)
    navigate('/')
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Minhas fichas</h1>
        <button onClick={createNew} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium">
          + Nova ficha
        </button>
      </div>

      {!templates && <p className="text-slate-400">Carregando…</p>}
      {templates?.length === 0 && <p className="py-8 text-center text-slate-500">Nenhuma ficha ainda.</p>}

      <ul className="flex flex-col gap-3">
        {templates?.map((t) => (
          <li key={t.id} className="rounded-xl bg-slate-800 p-4">
            <button className="block w-full text-left" onClick={() => navigate(`/fichas/${t.id}`)}>
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-slate-400">
                {t.items.length} exercícios · {t.items.reduce((n, i) => n + i.targetSets, 0)} séries
              </div>
              {t.description && <div className="mt-1 text-xs text-slate-500">{t.description}</div>}
            </button>
            <div className="mt-3 flex gap-2">
              <button onClick={() => startFrom(t.id)} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium">
                Iniciar treino
              </button>
              <button onClick={() => navigate(`/fichas/${t.id}`)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">
                Editar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

