import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth, authFetch } from '../auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import ExamCard from '../components/ExamCard'
import { Plus, BookOpen, Users, FileText, UserPlus, Trash2, ArrowLeft, Search, X, Settings, Save } from 'lucide-react'

interface Course {
  id: number
  name: string
  description: string
  teacher_count: number
  student_count: number
  test_count: number
  teachers: { id: number; name: string; email: string }[]
  students: { id: number; name: string; email: string }[]
  tests: { id: number; name: string; number_of_questions: number }[]
  created_at: string
}

interface UserSearchResult {
  id: number
  name: string
  email: string
  role: string
}

export default function CoursesPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { token, isTeacher } = useAuth()
  const { t } = useTranslation()
  const [courses, setCourses] = useState<Course[]>([])
  const [detail, setDetail] = useState<Course | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [addModal, setAddModal] = useState<'teacher' | 'student' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Edit course
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editingCourse, setEditingCourse] = useState(false)

  // Delete course
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingCourse, setDeletingCourse] = useState(false)

  const doSearch = async (role: string) => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const res = await authFetch(`/users?role=${role}&q=${encodeURIComponent(searchQuery)}`, token)
      if (res.ok) setSearchResults(await res.json())
    } catch {} finally { setSearchLoading(false) }
  }

  const openModal = (type: 'teacher' | 'student') => {
    setAddModal(type)
    setSearchQuery('')
    setSearchResults([])
  }

  const fetchCourses = async () => {
    const res = await authFetch('/courses', token)
    if (res.ok) setCourses(await res.json())
  }

  const fetchDetail = async (id: number) => {
    const res = await authFetch(`/courses/${id}`, token)
    if (res.ok) setDetail(await res.json())
  }

  useEffect(() => {
    fetchCourses()
  }, [token])

  useEffect(() => {
    if (courseId) fetchDetail(Number(courseId))
    else setDetail(null)
  }, [courseId])

  const createCourse = async () => {
    if (!newName.trim()) return
    await authFetch('/courses', token, {
      method: 'POST',
      body: JSON.stringify({ name: newName, description: newDesc }),
    })
    setNewName('')
    setNewDesc('')
    setShowCreate(false)
    fetchCourses()
  }

  const addTeacher = async (teacherId: number) => {
    if (!detail) return
    await authFetch(`/courses/${detail.id}/teachers`, token, {
      method: 'POST',
      body: JSON.stringify({ teacher_id: teacherId }),
    })
    await fetchDetail(detail.id)
    setAddModal(null)
  }

  const addStudent = async (studentId: number) => {
    if (!detail) return
    await authFetch(`/courses/${detail.id}/students`, token, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId }),
    })
    await fetchDetail(detail.id)
    setAddModal(null)
  }

  const removeTeacher = async (teacherId: number) => {
    if (!detail) return
    await authFetch(`/courses/${detail.id}/teachers/${teacherId}`, token, { method: 'DELETE' })
    await fetchDetail(detail.id)
  }

  const removeStudent = async (studentId: number) => {
    if (!detail) return
    await authFetch(`/courses/${detail.id}/students/${studentId}`, token, { method: 'DELETE' })
    await fetchDetail(detail.id)
  }

  const openEditModal = () => {
    if (!detail) return
    setEditName(detail.name)
    setEditDesc(detail.description)
    setShowEditModal(true)
  }

  const saveEdit = async () => {
    if (!detail || !editName.trim()) return
    setEditingCourse(true)
    try {
      await api.updateCourse(detail.id, { name: editName, description: editDesc })
      await fetchDetail(detail.id)
      setShowEditModal(false)
    } catch {} finally { setEditingCourse(false) }
  }

  const deleteCourse = async () => {
    if (!detail) return
    setDeletingCourse(true)
    try {
      await api.deleteCourse(detail.id)
      navigate('/courses', { replace: true })
    } catch {} finally { setDeletingCourse(false) }
  }

  if (detail) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/courses" className="text-[#6B7280] hover:text-[#0F172A] p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[#0F172A]">{detail.name}</h1>
            <p className="text-[#6B7280] text-sm">{detail.description}</p>
          </div>
          {isTeacher && (
            <div className="flex items-center gap-1">
              <button onClick={openEditModal} className="btn-ghost p-2" title={t('courses.editCourse')}>
                <Settings className="w-5 h-5 text-[#6B7280]" />
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="btn-ghost p-2" title={t('courses.deleteCourse')}>
                <Trash2 className="w-5 h-5 text-[#EF4444]" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#9CA3AF]" />
                <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
                  {t('courses.teachers')} ({detail.teachers.length})
                </h3>
              </div>
              {isTeacher && (
                <button onClick={() => openModal('teacher')} className="btn-primary text-xs py-1.5 px-3 h-auto">
                  <UserPlus className="w-3.5 h-3.5" /> {t('courses.addTeacher')}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {detail.teachers.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 px-3 bg-[#F9FAFB] rounded-lg">
                  <span className="text-sm font-medium">{t.name || t.email}</span>
                  {isTeacher && detail.teachers.length > 1 && (
                    <button onClick={() => removeTeacher(t.id)} className="text-[#9CA3AF] hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#9CA3AF]" />
                <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
                  {t('courses.students')} ({detail.students.length})
                </h3>
              </div>
              {isTeacher && (
                <button onClick={() => openModal('student')} className="btn-primary text-xs py-1.5 px-3 h-auto">
                  <UserPlus className="w-3.5 h-3.5" /> {t('courses.addStudent')}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {detail.students.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-[#F9FAFB] rounded-lg">
                  <span className="text-sm font-medium">{s.name || s.email}</span>
                  {isTeacher && (
                    <button onClick={() => removeStudent(s.id)} className="text-[#9CA3AF] hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-[#9CA3AF]" />
              <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
                {t('courses.exams')} ({detail.tests.length})
              </h3>
            </div>
            {detail.tests.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 text-[#D1D5DB] mx-auto mb-3" />
                <p className="text-[#6B7280] text-sm mb-4">{t('courses.noExams')}</p>
                {isTeacher && (
                  <Link
                    to={`/builder?courseId=${detail.id}`}
                    className="btn-primary inline-flex"
                  >
                    <Plus className="w-4 h-4" /> {t('courses.createExam')}
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {detail.tests.map((t) => (
                  <ExamCard
                    key={t.id}
                    id={t.id}
                    name={t.name}
                    number_of_questions={t.number_of_questions}
                    course_name={detail.name}
                    created_at={detail.created_at}
                    showActions={true}
                  />
                ))}
                {isTeacher && (
                  <Link
                    to={`/builder?courseId=${detail.id}`}
                    className="card p-4 md:p-5 flex flex-col items-center justify-center text-center min-h-[140px] md:min-h-[180px] border-dashed border-2 border-[#E5E7EB] hover:border-brand-300 hover:bg-brand-50/30 transition-all active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] flex items-center justify-center mb-2 md:mb-3">
                      <Plus className="w-5 h-5 text-[#6B7280]" />
                    </div>
                    <span className="text-sm font-medium text-[#6B7280]">{t('courses.newExam')}</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {addModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setAddModal(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-4 flex items-center justify-between rounded-t-2xl">
                <h3 className="font-semibold text-[#0F172A]">
                  {addModal === 'teacher' ? t('courses.addTeacher') : t('courses.addStudent')}
                </h3>
                <button onClick={() => setAddModal(null)} className="p-2 rounded-lg hover:bg-[#F3F4F6]">
                  <X className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>
              <div className="p-5">
                <div className="flex gap-2 mb-4">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doSearch(addModal)}
                    className="input flex-1"
                    placeholder={addModal === 'teacher' ? t('courses.searchTeacher') : t('courses.searchStudent')}
                    autoFocus
                  />
                  <button onClick={() => doSearch(addModal)} className="btn-primary text-sm py-2 px-4 h-auto">
                    <Search className="w-4 h-4" />
                  </button>
                </div>

                {searchLoading ? (
                  <div className="text-center py-6 text-[#9CA3AF] animate-pulse">{t('courses.searching')}</div>
                ) : searchResults.length === 0 && searchQuery ? (
                  <div className="text-center py-6 text-[#9CA3AF] text-sm">{t('courses.noUsersFound')}</div>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => addModal === 'teacher' ? addTeacher(u.id) : addStudent(u.id)}
                        className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-brand-50 transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#0F172A]">{u.name}</p>
                          <p className="text-xs text-[#9CA3AF]">{u.email}</p>
                        </div>
                        <Plus className="w-4 h-4 text-brand-600" />
                      </button>
                    ))}
                  </div>
                )}

                {!searchQuery && (
                  <p className="text-center text-sm text-[#9CA3AF] py-6">
                    Search for a {addModal} by name or email to add them to this course.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Course Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-4 flex items-center justify-between rounded-t-2xl">
                <h3 className="font-semibold text-[#0F172A]">{t('courses.editCourse')}</h3>
                <button onClick={() => setShowEditModal(false)} className="p-2 rounded-lg hover:bg-[#F3F4F6]">
                  <X className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="label">{t('courses.editCourseName')}</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input w-full"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>
              <div className="border-t border-[#E5E7EB] p-5 flex items-center gap-3">
                <button onClick={saveEdit} disabled={editingCourse || !editName.trim()} className="btn-primary flex-1">
                  <Save className="w-4 h-4" /> {editingCourse ? t('courses.removing') : t('courses.updateCourse')}
                </button>
                <button onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-6 text-center">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-semibold text-[#0F172A] text-lg mb-2">{t('courses.deleteCourse')}</h3>
                <p className="text-sm text-[#6B7280] mb-1">{t('courses.deleteCourseConfirm')}</p>
                <p className="text-xs text-[#EF4444] font-medium">{t('courses.deleteCourseWarning')}</p>
              </div>
              <div className="border-t border-[#E5E7EB] p-5 flex items-center gap-3">
                <button onClick={deleteCourse} disabled={deletingCourse} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50">
                  {deletingCourse ? t('courses.removing') : t('courses.deleteCourse')}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-[32px] font-bold text-[#0F172A]">{t('courses.title')}</h1>
          <p className="text-[#6B7280] text-sm mt-0.5">{t('courses.coursesCount', { count: courses.length })}</p>
        </div>
        {isTeacher && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
            <Plus className="w-4 h-4" />
            {t('courses.newCourse')}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card p-5 mb-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#0F172A]">{t('courses.createCourse')}</h3>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input"
            placeholder={t('courses.courseName')}
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="input"
            placeholder="Description (optional)"
          />
          <button onClick={createCourse} className="btn-primary">Create</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {courses.map((c) => (
          <div key={c.id} className="card p-5 hover:shadow-elevated transition-all active:scale-[0.98] group relative">
            <Link to={`/courses/${c.id}`} className="block">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0F172A] group-hover:text-brand-600 transition-colors">
                      {c.name}
                    </h3>
                    {c.description && (
                      <p className="text-xs text-[#9CA3AF] mt-0.5 line-clamp-1">{c.description}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.teacher_count}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.student_count}</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {c.test_count}</span>
              </div>
            </Link>
            {isTeacher && (
              <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/courses/${c.id}`); }}
                  className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#0F172A]"
                  title={t('courses.editCourse')}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {courses.length === 0 && (
          <div className="card p-8 text-center col-span-full">
            <BookOpen className="w-8 h-8 text-[#9CA3AF] mx-auto mb-3" />
            <p className="text-[#6B7280] text-sm">No courses yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
