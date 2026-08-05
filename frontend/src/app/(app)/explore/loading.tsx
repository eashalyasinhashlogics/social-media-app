export default function ExploreLoading() {
  return (
    <div className="max-w-[600px] mx-auto py-[24px] grid grid-cols-2 gap-[12px]" aria-busy="true" aria-label="Loading explore">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="p-[14px] rounded-[12px] border border-[#f1f5f9] animate-pulse">
          <div className="w-[48px] h-[48px] rounded-full bg-[#f1f5f9] mx-auto mb-[10px]" />
          <div className="h-[10px] w-2/3 mx-auto bg-[#f1f5f9] rounded-[4px]" />
        </div>
      ))}
    </div>
  )
}
