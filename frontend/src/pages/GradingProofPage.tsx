import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, X, Circle, AlertTriangle } from 'lucide-react'

interface ProofData {
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
  processed_image_path: string | null
  original_image_path: string | null
  detected_answers: Record<string, string>
  per_question: Array<{
    question: number
    detected: string
    expected: string
    correct: boolean
    blank: boolean
  }>
  created_at: string
}

export default function GradingProofPage() {
  const { historyId } = useParams<{ historyId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [data, setData] = useState<ProofData | null>(null)
  const [tab, setTab] = useState<'proof' | 'breakdown'>('proof')

  useEffect(() => {
    if (!historyId) return
    fetch(`/api/grading-history/${historyId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
  }, [historyId])

  if (!data) {
    return (
      <div className="py-20 text-center text-[#6B7280]">
        <div className="animate-pulse">{t('common.loading')}</div>
      </div>
    )
  }

  const pct = data.total_questions > 0 ? Math.round((data.score / data.total_questions) * 100) : 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <button onClick={() => navigate(-1)} className="text-[#6B7280] hover:text-[#0F172A] transition-colors p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-[32px] font-bold tracking-tight text-[#0F172A]">
            {data.test_name || `Test #${data.test_id}`}
          </h1>
          <p className="text-[#6B7280] text-sm mt-0.5">
            {data.student_name ? data.student_name : t('testDetail.anonymousStudent')} &middot; {t('testDetail.graded')} {new Date(data.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl md:text-[28px] font-bold text-[#0F172A]">{pct}%</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">
            {data.score}/{data.total_questions}
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl md:text-[28px] font-bold text-emerald-600">{data.correct_count}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">{t('testDetail.correct')}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl md:text-[28px] font-bold text-red-600">{data.incorrect_count}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">{t('testDetail.incorrect')}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl md:text-[28px] font-bold text-[#6B7280]">{data.blank_count}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">{t('testDetail.blank')}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl md:text-[28px] font-bold text-amber-600">{data.ambiguous_count}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">{t('testDetail.ambiguous')}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl w-fit mb-6">
        <button
          onClick={() => setTab('proof')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'proof' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#6B7280] hover:text-[#0F172A]'
          }`}
        >
          {t('testDetail.proofImage')}
        </button>
        <button
          onClick={() => setTab('breakdown')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'breakdown' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#6B7280] hover:text-[#0F172A]'
          }`}
        >
          {t('grading.questionBreakdown')}
        </button>
      </div>

      {tab === 'proof' && (
        <div className="space-y-4">
          {data.annotated_image_path && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-[#F3F4F6]">
                <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">{t('testDetail.annotatedProof')}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">{t('testDetail.proofLegend')}</p>
              </div>
              <img
                src={`/api/grading-history/${data.id}/proof`}
                alt="Annotated grading proof"
                className="w-full max-h-[600px] object-contain bg-[#F9FAFB]"
              />
            </div>
          )}

          {data.processed_image_path && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-[#F3F4F6]">
                <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">{t('testDetail.perspectiveCorrected')}</p>
              </div>
              <img
                src={`/api/grading-history/${data.id}/processed`}
                alt="Perspective corrected image"
                className="w-full max-h-[600px] object-contain bg-[#F9FAFB]"
              />
            </div>
          )}

          {!data.annotated_image_path && (
            <div className="card p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <p className="text-[#6B7280] text-sm">Proof image not available for this grading.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'breakdown' && (
        <div className="space-y-4">
          <div className="md:hidden space-y-2">
            {data.per_question.map((pq) => (
              <div
                key={pq.question}
                className={`card p-3 flex items-center justify-between ${
                  pq.correct ? 'border-emerald-200 bg-emerald-50/30' : pq.blank ? '' : 'border-red-200 bg-red-50/30'
                }`}
              >
                <div>
                  <span className="text-sm font-semibold text-[#0F172A]">Q{pq.question}</span>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {t('common.detected')}: <span className="font-medium">{pq.detected || '—'}</span> &middot;
                    {t('common.expected')}: <span className="font-medium">{pq.expected}</span>
                  </p>
                </div>
                {pq.correct ? (
                    <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                      <Check className="w-3.5 h-3.5" /> {t('testDetail.correct')}
                    </span>
                  ) : pq.blank ? (
                    <span className="flex items-center gap-1 text-[#9CA3AF] text-xs">
                      <Circle className="w-3.5 h-3.5" /> {t('testDetail.blank')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                      <X className="w-3.5 h-3.5" /> {t('testDetail.incorrect')}
                    </span>
                  )}
              </div>
            ))}
          </div>

          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F3F4F6] bg-[#F9FAFB]">
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-[#6B7280]">{t('common.qNumber')}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-[#6B7280]">{t('common.detected')}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-[#6B7280]">{t('common.expected')}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-[#6B7280]">{t('common.result')}</th>
                </tr>
              </thead>
              <tbody>
                {data.per_question.map((pq) => (
                  <tr
                    key={pq.question}
                    className={`border-b border-[#F3F4F6] ${
                      pq.correct ? 'bg-[#F0FDF4]' : pq.blank ? '' : 'bg-[#FEF2F2]'
                    }`}
                  >
                    <td className="px-5 py-3 font-medium text-[#0F172A]">{pq.question}</td>
                    <td className="px-5 py-3 text-[#6B7280]">
                      {pq.detected || <span className="text-[#D1D5DB] italic">—</span>}
                    </td>
                    <td className="px-5 py-3 text-[#6B7280]">{pq.expected}</td>
                    <td className="px-5 py-3">
                      {pq.correct ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <Check className="w-3.5 h-3.5" /> {t('testDetail.correct')}
                        </span>
                      ) : pq.blank ? (
                        <span className="inline-flex items-center gap-1 text-[#9CA3AF]">
                          <Circle className="w-3.5 h-3.5" /> {t('testDetail.blank')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                          <X className="w-3.5 h-3.5" /> {t('testDetail.incorrect')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
