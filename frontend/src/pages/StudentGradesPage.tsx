import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, authFetch } from '../auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { BarChart3, Check, X, Circle, Clock, ArrowRight } from 'lucide-react'

interface GradeItem {
  id: number
  test_id: number
  test_name: string
  course_name: string
  score: number
  total_questions: number
  correct_count: number
  incorrect_count: number
  blank_count: number
  annotated_image_path: string | null
  created_at: string
}

export default function StudentGradesPage() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [grades, setGrades] = useState<GradeItem[]>([])

  useEffect(() => {
    authFetch('/students/me/grades', token)
      .then((r) => r.json())
      .then(setGrades)
      .catch(console.error)
  }, [token])

  if (grades.length === 0) {
    return (
      <div className="flex flex-col items-center text-center pt-12">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
          <BarChart3 className="w-7 h-7 text-brand-600" />
        </div>
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">{t('myGrades.title')}</h1>
        <p className="text-[#6B7280] text-sm">{t('myGrades.noGrades')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-[32px] font-bold tracking-tight text-[#0F172A]">{t('myGrades.title')}</h1>
        <p className="text-[#6B7280] text-sm mt-0.5">{t('myGrades.gradedExams', { count: grades.length })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {grades.map((g) => {
          const pct = g.total_questions > 0 ? Math.round((g.score / g.total_questions) * 100) : 0
          return (
            <Link
              key={g.id}
              to={`/history/${g.id}`}
              className="card p-4 md:p-5 hover:shadow-elevated transition-all active:scale-[0.98] group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-[15px] md:text-base text-[#0F172A] group-hover:text-brand-600 transition-colors leading-snug">
                    {g.test_name || `Test #${g.test_id}`}
                  </h3>
                  {g.course_name && (
                    <p className="text-xs text-[#9CA3AF] mt-0.5">{g.course_name}</p>
                  )}
                </div>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-md ml-2 ${
                  pct >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  pct >= 40 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                  'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {pct}%
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-[#6B7280] mb-3">
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-500" /> {g.correct_count}
                </span>
                <span className="flex items-center gap-1">
                  <X className="w-3 h-3 text-red-500" /> {g.incorrect_count}
                </span>
                <span className="flex items-center gap-1">
                  <Circle className="w-3 h-3 text-[#9CA3AF]" /> {g.blank_count}
                </span>
              </div>

              <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 mb-3">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                <span className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                  <Clock className="w-3 h-3" />
                  {new Date(g.created_at).toLocaleDateString()}
                </span>
                <span className="items-center gap-1 text-xs font-medium text-brand-600 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity">
                  {t('common.view')} <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
