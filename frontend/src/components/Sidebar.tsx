import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  ScanSearch,
  BarChart3,
  Settings,
  GraduationCap,
} from 'lucide-react'

const navGroups = [
  {
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/builder', icon: PlusCircle, label: 'New Test' },
      { to: '/auto-detect', icon: ScanSearch, label: 'Auto Grade' },
    ],
  },
]

export default function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-white border-r border-[#E5E7EB] flex flex-col z-30">
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-[#E5E7EB] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-[15px] text-[#0F172A]">LiveTest</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-[#6B7280] hover:text-[#0F172A] hover:bg-[#F9FAFB]'
                  }`
                }
              >
                <item.icon className={`w-4 h-4 shrink-0`} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-[#E5E7EB]">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-[#6B7280] hover:text-[#0F172A] hover:bg-[#F9FAFB]'
            }`
          }
        >
          <Settings className="w-4 h-4 shrink-0" />
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
