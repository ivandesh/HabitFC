import { useEffect, useState, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useUnwatchedCount } from './hooks/useUnwatchedCount'
import { ErrorBoundary } from './components/ErrorBoundary'

const UnwatchedCountContext = createContext(0)
import { AchievementToastManager } from './components/ui/AchievementToast'
import { Dashboard } from './pages/Dashboard'
import { Shop } from './pages/Shop'
import { PackOpening } from './pages/PackOpening'
import { Collection } from './pages/Collection'
import { Team } from './pages/Team'
import { Achievements } from './pages/Achievements'
import { LoginPage } from './pages/LoginPage'
import { AuthGuard } from './components/AuthGuard'
import { useAuthStore } from './store/useAuthStore'
import { Friends } from './pages/Friends'
import { FriendProfile } from './pages/FriendProfile'
import { ProfileModal } from './components/ui/ProfileModal'

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-label="Головна">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
)
const ShopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-label="Магазин">
    <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3z" />
  </svg>
)
const CollectionIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-label="Колекція">
    <path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z" />
  </svg>
)
const TeamIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-label="Склад">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
)
const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-label="Досягнення">
    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0011 15.9V18H9v2h6v-2h-2v-2.1a5.01 5.01 0 003.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
  </svg>
)

const FriendsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-label="Друзі">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
)

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-label="Профіль">
    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
  </svg>
)

function NavBar() {
  const { signOut } = useAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const unwatchedCount = useContext(UnwatchedCountContext)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-4 font-oswald font-semibold text-sm tracking-widest uppercase transition-all border-b-2 shrink-0 ${
      isActive
        ? 'text-[#00E676] border-[#00E676]'
        : 'text-[#5A7090] border-transparent hover:text-[#E8F0FF] hover:border-[#1A2336]'
    }`

  return (
    <>
      <nav className="sticky top-0 z-40 bg-[#04060A]/95 backdrop-blur-md border-b border-[#1A2336]">
        {/* Mobile: minimal top bar — logo + data buttons + reset */}
        <div className="sm:hidden px-4 flex items-center justify-between h-12">
          <span className="font-oswald text-lg font-bold tracking-wider">
            <span className="text-[#00E676]">⚽</span>{' '}
            <span className="text-white">HABIT<span className="text-[#00E676]">FC</span></span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => signOut()}
              className="p-2 text-[#5A7090] hover:text-red-400 transition-colors cursor-pointer"
              title="Вийти з акаунту"
            >
              🚪
            </button>
          </div>
        </div>

        {/* Desktop: full nav bar */}
        <div className="hidden sm:flex max-w-7xl mx-auto px-4 items-center gap-1">
          <span className="font-oswald text-xl font-bold mr-3 py-3 shrink-0 tracking-wider">
            <span className="text-[#00E676]">⚽</span>{' '}
            <span className="text-white">
              HABIT<span className="text-[#00E676]">FC</span>
            </span>
          </span>
          <NavLink to="/" end className={linkClass}>Головна</NavLink>
          <NavLink to="/shop" className={linkClass}>Магазин</NavLink>
          <NavLink to="/collection" className={linkClass}>Колекція</NavLink>
          <NavLink to="/team" className={linkClass}>Склад</NavLink>
          <NavLink to="/achievements" className={linkClass}>Досягнення</NavLink>
          <NavLink to="/friends" className={linkClass}>
            <span className="relative">
              Друзі
              {unwatchedCount > 0 && (
                <span className="absolute -top-1 -right-3 w-2 h-2 bg-yellow-400 rounded-full" />
              )}
            </span>
          </NavLink>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button
              onClick={() => setProfileOpen(true)}
              className="p-2 text-[#5A7090] hover:text-[#00E676] transition-colors cursor-pointer"
              title="Профіль"
            >
              <ProfileIcon />
            </button>
            <button
              onClick={() => signOut()}
              className="p-2 text-[#5A7090] hover:text-red-400 transition-colors cursor-pointer"
              title="Вийти з акаунту"
            >
              🚪
            </button>
          </div>
        </div>
      </nav>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function BottomNav() {
  const { pathname } = useLocation()
  const unwatchedCount = useContext(UnwatchedCountContext)
  if (pathname === '/open' || pathname.startsWith('/profile/')) return null

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors ${
      isActive ? 'text-[#00E676]' : 'text-[#5A7090]'
    }`

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-[#04060A]/95 backdrop-blur-md border-t border-[#1A2336]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch h-14">
        <NavLink to="/" end className={tabClass}>
          <HomeIcon />
          <span className="font-oswald text-[9px] tracking-widest uppercase leading-none">Головна</span>
        </NavLink>
        <NavLink to="/shop" className={tabClass}>
          <ShopIcon />
          <span className="font-oswald text-[9px] tracking-widest uppercase leading-none">Магазин</span>
        </NavLink>
        <NavLink to="/collection" className={tabClass}>
          <CollectionIcon />
          <span className="font-oswald text-[9px] tracking-widest uppercase leading-none">Колекція</span>
        </NavLink>
        <NavLink to="/team" className={tabClass}>
          <TeamIcon />
          <span className="font-oswald text-[9px] tracking-widest uppercase leading-none">Склад</span>
        </NavLink>
        <NavLink to="/achievements" className={tabClass}>
          <TrophyIcon />
          <span className="font-oswald text-[9px] tracking-widest uppercase leading-none">Здобутки</span>
        </NavLink>
        <NavLink to="/friends" className={tabClass}>
          <div className="relative">
            <FriendsIcon />
            {unwatchedCount > 0 && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full" />
            )}
          </div>
          <span className="font-oswald text-[9px] tracking-widest uppercase leading-none">Друзі</span>
        </NavLink>
      </div>
    </nav>
  )
}

function AuthenticatedApp() {
  const unwatchedCount = useUnwatchedCount()
  return (
    <UnwatchedCountContext.Provider value={unwatchedCount}>
      <div className="min-h-screen bg-[#04060A] stadium-lines">
        <ScrollToTop />
        <AchievementToastManager />
        <NavBar />
        <div className="pb-14 sm:pb-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/open" element={<PackOpening />} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/team" element={<Team />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/profile/:userId" element={<FriendProfile />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </UnwatchedCountContext.Provider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename="/HabitFC">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <AuthGuard>
              <AuthenticatedApp />
            </AuthGuard>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
