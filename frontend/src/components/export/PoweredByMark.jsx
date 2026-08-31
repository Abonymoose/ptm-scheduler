import { T, sans } from './tokens'
import { ICON_PTM_NOW } from '../../assets/logos'

// The small "Powered by PTM Now" mark repeated in every export mockup's footer
// (frontend/reference/parent-pass-autofit.html:209-217 and identical blocks
// in teacher-pass.html and export-mockups-v6.html).
//
// This component is only ever rendered off-screen for html2canvas to
// rasterize (see ParentPass/TeacherPass) -- it's never seen live, so the fix
// here targets html2canvas's output, not the DOM. The DOM itself already
// centres the icon correctly (flex + align-items:center, matching the
// mockup's .mark CSS); html2canvas 1.4.1 doesn't reproduce that centring and
// paints the icon ~7px above the text regardless of display/vertical-align.
// The icon is a base64 PNG (like the header logo, ICON_PTM_NOW in
// assets/logos.js, generated at 28x28 for a crisp 14px display) rather than
// an SVG data URI -- Safari can't reliably rasterize SVG-in-<img> into a
// canvas (particularly one with no explicit intrinsic width/height), which
// made the icon vanish entirely on iOS even though it rendered fine on
// desktop Chrome.
//
// The `top: 7` offset is calibrated to html2canvas 1.4.1's paint behaviour,
// not to any CSS rule -- the DOM itself is already correctly centred, so no
// test will catch a regression here. Confirmed against the real rendered
// PNG (not just the DOM) on desktop Chrome after the SVG-to-PNG swap: the
// offset is unchanged at 7px, icon centre lands within 1px of both text
// runs' centres in both TeacherPass and ParentPass. NOT verified on actual
// iOS Safari -- there's no real WebKit engine available in this environment,
// only Chromium-based automation, so Safari's specific paint offset here is
// unconfirmed. If reports of misalignment on iPhone come back (as opposed to
// the icon simply not appearing, which this PNG switch fixes), re-measure
// on a real device. If html2canvas is ever upgraded, re-measure regardless
// of platform.
export default function PoweredByMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: sans, fontSize: 11, fontWeight: 600, color: T.soft, whiteSpace: 'nowrap' }}>
      Powered by
      <img src={ICON_PTM_NOW} alt="" width={14} height={14} aria-hidden="true" style={{ display: 'block', position: 'relative', top: 7 }} />
      PTM&nbsp;Now
    </div>
  )
}
