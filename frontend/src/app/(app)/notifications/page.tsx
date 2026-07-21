'use client'

function ComingSoon({ icon, title, blurb }: { icon: string; title: string; blurb: string }) {
  return (
    <div className="max-w-[600px] mx-auto text-center py-[80px]">
      <div className="w-[64px] h-[64px] rounded-full bg-[#EEF2FF] text-[#5B52E7] flex items-center justify-center mx-auto mb-[16px] text-[24px]">
        <i className={`fa-solid fa-${icon}`}></i>
      </div>
      <h2 className="text-[20px] font-[700] text-[#1a202c] mb-[8px]">{title}</h2>
      <p className="text-[14px] text-[#64748b]">{blurb}</p>
    </div>
  )
}

export default function NotificationsPage() {
  return <ComingSoon icon="bell" title="Notifications" blurb="You'll see likes, comments, and follows here soon." />
}