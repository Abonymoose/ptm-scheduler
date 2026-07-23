import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

// A small, muted (i) icon that opens a dismissable explanation popup. Click to
// open (works on desktop + mobile); click away or the × to close. The popup is
// portalled to <body> and fixed-positioned from the icon, so overflow containers
// never clip it. It flips upward when there's no room below and is clamped so it
// never runs off the left/right/top/bottom edges.
export default function InfoButton({ text, label = 'More info', size = 15 }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const [pos, setPos] = useState(null)
  const iconRef = useRef(null)
  const popRef = useRef(null)

  const toggle = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!open && iconRef.current) {
      setRect(iconRef.current.getBoundingClientRect())
      setPos(null) // recomputed once the popup is measured
    }
    setOpen(o => !o)
  }

  // Position after the popup renders (before paint), so we can measure its size.
  useLayoutEffect(() => {
    if (!open || !rect || !popRef.current) return
    const pop = popRef.current.getBoundingClientRect()
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = Math.min(rect.left, vw - pop.width - margin)
    left = Math.max(margin, left)

    const spaceBelow = vh - rect.bottom - margin
    const spaceAbove = rect.top - margin
    let top = (pop.height <= spaceBelow || spaceBelow >= spaceAbove)
      ? rect.bottom + 6            // open downward
      : rect.top - pop.height - 6  // flip upward
    top = Math.max(margin, Math.min(top, vh - pop.height - margin))

    setPos({ top, left })
  }, [open, rect])

  return (
    <>
      <button
        ref={iconRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        title="What's this?"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: size + 6, height: size + 6, padding: 0, flexShrink: 0,
          background: 'none', border: 'none', cursor: 'pointer', color: '#B7ADA2',
          verticalAlign: 'middle', lineHeight: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#F47920')}
        onMouseLeave={e => (e.currentTarget.style.color = '#B7ADA2')}
      >
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="8" cy="4.7" r="0.95" fill="currentColor" />
          <rect x="7.2" y="6.7" width="1.6" height="5" rx="0.8" fill="currentColor" />
        </svg>
      </button>
      {open && rect && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100000 }} />
          <div ref={popRef} style={{
            position: 'fixed',
            top: pos ? pos.top : rect.bottom + 6,
            left: pos ? pos.left : rect.left,
            visibility: pos ? 'visible' : 'hidden',
            zIndex: 100001,
            width: 240, maxWidth: 'calc(100vw - 16px)', background: '#fff', color: '#374151',
            borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,.18)', border: '1px solid #F0E4D4',
            padding: '12px 32px 12px 14px', fontSize: 13, lineHeight: 1.5, fontWeight: 500,
          }}>
            {text}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                position: 'absolute', top: 6, right: 8, background: 'none', border: 'none',
                cursor: 'pointer', color: '#9CA3AF', fontSize: 18, lineHeight: 1, padding: 2,
              }}
            >×</button>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
