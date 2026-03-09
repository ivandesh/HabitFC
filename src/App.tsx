import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AchievementToastManager } from './components/ui/AchievementToast'
import { Dashboard } from './pages/Dashboard'
import { Shop } from './pages/Shop'
import { PackOpening } from './pages/PackOpening'
import { Collection } from './pages/Collection'
import { Team } from './pages/Team'
import { useAppStore } from './store/useAppStore'

function NavBar() {
  const resetAll = useAppStore(state => state.resetAll)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-4 font-oswald font-semibold text-sm tracking-widest uppercase transition-all border-b-2 shrink-0 ${
      isActive
        ? 'text-[#00E676] border-[#00E676]'
        : 'text-[#5A7090] border-transparent hover:text-[#E8F0FF] hover:border-[#1A2336]'
    }`

  function handleReset() {
    if (window.confirm('Скинути весь прогрес? Це видалить усі звички, монети та картки.')) {
      resetAll()
    }
  }

  return (
    <nav className="sticky top-0 z-40 bg-[#04060A]/95 backdrop-blur-md border-b border-[#1A2336]">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1">
        <span className="font-oswald text-xl font-bold mr-3 py-3 shrink-0 tracking-wider">
          <span className="text-[#00E676]">⚽</span>{' '}
          <span className="hidden sm:inline text-white">
            HABIT<span className="text-[#00E676]">FC</span>
          </span>
        </span>
        <NavLink to="/" end className={linkClass}>Головна</NavLink>
        <NavLink to="/shop" className={linkClass}>Магазин</NavLink>
        <NavLink to="/collection" className={linkClass}>Колекція</NavLink>
        <NavLink to="/team" className={linkClass}>Склад</NavLink>
        <div className="ml-auto shrink-0">
          <button
            onClick={handleReset}
            className="p-2 text-[#5A7090] hover:text-red-400 transition-colors cursor-pointer"
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
      <div className="min-h-screen bg-[#04060A] stadium-lines">
        <AchievementToastManager />
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/open" element={<PackOpening />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/team" element={<Team />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
