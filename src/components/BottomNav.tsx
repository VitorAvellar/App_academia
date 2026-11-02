import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

// Ícones SVG vetoriais (substituem os emojis para visual consistente em qualquer celular/OS).
const DumbbellIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 6.5 17.5 17.5" />
    <path d="M3 10l7-7" />
    <path d="M14 21l7-7" />
    <path d="M2 6l4-4" />
    <path d="M18 22l4-4" />
  </svg>
)

const ClipboardIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </svg>
)

const BookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="m7 15 4-4 3 3 5-6" />
  </svg>
)

const items: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Treinar', icon: <DumbbellIcon /> },
  { to: '/fichas', label: 'Fichas', icon: <ClipboardIcon /> },
  { to: '/catalogo', label: 'Catálogo', icon: <BookIcon /> },
  { to: '/historico', label: 'Histórico', icon: <ChartIcon /> },
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
                `flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                  isActive ? 'text-green-400' : 'text-slate-400'
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
