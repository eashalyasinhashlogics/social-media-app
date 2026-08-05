export default function FeedLoading() {
  return (
    <div className="max-w-[600px] mx-auto py-[24px] flex flex-col gap-[16px]" aria-busy="true" aria-label="Loading feed">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white border border-[#f1f5f9] rounded-[14px] p-[16px] animate-pulse">
          <div className="flex items-center gap-[10px] mb-[12px]">
            <div className="w-[36px] h-[36px] rounded-full bg-[#f1f5f9]" />
            <div className="flex-1">
              <div className="h-[10px] w-[120px] bg-[#f1f5f9] rounded-[4px] mb-[6px]" />
              <div className="h-[8px] w-[70px] bg-[#f1f5f9] rounded-[4px]" />
            </div>
          </div>
          <div className="h-[10px] w-full bg-[#f1f5f9] rounded-[4px] mb-[6px]" />
          <div className="h-[10px] w-3/4 bg-[#f1f5f9] rounded-[4px]" />
        </div>
      ))}
    </div>
  )
}
