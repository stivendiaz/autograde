const API_BASE = import.meta.env.VITE_API_URL || '/api'

export { API_BASE }

function getToken(): string | null {
  try {
    const saved = localStorage.getItem('auth')
    if (saved) return JSON.parse(saved).token
  } catch {}
  return null
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  if (!options?.body || !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json()
}

export interface TestListEntry {
  id: number
  name: string
  description: string
  number_of_questions: number
  number_of_options: number
  created_at: string
  has_sheet: boolean
}

export interface QuestionDef {
  question_number: number
  options: string[]
  correct_answer: string
}

export interface TestDetail {
  test: {
    id: number
    name: string
    description: string
    number_of_questions: number
    number_of_options: number
    created_at: string
    updated_at: string
  }
  template: Record<string, unknown> | null
  evaluation: Record<string, unknown> | null
  course: { id: number; name: string } | null
  assignments: Array<{ id: number; student_id: number; student_name: string; assigned_at: string }>
}

export interface GeneratedSheet {
  id: number
  test_id: number
  file_path: string
  image_path: string
  pdf_path: string | null
  created_at: string
}

export interface PerQuestionResult {
  question: number
  detected: string
  expected: string
  correct: boolean
  blank: boolean
}

export interface GradeResponse {
  id: number
  score: number
  total_questions: number
  correct_count: number
  incorrect_count: number
  blank_count: number
  detected_answers: Record<string, string>
  per_question: PerQuestionResult[]
}

export interface GradingResultEntry {
  id: number
  test_id: number
  uploaded_image_path: string
  detected_answers_json: Record<string, string>
  score: number
  total_questions: number
  correct_count: number
  incorrect_count: number
  blank_count: number
  result_json: Record<string, unknown>
  created_at: string
}

export interface AutoDetectResult {
  status: 'graded' | 'qr_only' | 'not_detected'
  qr_detected: boolean
  exam_detected: boolean
  markers_detected: boolean
  test_id?: number
  test_name?: string
  sheet_id?: number
  score?: number
  total_questions?: number
  correct_count?: number
  incorrect_count?: number
  blank_count?: number
  answers?: Record<string, string>
  should_redirect?: boolean
  redirect_url?: string
  error?: string
}

export const api = {
  listTests: () => request<TestListEntry[]>('/tests'),

  getTest: (id: number) => request<TestDetail>(`/tests/${id}`),

  createTest: (data: {
    name: string
    description: string
    course_id?: number
    questions: QuestionDef[]
  }) =>
    request<TestDetail>('/tests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateSheet: (testId: number) =>
    request<GeneratedSheet>(`/tests/${testId}/sheets/generate`, { method: 'POST' }),

  getSheetDownloadUrl: (testId: number) => `/api/tests/${testId}/sheets/download`,
  getSheetPdfUrl: (testId: number) => `/api/tests/${testId}/sheets/download-pdf`,
  getAnswerKeyImageUrl: (testId: number) => `/api/tests/${testId}/sheets/answer-key-image`,
  getAnswerKeyPdfUrl: (testId: number) => `/api/tests/${testId}/sheets/answer-key-pdf`,

  getSheetWithLang: (testId: number, lang: string) => `/api/tests/${testId}/sheets/download?lang=${lang}`,
  getSheetPdfWithLang: (testId: number, lang: string) => `/api/tests/${testId}/sheets/download-pdf?lang=${lang}`,
  getAnswerKeyImageWithLang: (testId: number, lang: string) => `/api/tests/${testId}/sheets/answer-key-image?lang=${lang}`,
  getAnswerKeyPdfWithLang: (testId: number, lang: string) => `/api/tests/${testId}/sheets/answer-key-pdf?lang=${lang}`,

  gradeUpload: async (testId: number, file: File, studentId?: number): Promise<GradeResponse> => {
    const form = new FormData()
    form.append('file', file)
    let url = `${API_BASE}/tests/${testId}/grading`
    if (studentId != null) url += `?student_id=${studentId}`
    const res = await fetch(url, {
      method: 'POST',
      body: form,
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`API error ${res.status}: ${body}`)
    }
    return res.json()
  },

  listResults: (testId: number) =>
    request<GradingResultEntry[]>(`/tests/${testId}/grading`),

  autoDetectGrade: async (file: File): Promise<AutoDetectResult> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/grade/auto-detect`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`API error ${res.status}: ${body}`)
    }
    return res.json()
  },
}
