import { QuestionDef } from '../api/client'
import { useTranslation } from 'react-i18next'
import { Trash2, Copy } from 'lucide-react'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

interface Props {
  questions: QuestionDef[]
  onChange: (questions: QuestionDef[]) => void
  onDelete: (qno: number) => void
  onDuplicate: (qno: number) => void
}

export default function AnswerKeyGrid({ questions, onChange, onDelete, onDuplicate }: Props) {
  const { t } = useTranslation()
  const maxOpts = Math.max(...questions.map((q) => q.options.length), 0)
  const allLabels = OPTION_LABELS.slice(0, maxOpts)

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
    <div className="overflow-auto max-h-[520px] rounded-xl border border-[#E5E7EB]">
      <table className="w-full text-sm">
        <thead className="bg-[#F9FAFB] sticky top-0 z-10">
          <tr className="border-b border-[#E5E7EB]">
            <th className="px-3 py-3 text-left text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-10">
              #
            </th>
            <th className="px-3 py-3 text-center text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-20">
              {t('builder.options')}
            </th>
            {allLabels.map((l) => (
              <th
                key={l}
                className="px-1 py-3 text-center text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-10"
              >
                {l}
              </th>
            ))}
            <th className="px-2 py-3 w-20" />
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => {
            const label = q.question_number
            return (
              <tr key={q.question_number} className="border-b border-[#F3F4F6] hover:bg-brand-50/20 transition-colors">
                <td className="px-3 py-3 text-xs font-medium text-[#9CA3AF]">{label}</td>
                <td className="px-3 py-3 text-center">
                  <select
                    value={q.options.length}
                    onChange={(e) => setOptionCount(q.question_number, Number(e.target.value))}
                    className="text-xs border border-[#E5E7EB] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
                {allLabels.map((l) => {
                  const enabled = q.options.includes(l)
                  const selected = q.correct_answer === l
                  return (
                    <td key={l} className="px-1 py-3 text-center">
                      {enabled ? (
                        <button
                          type="button"
                          onClick={() => updateQuestion(q.question_number, { correct_answer: l })}
                          className={`w-7 h-7 rounded-full text-[11px] font-bold transition-all ${
                            selected
                              ? 'bg-brand-600 text-white shadow-sm scale-110'
                              : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] hover:text-[#374151]'
                          }`}
                        >
                          {l}
                        </button>
                      ) : (
                        <span className="text-[#E5E7EB] text-[11px]">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-3">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onDuplicate(q.question_number)}
                      className="p-1 rounded-md text-[#9CA3AF] hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      title={t('common.duplicate')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(q.question_number)}
                      className="p-1 rounded-md text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
