import { QuestionDef } from '../api/client'
import { useTranslation } from 'react-i18next'
import { Trash2, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

interface Props {
  questions: QuestionDef[]
  onChange: (questions: QuestionDef[]) => void
  onDelete: (qno: number) => void
  onDuplicate: (qno: number) => void
}

export default function QuestionCards({ questions, onChange, onDelete, onDuplicate }: Props) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  const toggle = (qno: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(qno)) next.delete(qno)
      else next.add(qno)
      return next
    })
  }

  const updateQuestion = (qno: number, patch: Partial<QuestionDef>) => {
    onChange(questions.map((q) => (q.question_number === qno ? { ...q, ...patch } : q)))
  }

  const setOptionCount = (qno: number, count: number) => {
    const q = questions.find((x) => x.question_number === qno)
    if (!q) return
    const newOptions = OPTION_LABELS.slice(0, count)
    const correctInNew = newOptions.includes(q.correct_answer) ? q.correct_answer : newOptions[0]
    updateQuestion(qno, { options: newOptions, correct_answer: correctInNew })
  }

  return (
    <div className="space-y-3">
      {questions.map((q) => {
        const isCollapsed = collapsed.has(q.question_number)
        return (
          <div
            key={q.question_number}
            className="border border-[#E5E7EB] rounded-xl bg-white overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-[#9CA3AF]">Q{q.question_number}</span>
                <span className="text-xs font-medium bg-brand-50 text-brand-700 px-2 py-0.5 rounded-md border border-brand-100">
                  Answer: {q.correct_answer}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDuplicate(q.question_number)}
                  className="p-2 rounded-lg text-[#9CA3AF] hover:text-brand-600 hover:bg-brand-50 active:bg-brand-100 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDelete(q.question_number)}
                    className="p-2 rounded-lg text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggle(q.question_number)}
                  className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#0F172A] hover:bg-[#F3F4F6] transition-colors"
                >
                  {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="px-4 pb-4 border-t border-[#F3F4F6] pt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6B7280]">{t('builder.options')}:</span>
                  <select
                    value={q.options.length}
                    onChange={(e) => setOptionCount(q.question_number, Number(e.target.value))}
                    className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} {t('builder.options')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                   <span className="text-xs text-[#6B7280] block mb-2">{t('builder.answerKey')}:</span>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((l) => {
                      const selected = q.correct_answer === l
                      return (
                        <button
                          key={l}
                          type="button"
                          onClick={() => updateQuestion(q.question_number, { correct_answer: l })}
                          className={`w-12 h-12 rounded-xl text-base font-bold transition-all active:scale-95 ${
                            selected
                              ? 'bg-brand-600 text-white shadow-md'
                              : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] active:bg-[#D1D5DB]'
                          }`}
                        >
                          {l}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
