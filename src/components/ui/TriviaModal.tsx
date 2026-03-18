import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { triviaQuestions } from '../../data/triviaQuestions'
import type { TriviaQuestion } from '../../data/triviaQuestions'

interface Props {
  onClose: () => void
}

function pickQuestion(history: number[]): TriviaQuestion {
  const available = triviaQuestions.filter(q => !history.includes(q.id))
  const pool = available.length > 0 ? available : triviaQuestions
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function TriviaModal({ onClose }: Props) {
  const triviaHistory = useAppStore(s => s.triviaHistory)
  const answerTrivia = useAppStore(s => s.answerTrivia)

  const [question] = useState<TriviaQuestion>(() => pickQuestion(triviaHistory))
  const [selected, setSelected] = useState<number | null>(null)

  const isAnswered = selected !== null
  const isCorrect = selected === question.correctIndex

  useEffect(() => {
    if (!isAnswered) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isAnswered, onClose])

  function handleSelect(index: number) {
    if (isAnswered) return
    setSelected(index)
    answerTrivia(question.id, index === question.correctIndex)
  }

  function optionClasses(i: number): string {
    const base = 'w-full p-3 rounded-xl border text-left text-sm transition-all'
    if (!isAnswered) {
      return `${base} border-[#1A2336] bg-[#0A0F1A] text-[#E8F0FF] hover:border-[#00E676]/50 cursor-pointer`
    }
    if (i === question.correctIndex) {
      return `${base} border-[#00E676] bg-[#00E676]/10 text-[#00E676]`
    }
    if (i === selected) {
      return `${base} border-red-500 bg-red-500/10 text-red-400`
    }
    return `${base} border-[#1A2336] bg-[#0A0F1A] text-[#5A7090] opacity-50`
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={isAnswered ? onClose : undefined}
    >
      <div
        className="bg-[#04060A] border border-[#1A2336] rounded-2xl p-6 w-full max-w-sm space-y-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <h2 className="font-oswald text-lg tracking-wide text-white uppercase">
          ⚽ Вікторина дня
        </h2>

        {/* Question */}
        <p className="text-[#E8F0FF] text-sm leading-relaxed">{question.question}</p>

        {/* Options */}
        <div className="flex flex-col gap-2.5">
          {question.options.map((option, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={optionClasses(i)}
              onClick={() => handleSelect(i)}
              disabled={isAnswered}
            >
              {option}
            </motion.button>
          ))}
        </div>

        {/* Result */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {isCorrect ? (
                <p className="text-[#00E676] font-oswald font-bold text-center">
                  +50 монет! 🎉
                </p>
              ) : (
                <p className="text-red-400 font-oswald font-bold text-center">
                  Краще пощастить завтра! 😅
                </p>
              )}
              {question.funFact && (
                <p className="text-[#5A7090] text-xs italic text-center mt-2">
                  {question.funFact}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Close button */}
        {isAnswered && (
          <button
            className="w-full py-3 rounded-xl bg-[#00E676] text-black font-oswald font-bold uppercase tracking-wider text-sm cursor-pointer hover:brightness-110 transition-all"
            onClick={onClose}
          >
            Закрити
          </button>
        )}
      </div>
    </div>
  )
}
