import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, GradeResponse } from '../api/client'
import { useAuth, authFetch } from '../auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Upload, Check, X, Circle, FileUp, Users } from 'lucide-react'

interface StudentOption {
  id: number
  name: string
  email: string
}

export default function GradeSheetPage() {
  const { testId } = useParams<{ testId: string }>()
  const { token } = useAuth()
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<GradeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)
  const [students, setStudents] = useState<StudentOption[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)

  useEffect(() => {
    if (!testId || !token) return
    const loadStudents = async () => {
      setStudentsLoading(true)
      try {
        const testRes = await authFetch(`/tests/${testId}`, token)
        if (!testRes.ok) return
        const testData = await testRes.json()
        const courseId = testData.course?.id
        if (!courseId) return

        const courseRes = await authFetch(`/courses/${courseId}`, token)
        if (!courseRes.ok) return
        const courseData = await courseRes.json()
        setStudents(courseData.students || [])
      } catch {} finally { setStudentsLoading(false) }
    }
    loadStudents()
  }, [testId, token])

  const handleGrade = async () => {
    if (!file || !testId) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await api.gradeUpload(Number(testId), file, selectedStudent ?? undefined)
      setResult(res)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) setFile(f)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Link to={`/tests/${testId}`} className="text-[#6B7280] hover:text-[#0F172A] transition-colors p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-[32px] font-bold tracking-tight text-[#0F172A]">{t('grading.title')}</h1>
          <p className="text-[#6B7280] text-sm mt-0.5 hidden md:block">{t('grading.subtitle')}</p>
        </div>
      </div>

      {!result && (
        <div>
          <div className="card p-5 mb-4">
            <label className="label flex items-center gap-2">
              <Users className="w-4 h-4" /> {t('grading.relatedStudent')}
            </label>
            {students.length > 0 ? (
              <select
                value={selectedStudent ?? ''}
                onChange={(e) => setSelectedStudent(e.target.value ? Number(e.target.value) : null)}
                className="input"
              >
                <option value="">{t('grading.none')}</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.email}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-[#9CA3AF]">{studentsLoading ? t('grading.loadingStudents') : t('grading.noStudents')}</p>
            )}
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`card p-6 md:p-10 text-center transition-all cursor-pointer ${
              dragOver ? 'border-brand-400 bg-brand-50/30 shadow-elevated' : ''
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4 md:mb-5">
              <Upload className="w-7 h-7 text-brand-600" />
            </div>
            <h2 className="text-lg font-semibold text-[#0F172A] mb-1 md:mb-2">{t('grading.uploadSheet')}</h2>
            <p className="text-[#6B7280] text-sm mb-4 md:mb-5">{t('grading.dragDrop')}</p>

            <label className="btn-primary cursor-pointer">
              <FileUp className="w-4 h-4" />
              {t('grading.chooseFile')}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>

            {file && (
              <p className="text-sm text-[#6B7280] mt-4 bg-[#F9FAFB] inline-block px-4 py-2 rounded-lg">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {file && (
            <button
              onClick={handleGrade}
              disabled={loading}
              className="btn-primary w-full mt-4"
            >
              {loading ? t('grading.grading') : t('grading.submit')}
            </button>
          )}

          {error && (
            <div className="mt-5 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100">{error}</div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="card p-4 md:p-5 text-center">
              <p className="text-2xl md:text-[32px] font-bold text-[#0F172A]">{result.score}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">{t('grading.score')}</p>
            </div>
            <div className="card p-4 md:p-5 text-center">
              <p className="text-2xl md:text-[32px] font-bold text-emerald-600">{result.correct_count}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">{t('testDetail.correct')}</p>
            </div>
            <div className="card p-4 md:p-5 text-center">
              <p className="text-2xl md:text-[32px] font-bold text-red-600">{result.incorrect_count}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">{t('testDetail.incorrect')}</p>
            </div>
            <div className="card p-4 md:p-5 text-center">
              <p className="text-2xl md:text-[32px] font-bold text-[#6B7280]">{result.blank_count}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">{t('testDetail.blank')}</p>
            </div>
          </div>

          <div className="w-full bg-[#F3F4F6] rounded-full h-2.5">
            <div
              className="bg-brand-600 h-2.5 rounded-full transition-all"
              style={{ width: `${(result.score / result.total_questions) * 100}%` }}
            />
          </div>

          <div className="md:hidden space-y-2">
            {result.per_question.map((pq) => (
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
                  <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><Check className="w-3.5 h-3.5" /> {t('testDetail.correct')}</span>
                ) : pq.blank ? (
                  <span className="flex items-center gap-1 text-[#9CA3AF] text-xs"><Circle className="w-3.5 h-3.5" /> {t('testDetail.blank')}</span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 text-xs font-medium"><X className="w-3.5 h-3.5" /> {t('testDetail.incorrect')}</span>
                )}
              </div>
            ))}
          </div>

          <div className="hidden md:block card overflow-hidden">
            <div className="p-5 pb-3">
              <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">{t('grading.questionBreakdown')}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[#F3F4F6] bg-[#F9FAFB]">
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-[#6B7280]">{t('common.qNumber')}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-[#6B7280]">{t('common.detected')}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-[#6B7280]">{t('common.expected')}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-[#6B7280]">{t('common.result')}</th>
                </tr>
              </thead>
              <tbody>
                {result.per_question.map((pq) => (
                  <tr key={pq.question} className={`border-b border-[#F3F4F6] ${pq.correct ? 'bg-[#F0FDF4]' : pq.blank ? '' : 'bg-[#FEF2F2]'}`}>
                    <td className="px-5 py-3 font-medium text-[#0F172A]">{pq.question}</td>
                    <td className="px-5 py-3 text-[#6B7280]">{pq.detected || <span className="text-[#D1D5DB] italic">—</span>}</td>
                    <td className="px-5 py-3 text-[#6B7280]">{pq.expected}</td>
                    <td className="px-5 py-3">
                      {pq.correct ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><Check className="w-3.5 h-3.5" /> {t('testDetail.correct')}</span>
                      ) : pq.blank ? (
                        <span className="inline-flex items-center gap-1 text-[#9CA3AF]"><Circle className="w-3.5 h-3.5" /> {t('testDetail.blank')}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium"><X className="w-3.5 h-3.5" /> {t('testDetail.incorrect')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={() => { setResult(null); setFile(null); setSelectedStudent(null) }} className="btn-secondary">
            {t('grading.gradeAnother')}
          </button>
        </div>
      )}
    </div>
  )
}
