import { motion } from 'framer-motion'
import { CreditCard, CheckCircle, Clock } from 'lucide-react'
import { CardStats } from '@/types'
import { useLanguage } from '@/lib/i18n'

interface StatsCardsProps {
  stats: CardStats
}

const items = (stats: CardStats, isArabic: boolean) => [
  { label: isArabic ? 'إجمالي البطاقات' : 'Total Cards', value: stats.total, icon: CreditCard, color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-600/10' },
  { label: isArabic ? 'متاحة' : 'Available', value: stats.available, icon: CheckCircle, color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10' },
  { label: isArabic ? 'مستخدمة' : 'Used', value: stats.used, icon: Clock, color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
]

export default function StatsCards({ stats }: StatsCardsProps) {
  const { isArabic } = useLanguage()
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items(stats, isArabic).map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className={`${item.bg} ${item.border} border rounded-xl p-4 backdrop-blur-sm`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
            </div>
            <div className={`w-10 h-10 rounded-lg ${item.bg} ${item.border} border flex items-center justify-center`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
