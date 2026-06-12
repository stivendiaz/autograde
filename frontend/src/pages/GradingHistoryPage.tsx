import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, authFetch } from '../auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { Clock, ChevronRight, Check, X, Circle } from 'lucide-react'

interface HistoryEntry {
  id: number
  test_id: number
  test_name: string
  sheet_id: number | null
  student_name: string
  score: number
  total_questions: number
  correct_count: number
  incorrect_count: number
  blank_count: number
  ambiguous_count: number
  annotated_image_path: string | null
  created_at: string
}

export default function GradingHistoryPage() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [records, setRecords] = useState<HistoryEntry[]>([])

  useEffect(() => {
    authFetch('/grading-history', token)
      .then((r) => r.json())
      .then(setRecords)
      .catch(console.error)
  }, [token])

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center text-center pt-12 md:pt-16">
        <h1 className="text-2xl md:text-[32px] font-bold tracking-tight text-[#0F172A] mb-2">{t('history.title')}</h1>
        <p className="text-[#6B7280] text-[15px]">{t('history.noRecords')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-[32px] font-bold tracking-tight text-[#0F172A]">{t('history.title')}</h1>
        <p className="text-[#6B7280] text-sm mt-0.5">{t('history.records', { count: records.length })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {records.map((r) => {
          const pct = r.total_questions > 0 ? Math.round((r.score / r.total_questions) * 100) : 0
          return (
            <Link
              key={r.id}
              to={`/history/${r.id}`}
              className="card p-4 md:p-5 hover:shadow-elevated transition-all active:scale-[0.98] group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-[15px] text-[#0F172A] group-hover:text-brand-600 transition-colors pr-2 leading-snug">
                  {r.test_name || `Test #${r.test_id}`}
                </h3>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-md ${pct >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : pct >= 40 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  {pct}%
                </span>
              </div>

              <p className="text-xs text-[#9CA3AF] mb-3">
                {t('history.studentLabel')}: <span className="font-medium text-[#6B7280]">{r.student_name || t('testDetail.anonymous')}</span>
              </p>

              <div className="flex items-center gap-3 text-xs text-[#6B7280] mb-3">
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-500" /> {r.correct_count}
                </span>
                <span className="flex items-center gap-1">
                  <X className="w-3 h-3 text-red-500" /> {r.incorrect_count}
                </span>
                <span className="flex items-center gap-1">
                  <Circle className="w-3 h-3 text-[#9CA3AF]" /> {r.blank_count}
                </span>
              </div>

              <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 mb-3">
                <div
                  className={`h-1.5 rounded-full transition-all ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                <span className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                  <Clock className="w-3 h-3" />
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
                {r.annotated_image_path && (
                  <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-medium">{t('history.proof')}</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
