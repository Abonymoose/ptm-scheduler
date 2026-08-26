import { T, sans } from './tokens'

// The small "Powered by PTM Now" mark repeated in every export mockup's footer
// (frontend/reference/parent-pass-autofit.html:209-217 and identical blocks
// in teacher-pass.html and export-mockups-v6.html).
export default function PoweredByMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: sans, fontSize: 11, fontWeight: 600, color: T.soft, whiteSpace: 'nowrap' }}>
      Powered by
      <svg width="14" height="14" viewBox="0 0 170 170" aria-hidden="true">
        <rect x="10" y="24" width="150" height="140" rx="26" fill="#EE5A52" />
        <rect x="36" y="10" width="16" height="34" rx="8" fill="#C6362E" />
        <rect x="118" y="10" width="16" height="34" rx="8" fill="#C6362E" />
        <rect x="10" y="24" width="150" height="34" rx="26" fill="#D8443B" />
        <rect x="10" y="44" width="150" height="14" fill="#D8443B" />
        <path d="M54 106 L76 130 L118 78" fill="none" stroke="#fff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      PTM&nbsp;Now
    </div>
  )
}
