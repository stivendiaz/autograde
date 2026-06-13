import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, TestDetail, API_BASE } from '../api/client'
import { useAuth, authFetch } from '../auth/AuthContext'
import {
  ArrowLeft, Download, ScanLine, Check, X, Circle, Clock, Maximize2, X as XIcon,
  AlertTriangle, User, Printer, Edit3, Save, FileText,
} from 'lucide-react'

interface GradingHistoryItem {
  id: number
  test_id: number
  test_name: string
  sheet_id: number | null
  score: number
  total_questions: number
  correct_count: number
  incorrect_count: number
  blank_count: number
  ambiguous_count: number
  annotated_image_path: string | null
  processed_image_path: string | null
  student_name: string
  created_at: string
}

interface MyGrade {
  has_grade: boolean
  grade: { id: number; score: number; total_questions: number; correct_count: number; incorrect_count: number; blank_count: number; annotated_image_path: string | null; created_at: string } | null
  stats: { average_score: number; highest_score: number; submissions: number }
}

export default function TestDetailPage() {
  const { testId } = useParams<{ testId: string }>()
  const navigate = useNavigate()
  const { token, isTeacher, isStudent } = useAuth()
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'es'
  const [data, setData] = useState<TestDetail | null>(null)
  const [history, setHistory] = useState<GradingHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [preview, setPreview] = useState<GradingHistoryItem | null>(null)
  const [studentSummary, setStudentSummary] = useState<MyGrade | null>(null)

  // Answer key editing
  const [showAnswerKey, setShowAnswerKey] = useState(false)
  const [editingAnswers, setEditingAnswers] = useState<Record<number, string>>({})
  const [savingAnswers, setSavingAnswers] = useState(false)

  // Teacher stats
  const [teacherStats, setTeacherStats] = useState<{ average_score: number; highest_score: number; submissions: number } | null>(null)

  // Sheet PDF preview
  const [previewPdf, setPreviewPdf] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    if (!testId) return
    const id = Number(testId)
    api.getTest(id).then(setData).catch(console.error)

    setHistoryLoading(true)
    authFetch(`/grading-history/test/${id}`, token)
      .then((r) => r.json())
      .then(setHistory)
      .catch(console.error)
      .finally(() => setHistoryLoading(false))

    if (isStudent) {
      authFetch(`/tests/${id}/student-summary`, token)
        .then((r) => r.json())
        .then(setStudentSummary)
        .catch(() => {})
    }

    if (isTeacher) {
      authFetch(`/tests/${id}/student-summary`, token)
        .then((r) => r.json())
        .then((d) => setTeacherStats(d.stats))
        .catch(() => {})
    }
  }, [testId, token, isStudent, isTeacher])

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [preview])

  useEffect(() => {
    if (!showAnswerKey) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAnswerKey(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showAnswerKey])

  if (!data) {
    return <div className="py-20 text-center text-[#6B7280]"><div className="animate-pulse">Loading...</div></div>
  }

  const { test, course } = data
  const latestHistory = history.length > 0 ? history[0] : null
  const sheetUrl = api.getSheetWithLang(test.id, lang)
  const keyUrl = api.getAnswerKeyImageWithLang(test.id, lang)
  const sheetPdfUrl = api.getSheetPdfWithLang(test.id, lang)
  const keyPdfUrl = api.getAnswerKeyPdfWithLang(test.id, lang)
  const openForPrint = (url: string) => window.open(url, '_blank')

  const openAnswerKeyModal = () => {
    if (!data.evaluation) return
    const raw = (data.evaluation as any).answer_key_json
    const qs = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([k, v]) => ({ question_number: Number(k), correct_answer: v }))
    const map: Record<number, string> = {}
    qs.forEach((q: any) => { map[q.question_number] = q.correct_answer })
    setEditingAnswers(map)
    setShowAnswerKey(true)
  }

  const saveAnswerKey = async () => {
    if (!testId) return
    setSavingAnswers(true)
    try {
      const payload = Object.entries(editingAnswers).map(([qno, answer]) => ({
        question_number: Number(qno),
        correct_answer: answer,
      }))
      const res = await authFetch(`/tests/${testId}/answer-key`, token, {
        method: 'PUT',
        body: JSON.stringify({ answer_key: payload }),
      })
      if (res.ok) {
        const updated = await api.getTest(Number(testId))
        setData(updated)
        setShowAnswerKey(false)
      }
    } catch (_e) {} finally { setSavingAnswers(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Link to="/" className="text-[#6B7280] hover:text-[#0F172A] transition-colors p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-[32px] font-bold tracking-tight text-[#0F172A] truncate">{test.name}</h1>
          <p className="text-[#6B7280] text-sm mt-0.5 truncate">{course ? t('testDetail.course', { name: course.name }) : test.description}</p>
        </div>
        {isTeacher && (
          <Link to={`/tests/${test.id}/grade`} className="btn-primary hidden md:inline-flex">
            <ScanLine className="w-4 h-4" /> {t('testDetail.gradeSheet')}
          </Link>
        )}
      </div>

      {/* ===== STUDENT VIEW ===== */}
      {isStudent && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {studentSummary && studentSummary.has_grade && studentSummary.grade ? (
            <div className="card p-5 text-center">
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">{t('testDetail.myGrade')}</p>
              <p className="text-4xl font-bold text-[#0F172A]">
                {studentSummary.grade.score}<span className="text-lg text-[#9CA3AF] font-normal">/{studentSummary.grade.total_questions}</span>
              </p>
              <div className="flex justify-center gap-4 mt-3 text-xs">
                <span className="text-emerald-600 font-medium">{studentSummary.grade.correct_count} {t('testDetail.correct')}</span>
                <span className="text-red-600 font-medium">{studentSummary.grade.incorrect_count} {t('testDetail.incorrect')}</span>
                <span className="text-[#6B7280]">{studentSummary.grade.blank_count} {t('testDetail.blank')}</span>
              </div>
              {studentSummary.grade.annotated_image_path && (
                  <button onClick={() => navigate(`/history/${studentSummary.grade!.id}`)} className="btn-ghost text-sm mt-3">{t('testDetail.viewProof')}</button>
              )}
            </div>
          ) : (
            <div className="card p-5 flex items-center justify-center">
                <p className="text-[#6B7280] text-sm">{t('testDetail.noGrade')}</p>
            </div>
          )}
          {studentSummary && (
            <div className="card p-5">
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-4">{t('testDetail.classSummary')}</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><span className="text-sm text-[#6B7280]">{t('testDetail.average')}</span><span className="text-sm font-semibold">{studentSummary.stats.average_score}</span></div>
                <div className="flex items-center justify-between"><span className="text-sm text-[#6B7280]">{t('testDetail.highest')}</span><span className="text-sm font-semibold">{studentSummary.stats.highest_score}</span></div>
                <div className="flex items-center justify-between"><span className="text-sm text-[#6B7280]">{t('testDetail.submissions')}</span><span className="text-sm font-semibold">{studentSummary.stats.submissions}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TEACHER VIEW ===== */}
      {isTeacher && (
        <>
          {/* Class Summary + Results Chart */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="card p-4 md:p-5 text-center">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">{t('testDetail.average')}</p>
              <p className="text-2xl md:text-[32px] font-bold text-[#0F172A]">{teacherStats?.average_score ?? '—'}</p>
            </div>
            <div className="card p-4 md:p-5 text-center">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">{t('testDetail.highest')}</p>
              <p className="text-2xl md:text-[32px] font-bold text-emerald-600">{teacherStats?.highest_score ?? '—'}</p>
            </div>
            <div className="card p-4 md:p-5 text-center">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">{t('testDetail.submissions')}</p>
              <p className="text-2xl md:text-[32px] font-bold text-brand-600">{teacherStats?.submissions ?? '0'}</p>
            </div>
            <div className="card p-4 md:p-5 flex flex-col items-center justify-center gap-1">
              <button onClick={openAnswerKeyModal} className="btn-ghost text-sm">
                <Edit3 className="w-4 h-4 mr-1" /> {t('testDetail.answerKey')}
              </button>
            </div>
          </div>

          {/* Results distribution chart */}
          {history.length > 0 && (
            <div className="card p-4 md:p-6 mb-6">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-4">Score Distribution</p>
              <div className="h-10 flex items-end gap-1">
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((bucket) => {
                  const count = history.filter((h) => {
                    const pct = (h.score / h.total_questions) * 100
                    return pct >= bucket && pct < bucket + 10
                  }).length
                  const maxCount = Math.max(1, ...history.map((h) => 1))
                  const height = count > 0 ? Math.max(4, (count / history.length) * 100) : 0
                  return (
                    <div key={bucket} className="flex-1 flex flex-col items-center justify-end h-full" title={`${bucket}-${bucket + 9}%: ${count} student(s)`}>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${height}%`,
                          backgroundColor: bucket >= 70 ? '#22C55E' : bucket >= 40 ? '#F59E0B' : '#EF4444',
                          minHeight: count > 0 ? 4 : 0,
                        }}
                      />
                      <span className="text-[9px] text-[#9CA3AF] mt-1">{bucket}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#9CA3AF]">0%</span>
                <span className="text-[10px] text-[#9CA3AF]">100%</span>
              </div>
            </div>
          )}

          {/* Sheets export actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <button onClick={() => setPreviewPdf({ url: sheetUrl, title: t('testDetail.answerSheet') })} className="card p-3 flex flex-col items-center gap-1 hover:shadow-elevated transition-all active:scale-[0.98]">
              <Printer className="w-5 h-5 text-brand-600" />
              <span className="text-xs font-medium text-[#0F172A]">{t('testDetail.answerSheet')}</span>
              <span className="text-[10px] text-[#9CA3AF]">{t('testDetail.previewPrint')}</span>
            </button>
            <a href={sheetPdfUrl} download target="_blank" rel="noreferrer" className="card p-3 flex flex-col items-center gap-1 hover:shadow-elevated transition-all active:scale-[0.98]">
              <FileText className="w-5 h-5 text-brand-600" />
              <span className="text-xs font-medium text-[#0F172A]">{t('testDetail.answerSheet')}</span>
              <span className="text-[10px] text-[#9CA3AF]">{t('testDetail.downloadPdf')}</span>
            </a>
            <button onClick={() => setPreviewPdf({ url: keyUrl, title: t('testDetail.answerKeySheet') })} className="card p-3 flex flex-col items-center gap-1 hover:shadow-elevated transition-all active:scale-[0.98]">
              <Printer className="w-5 h-5 text-brand-600" />
              <span className="text-xs font-medium text-[#0F172A]">{t('testDetail.answerKeySheet')}</span>
              <span className="text-[10px] text-[#9CA3AF]">{t('testDetail.previewPrint')}</span>
            </button>
            <a href={keyPdfUrl} download target="_blank" rel="noreferrer" className="card p-3 flex flex-col items-center gap-1 hover:shadow-elevated transition-all active:scale-[0.98]">
              <FileText className="w-5 h-5 text-brand-600" />
              <span className="text-xs font-medium text-[#0F172A]">{t('testDetail.answerKeySheet')}</span>
              <span className="text-[10px] text-[#9CA3AF]">{t('testDetail.downloadPdf')}</span>
            </a>
          </div>

          {/* Grading History */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-[#0F172A]">{t('testDetail.gradingHistory')}</h2>
                <p className="text-sm text-[#6B7280] mt-0.5">{t('testDetail.gradedSheet', { count: history.length })}</p>
              </div>
            </div>
            {historyLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="card p-5 animate-pulse">
                    <div className="h-4 bg-[#F3F4F6] rounded w-2/3 mb-3" />
                    <div className="h-3 bg-[#F3F4F6] rounded w-1/2 mb-4" />
                    <div className="aspect-[3/2] bg-[#F3F4F6] rounded-lg" />
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="card p-8 text-center"><Clock className="w-8 h-8 text-[#9CA3AF] mx-auto mb-3" /><p className="text-[#6B7280] text-sm">{t('testDetail.noHistory')}</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {history.map((h) => {
                  const pct = h.total_questions > 0 ? Math.round((h.score / h.total_questions) * 100) : 0
                  return (
                    <div key={h.id} className="card overflow-hidden group">
                      <div className="p-4 md:p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-lg font-bold ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
                              <span className="text-sm text-[#9CA3AF]">{h.score}/{h.total_questions}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                              <span><Check className="w-3 h-3 text-emerald-500 inline mr-0.5" />{h.correct_count}</span>
                              <span><X className="w-3 h-3 text-red-500 inline mr-0.5" />{h.incorrect_count}</span>
                              <span><Circle className="w-3 h-3 text-[#9CA3AF] inline mr-0.5" />{h.blank_count}</span>
                            </div>
                          </div>
                          <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1 shrink-0"><Clock className="w-3 h-3" />{new Date(h.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 mb-3">
                          <div className={`h-1.5 rounded-full ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-[#9CA3AF] mb-3">{t('testDetail.student')}: <span className="font-medium text-[#6B7280]">{h.student_name || t('testDetail.anonymous')}</span></p>
                        {h.annotated_image_path ? (
                          <div className="relative cursor-pointer rounded-lg overflow-hidden bg-[#F9FAFB] border border-[#F3F4F6] group/img" onClick={() => setPreview(h)}>
                            <img src={`${API_BASE}/grading-history/${h.id}/proof`} alt="Proof" loading="lazy" className="w-full aspect-[3/2] object-contain" />
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors flex items-center justify-center">
                              <Maximize2 className="w-5 h-5 text-[#9CA3AF] opacity-0 group-hover/img:opacity-100" />
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-[3/2] bg-[#F9FAFB] rounded-lg border border-[#F3F4F6] flex items-center justify-center"><span className="text-xs text-[#9CA3AF]">{t('testDetail.noProofImage')}</span></div>
                        )}
                        <button onClick={() => navigate(`/history/${h.id}`)} className="btn-ghost text-sm mt-3 w-full justify-center">{t('testDetail.viewFullHistory')}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {isTeacher && (
        <Link to={`/tests/${test.id}/grade`} className="btn-primary w-full mt-6 md:hidden">
          <ScanLine className="w-4 h-4" /> Grade a Sheet
        </Link>
      )}

      {/* Proof Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h3 className="font-semibold text-[#0F172A]">{t('testDetail.proofImage')}</h3>
                <p className="text-xs text-[#6B7280]">{t('testDetail.scoreLabel', { score: preview.score, total: preview.total_questions })} &middot; {preview.correct_count}c / {preview.incorrect_count}i / {preview.blank_count}b</p>
              </div>
              <button onClick={() => setPreview(null)} className="p-2 rounded-lg hover:bg-[#F3F4F6]"><XIcon className="w-5 h-5 text-[#6B7280]" /></button>
            </div>
            <div className="p-5">
              {preview.annotated_image_path && <img src={`${API_BASE}/grading-history/${preview.id}/proof`} alt="Proof" className="w-full rounded-xl border border-[#F3F4F6]" />}
              <div className="flex items-center gap-3 mt-5">
                <button onClick={() => { setPreview(null); navigate(`/history/${preview.id}`) }} className="btn-primary flex-1">{t('testDetail.viewFullHistory')}</button>
                <button onClick={() => setPreview(null)} className="btn-secondary flex-1">{t('testDetail.close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Answer Key Edit Modal */}
      {showAnswerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowAnswerKey(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h3 className="font-semibold text-[#0F172A]">{t('testDetail.editAnswerKey')}</h3>
                <p className="text-xs text-[#6B7280]">{t('testDetail.updateAnswers')}</p>
              </div>
              <button onClick={() => setShowAnswerKey(false)} className="p-2 rounded-lg hover:bg-[#F3F4F6]"><XIcon className="w-5 h-5 text-[#6B7280]" /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {Object.entries(editingAnswers)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([qno, answer]) => {
                  // Get options from template
                  const layout = (data.template as any)?.layout_json
                  const qData = layout?.questions?.find((q: any) => q.number === Number(qno))
                  const options = qData?.options?.map((o: any) => o.label) || ['A', 'B', 'C', 'D']
                  return (
                    <div key={qno} className="flex items-center gap-3 py-2 px-3 bg-[#F9FAFB] rounded-lg">
                      <span className="text-sm font-medium text-[#9CA3AF] w-10 shrink-0">Q{qno}</span>
                      <select
                        value={answer}
                        onChange={(e) => setEditingAnswers((prev) => ({ ...prev, [Number(qno)]: e.target.value }))}
                        className="input flex-1"
                      >
                        {options.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
            </div>
            <div className="border-t border-[#E5E7EB] p-5 flex items-center gap-3">
              <button onClick={saveAnswerKey} disabled={savingAnswers} className="btn-primary flex-1">
                <Save className="w-4 h-4" /> {savingAnswers ? t('testDetail.saving') : t('testDetail.saveChanges')}
              </button>
              <button onClick={() => setShowAnswerKey(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet Preview Modal */}
      {previewPdf && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white" onClick={() => setPreviewPdf(null)}>
          <div className="no-print sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-3 flex items-center justify-between z-10">
            <h3 className="font-semibold text-[#0F172A]">{previewPdf.title}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => { document.title = previewPdf.title; window.print(); setTimeout(() => { document.title = 'LiveTest — OMR Exam Platform' }, 100) }} className="btn-primary text-sm py-1.5 px-3 h-auto">
                <Printer className="w-4 h-4" /> {t('testDetail.print')}
              </button>
              <button onClick={() => setPreviewPdf(null)} className="p-2 rounded-lg hover:bg-[#F3F4F6]">
                <XIcon className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
          </div>
          <div className="print-full flex-1 overflow-auto flex items-start justify-center bg-white p-4">
            <img src={previewPdf.url} alt={previewPdf.title} className="max-w-full shadow-lg" />
          </div>
        </div>
      )}
    </div>
  )
}
