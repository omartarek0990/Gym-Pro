import { motion } from 'framer-motion'
import { CreditCard } from 'lucide-react'
import { Card } from '@/types'
import { formatDate } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

interface CardsTableProps {
  cards: Card[]
  loading: boolean
}

export default function CardsTable({ cards, loading }: CardsTableProps) {
  const { t, isArabic } = useLanguage()

  if (loading) {
    return (
      <div className="space-y-2">
        {[1,2,3,4,5].map((i) => <div key={i} className="h-12 rounded-lg skeleton" />)}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#1a2d45] text-xs text-gray-400 uppercase">
            <th className="text-left p-3 font-medium">{isArabic ? 'كود البطاقة' : 'Card Code'}</th>
            <th className="text-left p-3 font-medium">{isArabic ? 'الحالة' : 'Status'}</th>
            <th className="text-left p-3 font-medium">{isArabic ? 'تاريخ الإنشاء' : 'Created At'}</th>
            <th className="text-left p-3 font-medium">{isArabic ? 'تاريخ التخصيص' : 'Assigned At'}</th>
            <th className="text-left p-3 font-medium">{isArabic ? 'اسم العضو' : 'Member Name'}</th>
            <th className="text-left p-3 font-medium">{isArabic ? 'هاتف العضو' : 'Member Phone'}</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card, i) => (
            <motion.tr
              key={card.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="border-b border-[#1a2d45]/50 hover:bg-yellow-600/5 transition-colors"
            >
              <td className="p-3 text-sm text-white font-mono">{card.card_code}</td>
              <td className="p-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  card.status === 'available'
                    ? 'text-green-400 bg-green-500/10 border border-green-500/30'
                    : 'text-orange-400 bg-orange-500/10 border border-orange-500/30'
                }`}>
                  {card.status === 'available' ? t('cards.available') : card.status === 'used' ? t('cards.used') : card.status}
                </span>
              </td>
              <td className="p-3 text-sm text-gray-400">{formatDate(card.created_at)}</td>
              <td className="p-3 text-sm text-gray-400">{card.assigned_at ? formatDate(card.assigned_at) : '—'}</td>
              <td className="p-3 text-sm text-gray-300">{card.member_name || '—'}</td>
              <td className="p-3 text-sm text-gray-300">{card.member_phone || '—'}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      {cards.length === 0 && (
        <div className="text-center py-12">
          <CreditCard className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400">{isArabic ? 'لا توجد بطاقات' : 'No cards found'}</p>
        </div>
      )}
    </div>
  )
}
