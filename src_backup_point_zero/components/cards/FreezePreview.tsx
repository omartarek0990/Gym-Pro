interface FreezePreviewProps {
  days: number
}

export default function FreezePreview({ days }: FreezePreviewProps) {
  if (days <= 0) return null

  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      <div className="p-2 rounded-lg bg-white/5 border border-[#1a2d45]">
        <p className="text-lg font-bold text-yellow-400">{days}</p>
        <p className="text-xs text-gray-400">Days</p>
      </div>
      <div className="p-2 rounded-lg bg-white/5 border border-[#1a2d45]">
        <p className="text-lg font-bold text-yellow-400">00</p>
        <p className="text-xs text-gray-400">Hours</p>
      </div>
      <div className="p-2 rounded-lg bg-white/5 border border-[#1a2d45]">
        <p className="text-lg font-bold text-yellow-400">00</p>
        <p className="text-xs text-gray-400">Min</p>
      </div>
      <div className="p-2 rounded-lg bg-white/5 border border-[#1a2d45]">
        <p className="text-lg font-bold text-yellow-400">00</p>
        <p className="text-xs text-gray-400">Sec</p>
      </div>
    </div>
  )
}