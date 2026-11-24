import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DAYS_PER_MONTH = 30

export function formatNumber(value: number, decimals = 0): string {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatCurrency(amount: number): string {
  return `${formatNumber(amount)} EGP`
}

export function getPlanDurationDays(months: number): number {
  return months * DAYS_PER_MONTH
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addMonthsToDate(dateStr: string, months: number): string {
  const date = parseLocalDate(dateStr)
  const targetDay = date.getDate()
  date.setMonth(date.getMonth() + months)
  // If the target day doesn't exist in the new month (e.g. Jan 31 → Feb), go to last day of new month
  if (date.getDate() !== targetDay) {
    date.setDate(0)
  }
  return getLocalDateString(date)
}

export function formatDate(date: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parseLocalDate(date))
}

export function formatTime(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hours = parseInt(h, 10)
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  return `${h12}:${m} ${ampm}`
}

export function getDaysLeft(endDate: string): number {
  if (!endDate) return 0
  const end = parseLocalDate(endDate)
  end.setHours(23, 59, 59, 999)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - now.getTime()) / 86400000)
}

export function getDaysBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const s = parseLocalDate(startDate)
  const e = parseLocalDate(endDate)
  return Math.round((e.getTime() - s.getTime()) / 86400000)
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'text-green-400 bg-green-500/10 border-green-500/30'
    case 'noactive': return 'text-orange-400 bg-orange-500/10 border-orange-500/30'
    case 'expired': return 'text-red-400 bg-red-500/10 border-red-500/30'
    case 'frozen': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

export function getDaysColor(days: number): string {
  if (days <= 0) return 'text-red-400'
  if (days <= 3) return 'text-red-400'
  if (days <= 7) return 'text-yellow-400'
  return 'text-green-400'
}

export function generateId(): string {
  return 'xxxxxxxxxxxx'.replace(/[x]/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  ) + Date.now().toString(36)
}

export function getStockColor(stock: number): string {
  if (stock < 3) return 'text-red-400 bg-red-500/10'
  if (stock < 7) return 'text-yellow-400 bg-yellow-500/10'
  return 'text-green-400 bg-green-500/10'
}

export function formatPhone(phone?: string): string {
  if (!phone) return ''
  const d = phone.replace(/[^0-9]/g, '')
  return `+20${d}`
}
