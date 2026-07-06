import Image from 'next/image'

export function FomoLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { 
    sm: 'h-8', 
    md: 'h-12', 
    lg: 'h-16' 
  }

  return (
    <div className="flex items-center">
      <Image 
        src="/namelogo.png" 
        alt="FOMO Logo"
        width={200} // Provide a base aspect ratio width
        height={50}  // Provide a base aspect ratio height
        className={`${sizes[size]} w-auto object-contain`}
        priority // Ensures the logo loads instantly as a critical LCP element
      />
    </div>
  )
}