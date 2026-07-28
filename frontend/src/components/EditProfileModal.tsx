'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { profileAPI, mediaAPI, Profile, extractErrorMessage, resolveMediaUrl } from '@/lib/api'

const MAX_AVATAR_MB = 5
const MAX_COVER_MB = 8
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif'

interface EditProfileModalProps {
  profile: Profile
  onClose: () => void
  onSaved: (profile: Profile) => void
}

// Inline styles for the overlay/panel positioning only - kept out of
// Tailwind classes so this modal renders correctly even if the JIT
// compiler hasn't picked up this file (new files sometimes get missed
// by the dev-server watcher, especially on Windows).
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: 16,
}

const panelStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 16,
  width: '100%',
  maxWidth: 440,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
}

export function EditProfileModal({ profile, onClose, onSaved }: EditProfileModalProps) {
  const [username, setUsername] = useState(profile.username)
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [bio, setBio] = useState(profile.bio || '')

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarRemoved, setAvatarRemoved] = useState(false)

  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setError(`Avatar must be under ${MAX_AVATAR_MB}MB`)
      return
    }
    setError(null)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarRemoved(false)
  }

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_COVER_MB * 1024 * 1024) {
      setError(`Cover photo must be under ${MAX_COVER_MB}MB`)
      return
    }
    setError(null)
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    setCoverRemoved(false)
  }

  const handleRemoveAvatar = (e: React.MouseEvent) => {
    e.stopPropagation()
    setAvatarFile(null)
    setAvatarPreview(null)
    setAvatarRemoved(true)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  const handleRemoveCover = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCoverFile(null)
    setCoverPreview(null)
    setCoverRemoved(true)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Username cannot be empty')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (avatarFile) {
        await mediaAPI.uploadAvatar(avatarFile)
      } else if (avatarRemoved) {
        await mediaAPI.removeAvatar()
      }

      if (coverFile) {
        await mediaAPI.uploadCoverPhoto(coverFile)
      } else if (coverRemoved) {
        await mediaAPI.removeCoverPhoto()
      }

      const payload: Record<string, string> = {}
      if (username.trim() !== profile.username) payload.username = username.trim()
      if (displayName !== (profile.display_name || '')) payload.display_name = displayName
      if (bio !== (profile.bio || '')) payload.bio = bio

      const res = Object.keys(payload).length > 0
        ? await profileAPI.updateProfile(payload)
        : await profileAPI.getOwnProfile()

      onSaved(res.data)
      onClose()
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to save profile'))
    } finally {
      setSaving(false)
    }
  }

  // Effective sources factor in a pending removal even before Save is
  // clicked, so the modal previews what the profile will look like.
  const effectiveCoverUrl = coverRemoved ? null : (coverPreview || resolveMediaUrl(profile.cover_photo_url) || null)
  const effectiveAvatarUrl = avatarRemoved ? null : (avatarPreview || resolveMediaUrl(profile.avatar_url) || null)

  const hasCoverToRemove = !!coverFile || (!!profile.cover_photo_url && !coverRemoved)
  const hasAvatarToRemove = !!avatarFile || (!!profile.avatar_url && !avatarRemoved)

  const modal = (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-[20px] py-[16px] border-b border-[#f1f5f9]">
          <h2 className="text-[16px] font-[700] text-[#1a202c]">Edit profile</h2>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#374151] bg-transparent border-none cursor-pointer text-[16px]"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="relative">
          <div
            className="h-[120px] bg-[linear-gradient(135deg,#6366f1,#4f46e5)] bg-cover bg-center cursor-pointer"
            style={effectiveCoverUrl ? { backgroundImage: `url(${effectiveCoverUrl})` } : undefined}
            onClick={() => coverInputRef.current?.click()}
          >
            <div className="w-full h-full flex items-center justify-center gap-[14px] bg-black/20 hover:bg-black/35 transition-colors duration-150">
              <span className="text-white text-[12px] font-[600] flex items-center gap-[6px]">
                <i className="fa-solid fa-camera"></i> Change cover
              </span>
              {hasCoverToRemove && (
                <button
                  onClick={handleRemoveCover}
                  className="text-white text-[12px] font-[600] flex items-center gap-[6px] bg-transparent border-none cursor-pointer underline"
                >
                  <i className="fa-solid fa-trash"></i> Remove
                </button>
              )}
            </div>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            className="hidden"
            onChange={handleCoverSelect}
          />

          <div
            className="absolute left-[20px] bottom-[-28px] cursor-pointer"
            onClick={() => avatarInputRef.current?.click()}
          >
            <div className="relative w-[64px] h-[64px]">
              <img
                src={effectiveAvatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.username}`}
                className="w-[64px] h-[64px] rounded-full object-cover border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
                alt="Avatar"
              />
              <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                <i className="fa-solid fa-camera text-white text-[13px]"></i>
              </div>
              {hasAvatarToRemove && (
                <button
                  onClick={handleRemoveAvatar}
                  className="absolute -right-[4px] -bottom-[4px] w-[20px] h-[20px] rounded-full bg-white border border-[#e2e8f0] shadow-[0_1px_3px_rgba(0,0,0,0.15)] flex items-center justify-center text-[#ef4444] text-[10px] cursor-pointer"
                  aria-label="Remove avatar"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              )}
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            className="hidden"
            onChange={handleAvatarSelect}
          />
        </div>

        <div className="px-[20px] pt-[40px] pb-[20px] flex flex-col gap-[14px]">
          {error && (
            <div className="py-[8px] px-[10px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[12px]">
              {error}
            </div>
          )}

          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px] font-[600] text-[#374151]">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={100}
              className="border border-[#e2e8f0] rounded-[8px] px-[12px] py-[8px] text-[14px] outline-none focus:border-[#6366f1]"
            />
          </label>

          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px] font-[600] text-[#374151]">Name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={150}
              placeholder="Add a display name"
              className="border border-[#e2e8f0] rounded-[8px] px-[12px] py-[8px] text-[14px] outline-none focus:border-[#6366f1]"
            />
          </label>

          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px] font-[600] text-[#374151]">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Tell people about yourself"
              className="border border-[#e2e8f0] rounded-[8px] px-[12px] py-[8px] text-[14px] outline-none focus:border-[#6366f1] resize-none"
            />
          </label>

          <div className="flex gap-[10px] mt-[6px]">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-[10px] text-[14px] font-[600] text-[#ffffff] disabled:text-[#ffffff] bg-[#5B52E7] hover:bg-[#4C43D4] border-none rounded-[8px] cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-[10px] text-[14px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // Portal to document.body so this can never get clipped/mispositioned
  // by an ancestor's overflow/transform (e.g. the (app)/layout.tsx <main>).
  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}