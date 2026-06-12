import { useEffect, useState } from 'react'
import { useAuth, authFetch } from '../auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { User, BookOpen } from 'lucide-react'

export default function StudentProfilePage() {
  const { token, user } = useAuth()
  const { t } = useTranslation()
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    authFetch('/students/me', token)
      .then((r) => r.json())
      .then(setProfile)
      .catch(console.error)
  }, [token])

  return (
    <div>
      <h1 className="text-2xl md:text-[32px] font-bold text-[#0F172A] mb-6">{t('nav.profile')}</h1>

      <div className="card p-6 max-w-lg">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center">
            <User className="w-7 h-7 text-brand-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">{user?.name}</h2>
            <p className="text-sm text-[#6B7280]">{user?.email}</p>
            <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-md mt-1 inline-block">
              {user?.role === 'teacher' ? t('auth.teacher') : user?.role === 'student' ? t('auth.student') : user?.role}
            </span>
          </div>
        </div>

        {profile?.courses && (
          <div>
            <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
              My Courses ({profile.courses.length})
            </h3>
            <div className="space-y-2">
              {profile.courses.map((c: any) => (
                <div key={c.id} className="flex items-center gap-2 py-2 px-3 bg-[#F9FAFB] rounded-lg">
                  <BookOpen className="w-4 h-4 text-[#9CA3AF]" />
                  <span className="text-sm font-medium">{c.name || `Course #${c.id}`}</span>
                </div>
              ))}
              {profile.courses.length === 0 && (
                <p className="text-sm text-[#9CA3AF]">No courses joined yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
