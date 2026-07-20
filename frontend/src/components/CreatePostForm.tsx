'use client'

import { useState, useRef } from 'react'
import { postsAPI, mediaAPI, Post, extractErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/index'

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif,video/mp4'
const MAX_IMAGE_MB = 5
const MAX_VIDEO_MB = 25

export function CreatePostForm({ onCreated }: { onCreated: (post: Post) => void }) {
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    const isVideo = selected.type.startsWith('video/')
    const maxBytes = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024
    if (selected.size > maxBytes) {
      setError(`File too large. Max ${isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB} MB for ${isVideo ? 'videos' : 'images'}.`)
      return
    }
    setError(null)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const clearFile = () => {
    setFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !file) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await postsAPI.create(content.trim())
      let finalPost = res.data

      if (file) {
        try {
          await mediaAPI.uploadPostMedia(finalPost.id, file)
          const refreshed = await postsAPI.get(finalPost.id)
          finalPost = refreshed.data
        } catch (mediaErr: any) {
          setError(extractErrorMessage(mediaErr, 'Post created, but the attachment failed to upload'))
        }
      }

      onCreated(finalPost)
      setContent('')
      clearFile()
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to create post'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#e2e8f0] rounded-[16px] p-[20px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] mb-[24px]">
      {error && (
        <div className="py-[10px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[13px] font-[500] mb-[12px]">
          {error}
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        rows={3}
        maxLength={10000}
        className="w-full resize-none border border-[#e2e8f0] rounded-[8px] p-[12px] text-[14px] outline-none transition-all focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] mb-[12px]"
      />
      {previewUrl && (
        <div className="relative mb-[12px] inline-block">
          {file?.type.startsWith('video/') ? (
            <video src={previewUrl} controls className="max-h-[220px] rounded-[10px] border border-[#e2e8f0]" />
          ) : (
            <img src={previewUrl} alt="Selected attachment preview" className="max-h-[220px] rounded-[10px] border border-[#e2e8f0]" />
          )}
          <button type="button" onClick={clearFile} className="absolute top-[6px] right-[6px] bg-[rgba(0,0,0,0.6)] text-white w-[24px] h-[24px] rounded-full border-none cursor-pointer text-[14px]">✕</button>
        </div>
      )}
      <div className="flex justify-between items-center">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-[6px] text-[13px] font-[600] text-[#6366f1] bg-transparent border-none cursor-pointer">
          <i className="fa-regular fa-image"></i> Add photo/video
        </button>
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleFileSelect} className="hidden" />
        <Button type="submit" disabled={isSubmitting || (!content.trim() && !file)}>
          {isSubmitting ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </form>
  )
}