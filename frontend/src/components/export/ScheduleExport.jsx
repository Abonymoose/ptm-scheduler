import { useRef, useState } from 'react'
import theme from '../../theme'
import ParentPass from './ParentPass'
import TeacherPass from './TeacherPass'
import { exportNodeAsImage } from '../../utils/exportImage'

const btnBase = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 40,
  fontSize: 'clamp(12px,1.4vw,14px)', fontWeight: 700, padding: 'clamp(8px,1.1vw,10px) clamp(16px,2vw,20px)',
  borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap',
}
const primaryBtn = { ...btnBase, background: theme.primary, color: '#fff', border: 'none' }

// `kind` picks which pass component renders; `data` is spread onto it
// (ParentPass/TeacherPass share prop shapes within their kind).
export default function ScheduleExport({ kind, data, filename }) {
  const imgRef = useRef(null)
  const [saving, setSaving] = useState(false)

  const handleSaveImage = async () => {
    if (saving) return
    setSaving(true)
    try {
      await exportNodeAsImage(imgRef.current, filename)
    } catch {
      // exportNodeAsImage already falls back to a plain download internally;
      // nothing further to do here besides not leaving the button stuck.
    }
    setSaving(false)
  }

  const ImagePass = kind === 'parent' ? ParentPass : TeacherPass

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={handleSaveImage} disabled={saving} style={{ ...primaryBtn, opacity: saving ? .65 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Preparing…' : 'Save as image'}
        </button>
      </div>

      {/* Off-screen, real DOM (html2canvas + font metrics both need layout). */}
      <div style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <ImagePass ref={imgRef} {...data} />
      </div>
    </>
  )
}
