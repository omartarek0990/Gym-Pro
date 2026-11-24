import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import AnimatedCounter from './AnimatedCounter'

interface StatCardProps {
  title: string
  value: number
  icon: LucideIcon
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  prefix?: string
  suffix?: string
  decimals?: number
  subtitle?: string
  index?: number
}

const colorMap = {
  blue: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  prefix = '',
  suffix = '',
  decimals = 0,
  subtitle,
  index = 0,
}: StatCardProps) {
  const c = colorMap[color]

  return (
    <div
      className={cn(
        'rounded-xl border p-5 glass-card',
        c.border
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-muted-foreground font-medium">{title}</span>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', c.bg)}>
          <Icon className={cn('w-5 h-5', c.text)} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  )
}
