'use client'

import { useAuthUser } from '@/components/auth/AuthUserContext'

export default function MasterAccessNotice() {
  const { user, canManageMasters } = useAuthUser()
  if (!user || canManageMasters) return null

  return (
    <div className="container mx-auto px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Read-only access: an administrator is required to add, edit, activate, or deactivate Master records.
      </div>
    </div>
  )
}
