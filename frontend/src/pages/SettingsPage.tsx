import { useTranslation } from 'react-i18next'
import { Settings as SettingsIcon, Globe, LogOut, User } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <div>
      <h1 className="text-2xl md:text-[32px] font-bold text-[#0F172A] mb-6">
        <SettingsIcon className="w-6 h-6 inline mr-2" />
        {t('settings.title')}
      </h1>

      <div className="space-y-4 max-w-lg">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
              <User className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{user?.name}</p>
              <p className="text-xs text-[#6B7280]">{user?.email}</p>
            </div>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            {user?.role === 'teacher' ? t('auth.teacher') : t('auth.student')}
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-brand-600" />
            <h2 className="text-sm font-semibold text-[#0F172A]">{t('settings.language')}</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { i18n.changeLanguage('es'); localStorage.setItem('app_language', 'es') }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                i18n.language === 'es'
                  ? 'bg-brand-50 text-brand-700 border-brand-200'
                  : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
              }`}
            >
              {t('settings.spanish')}
            </button>
            <button
              onClick={() => { i18n.changeLanguage('en'); localStorage.setItem('app_language', 'en') }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                i18n.language === 'en'
                  ? 'bg-brand-50 text-brand-700 border-brand-200'
                  : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
              }`}
            >
              {t('settings.english')}
            </button>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full card p-4 flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">{t('nav.signOut')}</span>
        </button>
      </div>
    </div>
  )
}