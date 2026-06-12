import { useRef, useEffect, useState, useCallback } from 'react'
import { AutoDetectResult } from '../api/client'
import { useTranslation } from 'react-i18next'
import { Camera, CameraOff, ScanLine, Check, Loader } from 'lucide-react'

const SCAN_INTERVAL = 1000

type Status =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'qr_detected'
  | 'redirecting'
  | 'graded'

interface Props {
  active: boolean
  onGraded: (result: AutoDetectResult) => void
  onRedirect: (testId: number) => void
}

export default function CameraScanner({ active, onGraded, onRedirect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingRef = useRef(false)

  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<AutoDetectResult | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!active) {
      stop()
      setStatus('idle')
      return
    }

    let cancelled = false

    async function begin() {
      setError('')
      setResult(null)
      setStatus('starting')

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        setStatus('scanning')
        timerRef.current = setInterval(() => {
          if (processingRef.current) return
          const video = videoRef.current
          const canvas = canvasRef.current
          if (!video || !canvas || video.readyState < 2) return

          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          ctx.drawImage(video, 0, 0)
          canvas.toBlob(async (blob) => {
            if (!blob || cancelled) return
            processingRef.current = true

            try {
              const file = new File([blob], 'frame.png', { type: 'image/png' })
              const form = new FormData()
              form.append('file', file)

              const res = await fetch('/api/grade/detect-frame', { method: 'POST', body: form })
              if (!res.ok || cancelled) {
                processingRef.current = false
                return
              }

              const data: AutoDetectResult = await res.json()
              if (cancelled) {
                processingRef.current = false
                return
              }

              if (data.status === 'graded') {
                setStatus('graded')
                setResult(data)
                stop()
                onGraded(data)
              } else if (data.status === 'qr_only') {
                setStatus('redirecting')
                stop()
                if (data.test_id) onRedirect(data.test_id)
              } else if (data.qr_detected) {
                setStatus('qr_detected')
              } else {
                setStatus('scanning')
              }
            } catch {
              // ignore network errors
            }

            processingRef.current = false
          }, 'image/png')
        }, SCAN_INTERVAL)
      } catch (e: any) {
        if (cancelled) return
        const msg = e?.message || e?.name || ''
        if (msg.includes('NotAllowed') || msg.includes('Permission')) {
          setError('Camera permission denied. Please allow camera access and try again.')
        } else if (msg.includes('NotFound')) {
          setError('No camera found on this device.')
        } else {
          setError(msg || 'Unable to start camera.')
        }
        setStatus('idle')
      }
    }

    begin()

    return () => {
      cancelled = true
      stop()
    }
  }, [active, stop, onGraded, onRedirect])

  const statusBadge = () => {
    switch (status) {
      case 'starting':
        return (
          <span className="inline-flex items-center gap-1.5 bg-amber-50/90 text-amber-700 border border-amber-200/50 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
            <Loader className="w-3 h-3 animate-spin" />
            {t('autoDetect.startingCamera')}
          </span>
        )
      case 'scanning':
        return (
          <span className="inline-flex items-center gap-1.5 bg-brand-50/90 text-brand-700 border border-brand-200/50 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
            <ScanLine className="w-3 h-3" />
            {t('autoDetect.pointCamera')}
          </span>
        )
      case 'qr_detected':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-50/90 text-emerald-700 border border-emerald-200/50 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm animate-pulse">
            <Check className="w-3 h-3" />
            {t('autoDetect.qrDetected')}
          </span>
        )
      case 'redirecting':
        return (
          <span className="inline-flex items-center gap-1.5 bg-brand-50/90 text-brand-700 border border-brand-200/50 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
            <Loader className="w-3 h-3 animate-spin" />
            {t('autoDetect.scanning')}
          </span>
        )
      default:
        return null
    }
  }

  if (!active && status === 'idle') return null

  const showVideo = status === 'starting' || status === 'scanning' || status === 'qr_detected' || status === 'redirecting'

  return (
    <div>
      {showVideo && (
        <div className="card overflow-hidden mb-4">
          <div className="relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-[3/4] md:aspect-[4/3] object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              {statusBadge()}
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white/70 text-xs text-center">
                {t('autoDetect.pointCamera')}
              </p>
            </div>
          </div>

          <div className="p-3 md:p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#6B7280]" />
              <span className="text-sm text-[#6B7280]">{t('autoDetect.cameraActive')}</span>
            </div>
            <button
              onClick={() => { stop(); setStatus('idle') }}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              <CameraOff className="w-4 h-4" />
              {t('autoDetect.stop')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100 mb-4">{error}</div>
      )}

      {status === 'graded' && result && (
        <div className="card p-4 md:p-5 bg-emerald-50/30 border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-sm font-semibold text-emerald-800">{t('autoDetect.gradedSuccess')}</span>
          </div>
          <p className="text-emerald-700 text-sm">
            {result.test_name} — Score: {result.score}/{result.total_questions}
          </p>
        </div>
      )}
    </div>
  )
}
