import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { invoke } from '@/lib/tauri'

interface User {
  id: string
  username: string
  role: 'owner' | 'admin'
}

export interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  isOwner: () => boolean
  isAdmin: () => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const login = useCallback(async (username: string, password: string) => {
    try {
      const result = await invoke('login_user', { username, password }) as User
      setUser(result)
      return true
    } catch {
      return false
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  const isOwner = useCallback(() => user?.role === 'owner', [user])
  const isAdmin = useCallback(() => user?.role === 'admin', [user])

  return (
    <AuthContext.Provider value={{ user, login, logout, isOwner, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
