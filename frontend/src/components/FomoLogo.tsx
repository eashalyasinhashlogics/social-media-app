import Image from 'next/image'

export function FomoLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { 
    sm: 'h-[32px]', 
    md: 'h-[48px]', 
    lg: 'h-[64px]' 
  }

  return (
    <div className="flex items-center">
      <Image 
        src="/namelogo.png" 
        alt="FOMO Logo"
        width={200} 
        height={50}  
        className={`${sizes[size]} w-auto object-contain`}
        priority 
      />
    </div>
  )
}