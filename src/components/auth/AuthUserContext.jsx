'use client'

import { createContext, useContext } from 'react'

const AuthUserContext = createContext(null)

export function AuthUserProvider({ user, children }) {
  return (
    <AuthUserContext.Provider value={user || null}>
      {children}
    </AuthUserContext.Provider>
  )
}

export function useAuthUser() {
  const user = useContext(AuthUserContext)
  return {
    user,
    canManageMasters: user?.role === 'ADMIN'
  }
}
