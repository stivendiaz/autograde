import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, ArrowRight, FileText, ScanLine, History, User } from 'lucide-react'

interface Props {
  id: number
  name: string
  number_of_questions: number
  number_of_options?: number
  has_sheet?: boolean
  course_name?: string
  student_name?: string
  created_at: string
  showActions?: boolean
}

export default function ExamCard({
  id, name, number_of_questions, number_of_options, has_sheet,
  course_name, student_name, created_at, showActions,
}: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div
      onClick={() => navigate(`/tests/${id}`)}
      className="card p-4 md:p-5 hover:shadow-elevated transition-all active:scale-[0.98] group cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2 md:mb-3">
        <div className="min-w-0">
          <span className="font-semibold text-[15px] md:text-base text-[#0F172A] group-hover:text-brand-600 transition-colors leading-snug">
            {name}
          </span>
          {course_name && (
            <p className="text-xs text-[#9CA3AF] mt-0.5">{course_name}</p>
          )}
        </div>
        {has_sheet && (
          <span className="shrink-0 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[11px] font-medium border border-emerald-100 ml-2">
            {t('dashboard.ready')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-[#6B7280] mb-3 md:mb-4">
        <span>{number_of_questions} {t('dashboard.questionsShort')}</span>
        {number_of_options !== undefined && number_of_options > 0 && (
          <span>{t('dashboard.maxOpts', { count: number_of_options })}</span>
        )}
      </div>

      {showActions && (
        <div className="flex items-center gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
          <span
            onClick={(e) => { e.stopPropagation(); navigate(`/tests/${id}`) }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3 h-3" /> {t('common.view')}
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); navigate(`/tests/${id}/grade`) }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
          >
            <ScanLine className="w-3 h-3" /> {t('nav.grade')}
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); navigate(`/tests/${id}`) }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
          >
            <History className="w-3 h-3" /> {t('nav.history')}
          </span>
        </div>
      )}

      {student_name && (
        <p className="text-xs text-[#9CA3AF] mb-2">
          <User className="w-3 h-3 inline mr-1" />
          {student_name}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
        <span className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
          <Clock className="w-3 h-3" />
          {new Date(created_at).toLocaleDateString()}
        </span>
        {!showActions && (
          <span className="items-center gap-1 text-xs font-medium text-brand-600 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity">
            {t('common.view')} <ArrowRight className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  )
}
