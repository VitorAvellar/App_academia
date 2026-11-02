import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { RestTimer } from './components/RestTimer'
import { Catalog } from './pages/Catalog'
import { Credits } from './pages/Credits'
import { ExerciseDetail } from './pages/ExerciseDetail'
import { History, HistoryDetail } from './pages/History'
import { TemplateEditor } from './pages/TemplateEditor'
import { Templates } from './pages/Templates'
import { Workout } from './pages/Workout'

/**
 * Estrutura da tela: conteúdo rolável + (cronômetro de descanso) + menu inferior fixo.
 * <Outlet /> é onde o React Router encaixa a página da rota atual.
 */
function Layout() {
  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <RestTimer />
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Workout />} />
          <Route path="fichas" element={<Templates />} />
          <Route path="fichas/:id" element={<TemplateEditor />} />
          <Route path="catalogo" element={<Catalog />} />
          <Route path="catalogo/:id" element={<ExerciseDetail />} />
          <Route path="historico" element={<History />} />
          <Route path="historico/:id" element={<HistoryDetail />} />
          <Route path="creditos" element={<Credits />} />
          <Route path="*" element={<Workout />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
