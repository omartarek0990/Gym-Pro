import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatDate(date: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatTime(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  return `${h}:${m}`
}

export function getDaysLeft(endDate: string): number {
  if (!endDate) return 0
  const end = new Date(endDate)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / 86400000)
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'text-green-400 bg-green-500/10 border-green-500/30'
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

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'High': return 'text-red-400 bg-red-500/10 border-red-500/30'
    case 'Medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    case 'Low': return 'text-green-400 bg-green-500/10 border-green-500/30'
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }
}

export function getStockColor(stock: number): string {
  if (stock < 3) return 'text-red-400 bg-red-500/10'
  if (stock < 7) return 'text-yellow-400 bg-yellow-500/10'
  return 'text-green-400 bg-green-500/10'
}
