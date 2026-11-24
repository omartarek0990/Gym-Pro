import { formatNumber } from '@/lib/utils'

interface AnimatedCounterProps {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
}

export default function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
}: AnimatedCounterProps) {
  return (
    <span className="text-2xl font-bold text-foreground tabular-nums">
      {prefix}{formatNumber(value, decimals)}{suffix}
    </span>
  )
}
