import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, AutoDetectResult } from '../api/client'
import { useTranslation } from 'react-i18next'
import CameraScanner from '../components/CameraScanner'
import { Upload, Camera, FileUp, ScanSearch, ArrowRight, Check, X, Circle } from 'lucide-react'

export default function AutoDetectPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<AutoDetectResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'upload' | 'camera'>('camera')

  const handleGrade = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await api.autoDetectGrade(file)
      if (res.qr_detected && !res.exam_detected && !res.markers_detected && res.test_id) {
        setResult(res)
        setTimeout(() => navigate(`/tests/${res.test_id}`), 800)
        return
      }
      setResult(res)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCameraGraded = (res: AutoDetectResult) => setResult(res)
  const handleCameraRedirect = (testId: number) => navigate(`/tests/${testId}`)

  return (
    <div>
      <h1 className="text-2xl md:text-[32px] font-bold tracking-tight text-[#0F172A] mb-1 md:mb-2">{t('autoDetect.title')}</h1>
      <p className="text-[#6B7280] text-sm mb-6 md:mb-8">{t('autoDetect.subtitle')}</p>

      <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl w-full md:w-fit mb-6 md:mb-8">
        <button
          onClick={() => { setMode('camera'); setError(''); setResult(null) }}
          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'camera'
              ? 'bg-white text-[#0F172A] shadow-sm'
              : 'text-[#6B7280] hover:text-[#0F172A]'
          }`}
        >
          <Camera className="w-4 h-4" />
          {t('autoDetect.camera')}
        </button>
        <button
          onClick={() => { setMode('upload'); setError('') }}
          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'upload'
              ? 'bg-white text-[#0F172A] shadow-sm'
              : 'text-[#6B7280] hover:text-[#0F172A]'
          }`}
        >
          <Upload className="w-4 h-4" />
          {t('autoDetect.upload')}
        </button>
      </div>

      <div className={mode === 'camera' ? '' : 'hidden'}>
        <CameraScanner
          active={mode === 'camera'}
          onGraded={handleCameraGraded}
          onRedirect={handleCameraRedirect}
        />

        {result && result.status === 'graded' && (
          <div className="mt-4 md:mt-6">
            <GradedResult result={result} onReset={() => { setResult(null); setMode('upload') }} />
          </div>
        )}
      </div>

      {mode === 'upload' && (
        <>
          <div className="card p-6 md:p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4 md:mb-5">
              <ScanSearch className="w-7 h-7 text-brand-600" />
            </div>
            <h2 className="text-lg font-semibold text-[#0F172A] mb-1 md:mb-2">{t('autoDetect.uploadSheet')}</h2>
            <p className="text-[#6B7280] text-sm mb-4 md:mb-5">{t('autoDetect.qrScan')}</p>

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
              {loading ? t('autoDetect.detecting') : t('autoDetect.detectGrade')}
            </button>
          )}

          {error && (
            <div className="mt-5 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100">{error}</div>
          )}

          {result && result.status === 'qr_only' && !result.should_redirect && (
            <div className="card p-4 md:p-6 mt-4 md:mt-6 border-brand-200 bg-brand-50/30">
              <p className="text-brand-800 font-semibold mb-2">{t('autoDetect.qrDetected')}</p>
              <p className="text-brand-700 text-sm mb-1">
                {t('autoDetect.examIdentified', { name: result.test_name || '' })}
              </p>
              <div className="w-full bg-brand-100 rounded-full h-1 mt-3 overflow-hidden">
                <div className="bg-brand-500 h-1 animate-pulse w-2/3 rounded-full" />
              </div>
            </div>
          )}

          {result && result.status === 'not_detected' && (
            <div className="card p-4 md:p-6 mt-4 md:mt-6 border-amber-200 bg-amber-50/30">
              <p className="text-amber-800 font-semibold mb-2">{t('autoDetect.noQr')}</p>
              <p className="text-amber-700 text-sm mb-4">{result.error}</p>
              <Link to="/" className="btn-ghost">
                <ArrowRight className="w-3.5 h-3.5" /> {t('autoDetect.selectManually')}
              </Link>
            </div>
          )}

          {result && result.status === 'graded' && (
            <GradedResult result={result} onReset={() => { setResult(null); setFile(null) }} />
          )}
        </>
      )}
    </div>
  )
}

function GradedResult({ result, onReset }: { result: AutoDetectResult; onReset: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="card p-4 md:p-6 border-emerald-200 bg-emerald-50/30">
        <p className="font-medium text-emerald-800 text-sm md:text-base">
          {t('autoDetect.detected')}: <span className="font-bold">{result.test_name}</span>
        </p>
        <p className="text-emerald-600 text-xs md:text-sm mt-1">
          {t('autoDetect.testNum', { id: result.test_id })} &middot; {t('autoDetect.sheetNum', { id: result.sheet_id })}
        </p>
      </div>

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
          style={{ width: `${((result.score ?? 0) / (result.total_questions ?? 1)) * 100}%` }}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {result.test_id && (
          <Link to={`/tests/${result.test_id}`} className="btn-secondary flex-1 sm:flex-none">
            {t('common.view')}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
        <button onClick={onReset} className="btn-ghost">
          {t('grading.gradeAnother')}
        </button>
      </div>
    </div>
  )
}
