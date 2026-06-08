import { motion } from 'framer-motion'
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
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', glow: 'rgba(59,130,246,0.15)' },
  green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', glow: 'rgba(16,185,129,0.15)' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', glow: 'rgba(245,158,11,0.15)' },
  red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', glow: 'rgba(239,68,68,0.15)' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', glow: 'rgba(168,85,247,0.15)' },
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      whileHover={{ y: -2 }}
      className={cn(
        'rounded-xl border p-5 glass-card transition-all duration-300',
        c.border
      )}
      style={{ boxShadow: `0 0 30px ${c.glow}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-gray-400 font-medium">{title}</span>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', c.bg)}>
          <Icon className={cn('w-5 h-5', c.text)} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
    </motion.div>
  )
}
