export default function FriendsLoading() {
  return (
    <div className="max-w-[600px] mx-auto py-[24px] flex flex-col gap-[10px]" aria-busy="true" aria-label="Loading friends">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-[12px] p-[12px] rounded-[12px] animate-pulse">
          <div className="w-[40px] h-[40px] rounded-full bg-[#f1f5f9] flex-shrink-0" />
          <div className="flex-1">
            <div className="h-[10px] w-[130px] bg-[#f1f5f9] rounded-[4px]" />
          </div>
          <div className="h-[28px] w-[90px] bg-[#f1f5f9] rounded-[8px]" />
        </div>
      ))}
    </div>
  )
}
