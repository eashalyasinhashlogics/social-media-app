'use client'

import { useRef, useState } from 'react'
import { postsAPI, mediaAPI, Post } from '@/lib/api'
import { Button } from '@/components/ui/index'

export function CreatePostForm({ onCreated }: { onCreated: (post: Post) => void }) {
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      // the backend requires the post to exist before media can be attached
      const postRes = await postsAPI.create(content.trim())
      let finalPost = postRes.data

      if (imageFile) {
        try {
          const mediaRes = await mediaAPI.uploadPostMedia(finalPost.id, imageFile)
          finalPost = { ...finalPost, media_url: mediaRes.data.url, media_type: mediaRes.data.media_type }
        } catch (mediaErr: any) {
          // post itself succeeded — surface the media failure but don't lose the post
          setError(mediaErr.response?.data?.detail || 'Post created, but image upload failed')
        }
      }

      onCreated(finalPost)
      setContent('')
      clearImage()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create post')
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

      {imagePreview && (
        <div className="relative mb-[12px] inline-block">
          <img src={imagePreview} className="max-h-[200px] rounded-[8px] border border-[#e2e8f0]" />
          <button
            type="button"
            onClick={clearImage}
            className="absolute top-[-8px] right-[-8px] w-[24px] h-[24px] rounded-full bg-[#1a202c] text-white text-[12px] border-none cursor-pointer flex items-center justify-center"
            aria-label="Remove image"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[#6366f1] text-[13px] font-[600] bg-transparent border-none cursor-pointer flex items-center gap-[6px]"
        >
          <i className="fa-regular fa-image"></i>
          <span>{imageFile ? 'Change image' : 'Add image'}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImageSelected}
          className="hidden"
        />
        <Button type="submit" disabled={isSubmitting || !content.trim()}>
          {isSubmitting ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </form>
  )
}