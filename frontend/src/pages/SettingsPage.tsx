import { useTranslation } from 'react-i18next'
import { Settings as SettingsIcon, Globe } from 'lucide-react'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl md:text-[32px] font-bold text-[#0F172A] mb-6">
        <SettingsIcon className="w-6 h-6 inline mr-2" />
        {t('settings.title')}
      </h1>

      <div className="card p-6 max-w-lg">
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
    </div>
  )
}
