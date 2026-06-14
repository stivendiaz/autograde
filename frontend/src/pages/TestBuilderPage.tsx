import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, QuestionDef } from '../api/client'
import { useAuth, authFetch } from '../auth/AuthContext'
import { useTranslation } from 'react-i18next'
import AnswerKeyGrid from '../components/AnswerKeyGrid'
import QuestionCards from '../components/QuestionCards'
import { ArrowLeft, Save, Plus } from 'lucide-react'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function makeQuestion(qno: number, numOpts = 4): QuestionDef {
  return {
    question_number: qno,
    options: OPTION_LABELS.slice(0, numOpts),
    correct_answer: 'A',
  }
}

export default function TestBuilderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlCourseId = searchParams.get('courseId')
  const { token } = useAuth()
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState<number | null>(urlCourseId ? Number(urlCourseId) : null)
  const [courses, setCourses] = useState<{ id: number; name: string }[]>([])
  const [questions, setQuestions] = useState<QuestionDef[]>([makeQuestion(1)])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    authFetch('/courses', token)
      .then((r) => r.json())
      .then((data) => setCourses(data || []))
      .catch(() => {})
  }, [token])

  const renumber = useCallback(
    (qs: QuestionDef[]) => qs.map((q, i) => ({ ...q, question_number: i + 1 })),
    []
  )

  const addQuestion = () => {
    setQuestions((prev) => {
      const n = prev.length + 1
      return renumber([...prev, makeQuestion(n)])
    })
  }

  const deleteQuestion = (qno: number) => {
    setQuestions((prev) => {
      if (prev.length <= 1) return prev
      return renumber(prev.filter((q) => q.question_number !== qno))
    })
  }

  const duplicateQuestion = (qno: number) => {
    setQuestions((prev) => {
      const src = prev.find((q) => q.question_number === qno)
      if (!src) return prev
      return renumber([...prev, { ...src, question_number: prev.length + 1 }])
    })
  }

  const handleSave = async () => {
    if (!name.trim()) return setError('Test name is required')
    if (questions.length === 0) return setError('At least one question is required')
    for (const q of questions) {
      if (q.options.length < 2) {
        return setError(`Question ${q.question_number} must have at least 2 options`)
      }
      if (!q.options.includes(q.correct_answer)) {
        return setError(`Question ${q.question_number} correct answer must be one of its options`)
      }
    }
    setError('')
    setSaving(true)
    try {
      const detail = await api.createTest({
        name: name.trim(),
        description: description.trim(),
        course_id: courseId ?? undefined,
        questions,
      })
      await api.generateSheet(detail.test.id)
      navigate(`/tests/${detail.test.id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <button onClick={() => navigate('/')} className="text-[#6B7280] hover:text-[#0F172A] transition-colors p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-[32px] font-bold tracking-tight text-[#0F172A]">{t('builder.title')}</h1>
          <p className="text-[#6B7280] text-sm mt-0.5 hidden md:block">{t('builder.subtitle')}</p>
        </div>
      </div>

      <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-5 md:gap-6 mb-6 md:mb-8">
        <div className="md:col-span-2 space-y-4 md:space-y-5">
          <div className="card p-4 md:p-6">
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-4 md:mb-5">{t('builder.testInfo')}</h2>
            <div className="space-y-4">
              <div>
                <label className="label">{t('builder.testName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder={t('builder.testNamePlaceholder')}
                />
              </div>
              <div>
                <label className="label">{t('builder.course')}</label>
                <select
                  value={courseId ?? ''}
                  onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : null)}
                  className="input"
                >
                  <option value="">{t('builder.noCourse')}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('builder.description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder={t('builder.descriptionPlaceholder')}
                />
              </div>
            </div>
          </div>

          <div className="card p-4 md:p-6">
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3 md:mb-4">{t('builder.quickAdd')}</h2>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 20, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setQuestions((prev) => {
                      const start = prev.length
                      const add = Array.from({ length: n }, (_, i) => makeQuestion(start + i + 1))
                      return renumber([...prev, ...add])
                    })
                  }
                  className="btn-secondary text-sm py-2 px-4 h-auto"
                >
                  +{n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="card p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-5">
              <div>
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">{t('builder.answerKey')}</h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">{t('builder.questionsCount', { count: questions.length })}</p>
              </div>
              <button type="button" onClick={addQuestion} className="btn-primary text-sm py-2 px-3 h-auto md:hidden">
                <Plus className="w-4 h-4" />
                {t('builder.addQuestion')}
              </button>
            </div>

            <div className="md:hidden">
              <QuestionCards
                questions={questions}
                onChange={setQuestions}
                onDelete={deleteQuestion}
                onDuplicate={duplicateQuestion}
              />
            </div>

            <div className="hidden md:block">
              <AnswerKeyGrid
                questions={questions}
                onChange={setQuestions}
                onDelete={deleteQuestion}
                onDuplicate={duplicateQuestion}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 sm:flex-none min-h-[56px] sm:min-h-0">
          <Save className="w-4 h-4" />
          {saving ? t('builder.saving') : t('builder.save')}
        </button>
        <button onClick={() => navigate('/')} className="btn-secondary flex-1 sm:flex-none min-h-[56px] sm:min-h-0">
          {t('builder.cancel')}
        </button>
      </div>
    </div>
  )
}
