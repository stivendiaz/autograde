import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  PlusCircle,
  ScanSearch,
  Settings,
  GraduationCap,
  Clock,
  BookOpen,
  User,
  BarChart3,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useTranslation } from 'react-i18next'

const teacherNavKeys = [
  { to: '/', icon: LayoutDashboard, key: 'nav.home' },
  { to: '/courses', icon: BookOpen, key: 'nav.courses' },
  { to: '/builder', icon: PlusCircle, key: 'nav.create' },
  { to: '/auto-detect', icon: ScanSearch, key: 'nav.grade' },
]

const studentNavKeys = [
  { to: '/', icon: LayoutDashboard, key: 'nav.home' },
  { to: '/courses', icon: BookOpen, key: 'nav.courses' },
]

const teacherSidebarKeys = [
  { to: '/', icon: LayoutDashboard, key: 'nav.dashboard', end: true },
  { to: '/courses', icon: BookOpen, key: 'nav.courses' },
  { to: '/builder', icon: PlusCircle, key: 'nav.newTest' },
  { to: '/auto-detect', icon: ScanSearch, key: 'nav.autoGrade' },
  { to: '/history', icon: Clock, key: 'nav.history' },
]

const studentSidebarKeys = [
  { to: '/', icon: LayoutDashboard, key: 'nav.dashboard', end: true },
  { to: '/courses', icon: BookOpen, key: 'nav.courses' },
  { to: '/grades', icon: BarChart3, key: 'nav.myGrades' },
  { to: '/history', icon: Clock, key: 'nav.history' },
  { to: '/profile', icon: User, key: 'nav.profile' },
]

export default function BottomNav() {
  const location = useLocation()
  const { isTeacher } = useAuth()
  const { t } = useTranslation()
  const items = isTeacher ? teacherNavKeys : studentNavKeys

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-30 safe-bottom md:hidden">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const active =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] h-full px-2 transition-colors ${
                active ? 'text-brand-600' : 'text-[#9CA3AF]'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t(item.key)}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export function Sidebar() {
  const { isTeacher } = useAuth()
  const { t } = useTranslation()
  const items = isTeacher ? teacherSidebarKeys : studentSidebarKeys

  return (
    <aside className="hidden md:flex fixed top-0 left-0 h-full w-60 bg-white border-r border-[#E5E7EB] flex-col z-30">
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-[#E5E7EB] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-[15px] text-[#0F172A]">LiveTest</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-[#6B7280] hover:text-[#0F172A] hover:bg-[#F9FAFB]'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {t(item.key)}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-[#E5E7EB]">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive ? 'bg-brand-50 text-brand-700' : 'text-[#6B7280] hover:text-[#0F172A] hover:bg-[#F9FAFB]'
            }`
          }
        >
          <Settings className="w-4 h-4 shrink-0" />
          {t('nav.settings')}
        </NavLink>
      </div>
    </aside>
  )
}
