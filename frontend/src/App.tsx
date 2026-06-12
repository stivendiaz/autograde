import { Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthProvider, useAuth } from './auth/AuthContext'
import BottomNav, { Sidebar } from './components/Navigation'
import TestListPage from './pages/TestListPage'
import TestBuilderPage from './pages/TestBuilderPage'
import TestDetailPage from './pages/TestDetailPage'
import GradeSheetPage from './pages/GradeSheetPage'
import AutoDetectPage from './pages/AutoDetectPage'
import GradingHistoryPage from './pages/GradingHistoryPage'
import GradingProofPage from './pages/GradingProofPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CoursesPage from './pages/CoursesPage'
import StudentGradesPage from './pages/StudentGradesPage'
import StudentProfilePage from './pages/StudentProfilePage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuth } = useAuth()
  if (!isAuth) return <Navigate to="/login" replace />
  return <>{children}</>
}

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { isTeacher, isAuth } = useAuth()
  if (!isAuth) return <Navigate to="/login" replace />
  if (!isTeacher) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppShell() {
  const { isAuth, isTeacher, isStudent, logout } = useAuth()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex flex-col">
      <Sidebar />
      <div className="flex-1 md:ml-60">
        <header className="hidden md:flex sticky top-0 z-20 h-14 bg-white border-b border-[#E5E7EB] items-center justify-between px-8">
          <div className="flex-1" />
          {isAuth && (
            <button onClick={logout} className="text-sm text-[#6B7280] hover:text-[#0F172A] transition-colors">
              {t('nav.signOut')}
            </button>
          )}
        </header>
        <main className="p-4 md:p-8 pb-20 md:pb-8 max-w-full md:max-w-6xl">
          <Routes>
            <Route path="/" element={<ProtectedRoute><TestListPage /></ProtectedRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/builder" element={<TeacherRoute><TestBuilderPage /></TeacherRoute>} />
            <Route path="/tests/:testId" element={<ProtectedRoute><TestDetailPage /></ProtectedRoute>} />
            <Route path="/tests/:testId/grade" element={<TeacherRoute><GradeSheetPage /></TeacherRoute>} />
            <Route path="/auto-detect" element={<TeacherRoute><AutoDetectPage /></TeacherRoute>} />
            <Route path="/history" element={<ProtectedRoute><GradingHistoryPage /></ProtectedRoute>} />
            <Route path="/history/:historyId" element={<ProtectedRoute><GradingProofPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
            <Route path="/courses/:courseId" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
            {isStudent && (
              <>
                <Route path="/grades" element={<StudentGradesPage />} />
                <Route path="/profile" element={<StudentProfilePage />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      {isAuth && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
