import { useRef, useEffect } from 'react'
import JsBarcode from 'jsbarcode'
import type { Member } from '@/types'

interface Props {
  member: Member
  planName: string
}

function formatDateDDMMYYYY(date: string): string {
  if (!date) return '-- / -- / ----'
  const d = new Date(date)
  return `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`
}

function formatCardPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return '1145613156'
  const local = digits.startsWith('20') ? digits.slice(2) : digits
  return local.startsWith('0') ? local.slice(1) : local
}

function barcodeLabel(code: string): string {
  return code || 'MX-0247-2026-0001'
}

export default function MemberCardTemplate({ member, planName }: Props) {
  const barcodeRef = useRef<HTMLCanvasElement>(null)
  const displayPhone = formatCardPhone(member.phone || '')
  const displayPlan = (planName || member.plan_name || 'Gold Member').toUpperCase()
  const displayId = member.card_code || 'MRX-00247'
  const displayCode = member.card_code || 'MRX-2026-0247'
  const planBadgeWidth = Math.max(93, displayPlan.length * 8 + 49)

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, barcodeLabel(displayCode), {
          format: 'CODE128',
          width: 1.45,
          height: 108,
          displayValue: false,
          background: '#ffffff',
          lineColor: '#000000',
          margin: 0,
        })
      } catch {}
    }
  }, [displayCode])

  return (
    <div style={{
      width: '600px',
      height: '378px',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #050a22 0%, #07124a 32%, #102a96 72%, #050b25 100%)',
      boxSizing: 'border-box',
      fontFamily: 'Inter, Arial, sans-serif',
      borderRadius: '5px',
      border: '1px solid rgba(61, 126, 255, 0.95)',
      color: '#ffffff',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 80px)', opacity: 0.55 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(430px 230px at 20% 35%, rgba(52, 112, 255, 0.34), transparent 62%)' }} />
      <div style={{ position: 'absolute', inset: '5px', borderRadius: '3px', border: '1px solid rgba(68, 140, 255, 0.65)' }} />
      <div style={{ position: 'absolute', left: '5px', top: '5px', width: '14px', height: '14px', borderTop: '2px solid #3985ff', borderLeft: '2px solid #3985ff', borderTopLeftRadius: '4px' }} />
      <div style={{ position: 'absolute', right: '5px', top: '5px', width: '14px', height: '14px', borderTop: '2px solid #3985ff', borderRight: '2px solid #3985ff', borderTopRightRadius: '4px' }} />
      <div style={{ position: 'absolute', left: '5px', bottom: '5px', width: '14px', height: '14px', borderBottom: '2px solid #3985ff', borderLeft: '2px solid #3985ff', borderBottomLeftRadius: '4px' }} />
      <div style={{ position: 'absolute', right: '5px', bottom: '5px', width: '14px', height: '14px', borderBottom: '2px solid #3985ff', borderRight: '2px solid #3985ff', borderBottomRightRadius: '4px' }} />

      <div style={{ position: 'absolute', top: '25px', left: '31px', width: '125px', height: '45px', zIndex: 2 }}>
        <img src="/photo.png" alt="MR.X GYM" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 0 9px rgba(165,216,255,0.95))' }} />
      </div>

      <div style={{
        position: 'absolute', top: '83px', left: '20px',
        width: '135px', height: '170px',
        borderRadius: '6px',
        background: member.photo ? '#dce4f2' : '#dfe6f3',
        border: '2px solid #84aefa',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 7px rgba(99, 153, 255, 0.9)',
        zIndex: 2,
      }}>
        {member.photo ? (
          <img src={member.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="21" r="11" fill="#b3b8c2" />
              <path d="M16 39 H48 L39 55 Q32 63 25 55 Z" fill="#b3b8c2" />
            </svg>
            <div style={{ color: '#808080', fontSize: '12px', letterSpacing: '0.9px', marginTop: '8px' }}>PHOTO</div>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', left: '171px', top: '84px', width: '300px', zIndex: 2 }}>
        <div style={{ color: '#5e9bff', fontSize: '7px', fontWeight: 800, letterSpacing: '0.7px', marginBottom: '4px' }}>MEMBER NAME</div>
        <div style={{ color: '#fff', fontSize: '17px', fontWeight: 800, lineHeight: 1.1, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{member.name || 'II'}</div>
      </div>

      <div style={{ position: 'absolute', left: '240px', top: '115px', width: '335px', height: '1px', background: 'linear-gradient(90deg, rgba(73,116,219,0.42), transparent)' }} />

      <div style={{ position: 'absolute', left: '171px', top: '121px', zIndex: 2 }}>
        <div style={{ color: '#5e9bff', fontSize: '7px', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '4px' }}>MEMBER ID</div>
        <div style={{ color: '#cbd8ff', fontSize: '10px', fontWeight: 800, letterSpacing: '0' }}>{displayId}</div>
      </div>

      <div style={{ position: 'absolute', left: '381px', top: '121px', zIndex: 2 }}>
        <div style={{ color: '#5e9bff', fontSize: '7px', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '4px' }}>PHONE</div>
        <div style={{ color: '#cbd8ff', fontSize: '10px', fontWeight: 800, letterSpacing: '0' }}>{displayPhone}</div>
      </div>

      <div style={{ position: 'absolute', left: '171px', top: '147px', zIndex: 2 }}>
        <div style={{ color: '#5e9bff', fontSize: '7px', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '4px' }}>PLAN</div>
        <svg width={planBadgeWidth} height="18" viewBox={`0 0 ${planBadgeWidth} 18`} style={{ display: 'block', filter: 'drop-shadow(0 0 4px rgba(27,102,255,0.35))' }}>
          <defs>
            <linearGradient id="planBadgeGradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#2e73ff" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#173dad" stopOpacity="0.86" />
            </linearGradient>
          </defs>
          <rect x="0.5" y="0.5" width={planBadgeWidth - 1} height="17" rx="8.5" fill="url(#planBadgeGradient)" stroke="#5e9bff" strokeOpacity="0.95" />
          <circle cx="13" cy="9" r="4" fill="#45ff9b" />
          <text x="39" y="13" fill="#f4f7ff" fontFamily="Inter, Arial, sans-serif" fontSize="12" fontWeight="900" letterSpacing="0.35">
            {displayPlan}
          </text>
        </svg>
      </div>

      <div style={{ position: 'absolute', left: '171px', top: '180px', zIndex: 2 }}>
        <div style={{ color: '#5e9bff', fontSize: '7px', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '5px' }}>START DATE</div>
        <div style={{ color: '#cbd8ff', fontSize: '10px', fontWeight: 800, letterSpacing: '0' }}>{formatDateDDMMYYYY(member.start_date)}</div>
      </div>

      <div style={{ position: 'absolute', left: '381px', top: '180px', zIndex: 2 }}>
        <div style={{ color: '#5e9bff', fontSize: '7px', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '5px' }}>EXPIRY DATE</div>
        <div style={{ color: '#cbd8ff', fontSize: '10px', fontWeight: 800, letterSpacing: '0' }}>{formatDateDDMMYYYY(member.end_date)}</div>
      </div>

      <div style={{ position: 'absolute', left: '171px', top: '236px', zIndex: 2 }}>
        <div style={{ color: '#5e9bff', fontSize: '7px', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '4px' }}>MEMBER CODE</div>
        <div style={{ color: '#a9bcf5', fontFamily: 'monospace', fontSize: '10px', fontWeight: 800, letterSpacing: '0' }}>{displayCode}</div>
      </div>

      <div style={{
        position: 'absolute', bottom: '12px', right: '25px',
        width: '180px', height: '128px',
        background: '#ffffff', borderRadius: '6px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '10px 14px 5px',
        border: '2px solid #87b0fb',
        boxShadow: '0 0 5px rgba(100, 150, 255, 0.8)',
        zIndex: 2,
      }}>
        <canvas ref={barcodeRef} style={{ width: '154px', height: '108px' }} />
        <div style={{ color: '#4a4a4a', fontSize: '7px', fontFamily: 'monospace', fontWeight: 400, letterSpacing: '1px', lineHeight: 1, marginTop: '2px' }}>
          {displayCode}
        </div>
      </div>
    </div>
  )
}
