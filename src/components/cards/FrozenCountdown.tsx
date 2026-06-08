import { Snowflake } from 'lucide-react'
import { useCountdown } from '@/hooks/useCountdown'

interface FrozenCountdownProps {
  frozenUntil: string
  status: string
  freezeDaysEntered?: number
}

export default function FrozenCountdown({ frozenUntil, status, freezeDaysEntered }: FrozenCountdownProps) {
  const countdown = useCountdown(status === 'frozen' && frozenUntil ? frozenUntil : null)

  if (status !== 'frozen' || !frozenUntil || countdown.expired) return null

  return (
    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4 text-center">
      <Snowflake className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
      <p className="text-xs text-gray-400">Frozen — Remaining</p>
      {freezeDaysEntered ? (
        <p className="text-xs text-gray-500 mb-1">Frozen for {freezeDaysEntered} day{freezeDaysEntered > 1 ? 's' : ''}</p>
      ) : null}
      <div className="grid grid-cols-3 gap-2 mt-2 max-w-[200px] mx-auto">
        <div className="text-center">
          <p className="text-lg font-bold text-yellow-400">{countdown.days}</p>
          <p className="text-[10px] text-gray-500">Days</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-yellow-400">{String(countdown.hours).padStart(2, '0')}</p>
          <p className="text-[10px] text-gray-500">Hours</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-yellow-400">{String(countdown.minutes).padStart(2, '0')}</p>
          <p className="text-[10px] text-gray-500">Min</p>
        </div>
      </div>
    </div>
  )
}
