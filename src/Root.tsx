import { useEffect, useState } from 'react'
import App from './App'
import { bootstrap } from './db/bootstrap'

/** Mostra "Preparando…" enquanto o catálogo é importado pela 1ª vez, depois o app. */
export function Root() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    bootstrap()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)))
  }, [])

  if (error) return <p className="p-6 text-red-300">Erro ao preparar o banco de dados: {error}</p>
  if (!ready) return <p className="p-6 text-slate-300">Preparando o catálogo de exercícios…</p>
  return <App />
}

