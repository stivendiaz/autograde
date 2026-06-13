import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface User {
  id: number
  name: string
  email: string
  role: 'teacher' | 'student'
}

interface AuthState {
  token: string | null
  user: User | null
  login: (token: string, user: User) => void
  logout: () => void
  isAuth: boolean
  isTeacher: boolean
  isStudent: boolean
}

const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  login: () => {},
  logout: () => {},
  isAuth: false,
  isTeacher: false,
  isStudent: false,
})

function loadAuth(): { token: string | null; user: User | null } {
  try {
    const saved = localStorage.getItem('auth')
    if (saved) {
      const { token, user } = JSON.parse(saved)
      return { token, user }
    }
  } catch {}
  return { token: null, user: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState(loadAuth)

  const login = (t: string, u: User) => {
    setAuth({ token: t, user: u })
    localStorage.setItem('auth', JSON.stringify({ token: t, user: u }))
  }

  const logout = () => {
    setAuth({ token: null, user: null })
    localStorage.removeItem('auth')
  }

  const { token, user } = auth

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        logout,
        isAuth: !!token && !!user,
        isTeacher: user?.role === 'teacher',
        isStudent: user?.role === 'student',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function authFetch(path: string, token: string | null, options?: RequestInit) {
  const headers: Record<string, string> = {}
  if (options?.body instanceof FormData) {
    // don't set Content-Type for FormData
  } else {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const base = import.meta.env.VITE_API_URL || '/api'
  return fetch(`${base}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  })
}
