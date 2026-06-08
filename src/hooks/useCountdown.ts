import { useState, useEffect } from 'react'

export function useCountdown(targetDate: string | null) {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0, totalSeconds: 0, expired: true })

  useEffect(() => {
    if (!targetDate) {
      setRemaining({ days: 0, hours: 0, minutes: 0, totalSeconds: 0, expired: true })
      return
    }

    const update = () => {
      const now = Date.now()
      const target = new Date(targetDate).getTime()
      const diff = Math.max(0, target - now)
      const totalSeconds = Math.floor(diff / 1000)
      const totalMinutes = Math.ceil(diff / 60000)
      const days = Math.max(0, Math.ceil(totalMinutes / 1440) - 1)
      const minutesAfterDays = Math.max(0, totalMinutes - days * 1440)
      const hours = Math.floor(minutesAfterDays / 60)
      const minutes = minutesAfterDays % 60
      setRemaining({ days, hours, minutes, totalSeconds, expired: totalSeconds <= 0 })
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return remaining
}
