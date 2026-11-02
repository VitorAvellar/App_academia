import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Treinar', icon: '🏋️' },
  { to: '/fichas', label: 'Fichas', icon: '📋' },
  { to: '/catalogo', label: 'Catálogo', icon: '📚' },
  { to: '/historico', label: 'Histórico', icon: '📈' },
]

/** Menu inferior fixo — fica ao alcance do polegar no celular. */
export function BottomNav() {
  return (
    <nav className="border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-xs ${
                  isActive ? 'text-green-400' : 'text-slate-400'
                }`
              }
            >
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

