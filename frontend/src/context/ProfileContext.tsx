'use client'

import { createContext, useContext, useCallback, useState, ReactNode } from 'react'
import { profileAPI, Profile } from '@/lib/api'

interface ProfileContextType {
  ownProfile: Profile | null
  profileLoading: boolean
  refreshOwnProfile: () => Promise<void>
  setOwnProfile: (updater: Profile | ((prev: Profile | null) => Profile | null)) => void
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [ownProfile, setOwnProfileState] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const refreshOwnProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      const res = await profileAPI.getOwnProfile()
      setOwnProfileState(res.data)
    } catch {
      // Not fatal - navbar/profile page fall back to defaults.
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const setOwnProfile = useCallback(
    (updater: Profile | ((prev: Profile | null) => Profile | null)) => {
      setOwnProfileState((prev) => (typeof updater === 'function' ? (updater as any)(prev) : updater))
    },
    []
  )

  return (
    <ProfileContext.Provider value={{ ownProfile, profileLoading, refreshOwnProfile, setOwnProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) {
    throw new Error('useProfile must be used within ProfileProvider')
  }
  return ctx
}