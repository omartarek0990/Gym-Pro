import { useState, useEffect, useRef } from 'react'
import { invoke } from '@/lib/tauri'
import JsBarcode from 'jsbarcode'

interface BarcodeCardProps {
  cardCode: string
  gymName?: string
}

export default function BarcodeCard({ cardCode, gymName: propGymName }: BarcodeCardProps) {
  const [gymName, setGymName] = useState(propGymName || 'My Gym')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (propGymName) return
    invoke('get_settings').then((s: any) => {
      const arr = (s || []) as { key: string; value: string }[]
      const found = arr.find((x: any) => x.key === 'gym_name')
      if (found) setGymName(found.value)
    }).catch(() => {})
  }, [propGymName])

  useEffect(() => {
    if (!canvasRef.current || !cardCode) return
    try {
      JsBarcode(canvasRef.current, cardCode, {
        format: 'CODE128',
        width: 2,
        height: 55,
        displayValue: false,
        background: '#ffffff',
        lineColor: '#000000',
        margin: 4,
      })
    } catch {}
  }, [cardCode])

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0a0a0a] border-l-4 border-[#F59E0B] shadow-[0_0_20px_rgba(245,158,11,0.13)] mb-4">
      <div className="absolute top-0 right-0 w-12 h-12" style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(245,158,11,0.08) 100%)' }} />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]" />
          <span className="text-sm font-bold uppercase tracking-wider text-[#F59E0B]">{gymName}</span>
        </div>
        <div className="h-px bg-[#1f1f1f]" />
        <div className="bg-white rounded-xl p-2 max-w-[240px] w-full mx-auto flex justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
          <canvas ref={canvasRef} className="max-w-full h-auto" />
        </div>
        <p className="text-center font-mono font-bold tracking-wider text-sm text-[#F59E0B]">{cardCode}</p>
        <div className="flex justify-end gap-1 pr-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] opacity-40" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] opacity-40" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] opacity-40" />
        </div>
      </div>
    </div>
  )
}