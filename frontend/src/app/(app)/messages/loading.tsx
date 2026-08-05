export default function MessagesLoading() {
  return (
    <div className="max-w-[640px] mx-auto py-[24px] flex flex-col gap-[10px]" aria-busy="true" aria-label="Loading conversations">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-[12px] p-[12px] rounded-[12px] animate-pulse">
          <div className="w-[44px] h-[44px] rounded-full bg-[#f1f5f9] flex-shrink-0" />
          <div className="flex-1">
            <div className="h-[10px] w-[140px] bg-[#f1f5f9] rounded-[4px] mb-[6px]" />
            <div className="h-[8px] w-[200px] bg-[#f1f5f9] rounded-[4px]" />
          </div>
        </div>
      ))}
    </div>
  )
}
