import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0F1A] flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-5xl">💥</div>
          <h1 className="font-oswald text-2xl font-bold text-white uppercase tracking-wider">Щось пішло не так</h1>
          <p className="text-[#5A7090] text-sm max-w-md">Сталася неочікувана помилка. Спробуй перезавантажити сторінку.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#00E676] text-[#04060A] font-oswald font-bold uppercase tracking-wider rounded-xl hover:bg-[#00FF87] transition-colors cursor-pointer"
          >
            Перезавантажити
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
