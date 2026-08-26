import html2canvas from 'html2canvas'

// Renders `node` (a real, attached DOM element -- html2canvas and font
// metrics both need layout) to a PNG and either hands it to the native share
// sheet (mobile -> straight to WhatsApp) or falls back to a plain download
// (desktop, or when the Web Share API can't share files).
export async function exportNodeAsImage(node, filename) {
  await document.fonts.ready // must await, or Fraunces/Inter silently fall back
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' })

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not render image')

  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return // user cancelled the share sheet
      // fall through to download on any other share failure
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
