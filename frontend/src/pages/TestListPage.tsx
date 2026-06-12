import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, TestListEntry } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { Plus, FileCheck } from 'lucide-react'
import ExamCard from '../components/ExamCard'

export default function TestListPage() {
  const { isTeacher } = useAuth()
  const { t } = useTranslation()
  const [tests, setTests] = useState<TestListEntry[]>([])

  useEffect(() => {
    api.listTests().then(setTests).catch(console.error)
  }, [])

  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center text-center pt-12 md:pt-16">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-5">
          <FileCheck className="w-8 h-8 text-brand-600" />
        </div>
        <h1 className="text-2xl md:text-[32px] font-bold tracking-tight text-[#0F172A] mb-2">{t('dashboard.noTests')}</h1>
        <p className="text-[#6B7280] text-[15px] mb-8 max-w-xs">
          {isTeacher
            ? t('dashboard.noTestsDesc')
            : 'No tests are available for you yet.'}
        </p>
        {isTeacher && (
          <Link to="/builder" className="btn-primary w-full max-w-xs">
            <Plus className="w-5 h-5" />
            {t('dashboard.createFirst')}
          </Link>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-[32px] font-bold tracking-tight text-[#0F172A]">{t('dashboard.tests')}</h1>
          <p className="text-[#6B7280] text-sm mt-0.5">{tests.length} test{tests.length !== 1 ? 's' : ''}</p>
        </div>
        {isTeacher && (
          <Link to="/builder" className="btn-primary hidden md:inline-flex">
            <Plus className="w-4 h-4" />
            {t('dashboard.newTest')}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {tests.map((t) => (
          <ExamCard
            key={t.id}
            id={t.id}
            name={t.name}
            number_of_questions={t.number_of_questions}
            number_of_options={t.number_of_options}
            has_sheet={t.has_sheet}
            created_at={t.created_at}
          />
        ))}

        {isTeacher && (
          <Link
            to="/builder"
            className="card p-4 md:p-5 flex flex-col items-center justify-center text-center min-h-[140px] md:min-h-[180px] border-dashed border-2 border-[#E5E7EB] hover:border-brand-300 hover:bg-brand-50/30 transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] flex items-center justify-center mb-2 md:mb-3">
              <Plus className="w-5 h-5 text-[#6B7280]" />
            </div>
            <span className="text-sm font-medium text-[#6B7280]">{t('dashboard.newTest')}</span>
          </Link>
        )}
      </div>

      {isTeacher && (
        <Link
          to="/builder"
          className="md:hidden fixed bottom-20 right-4 w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform z-20"
        >
          <Plus className="w-6 h-6" />
        </Link>
      )}
    </div>
  )
}
