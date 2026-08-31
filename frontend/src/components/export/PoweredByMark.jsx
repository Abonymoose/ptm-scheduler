import { T, sans } from './tokens'

// The small "Powered by PTM Now" mark repeated in every export mockup's footer
// (frontend/reference/parent-pass-autofit.html:209-217 and identical blocks
// in teacher-pass.html and export-mockups-v6.html).
//
// This component is only ever rendered off-screen for html2canvas to
// rasterize (see ParentPass/TeacherPass) -- it's never seen live, so the fix
// here targets html2canvas's output, not the DOM. The DOM itself already
// centres the icon correctly (flex + align-items:center, matching the
// mockup's .mark CSS); html2canvas 1.4.1 doesn't reproduce that centring and
// paints the icon ~7px above the text regardless of display/vertical-align
// on an inline <svg>. Rasterizing the icon as an <img> data URI (like the
// header logo, which html2canvas paints correctly) makes an explicit `top`
// offset actually take effect, and 7px is the measured value that lines up
// its centre with the text's -- verified by rendering this component through
// the real exportNodeAsImage/html2canvas call and measuring pixel bounding
// boxes in the output canvas.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="170" height="170" viewBox="0 0 170 170">
  <rect x="10" y="24" width="150" height="140" rx="26" fill="#EE5A52"/>
  <rect x="36" y="10" width="16" height="34" rx="8" fill="#C6362E"/>
  <rect x="118" y="10" width="16" height="34" rx="8" fill="#C6362E"/>
  <rect x="10" y="24" width="150" height="34" rx="26" fill="#D8443B"/>
  <rect x="10" y="44" width="150" height="14" fill="#D8443B"/>
  <path d="M54 106 L76 130 L118 78" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
const iconSrc = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`

export default function PoweredByMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: sans, fontSize: 11, fontWeight: 600, color: T.soft, whiteSpace: 'nowrap' }}>
      Powered by
      <img src={iconSrc} alt="" width={14} height={14} aria-hidden="true" style={{ display: 'block', position: 'relative', top: 7 }} />
      PTM&nbsp;Now
    </div>
  )
}
