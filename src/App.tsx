import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Shop } from './pages/Shop'
import { PackOpening } from './pages/PackOpening'
import { Collection } from './pages/Collection'
import { useAppStore } from './store/useAppStore'

function NavBar() {
  const resetAll = useAppStore(state => state.resetAll)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-xl font-semibold transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`

  function handleReset() {
    if (window.confirm('Скинути весь прогрес? Це видалить усі звички, монети та картки.')) {
      resetAll()
    }
  }

  return (
    <nav className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-1 sm:gap-2">
        <span className="text-xl font-bold text-white mr-2 shrink-0">⚽ <span className="hidden sm:inline">HabitFC</span></span>
        <NavLink to="/" end className={linkClass}>Головна</NavLink>
        <NavLink to="/shop" className={linkClass}>Магазин</NavLink>
        <NavLink to="/collection" className={linkClass}>Колекція</NavLink>
        <div className="ml-auto shrink-0">
          <button
            onClick={handleReset}
            className="p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
            title="Скинути прогрес"
          >
            🔄
          </button>
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/HabitFC">
      <div className="min-h-screen bg-gray-950">
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/open" element={<PackOpening />} />
          <Route path="/collection" element={<Collection />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
