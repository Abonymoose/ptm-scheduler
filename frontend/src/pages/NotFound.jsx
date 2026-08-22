// Real 404 page — a PTM Now page (coral palette, standard header), not a school's.
// Reached by the App catch-all (unknown paths, including the now-removed /login)
// and by BrandedLogin when a /:slug lookup fails, so a mistyped URL says "not
// found" instead of silently showing a login form. Links point at "/" and the
// landing pages, which nginx serves (full navigations, not React routes).
const navLink = { color: '#4A524D', textDecoration: 'none', fontSize: 'clamp(13px,1.5vw,15px)', whiteSpace: 'nowrap' }

// PTM Now mark, reused in the header. Coral body matches the brand icon.
function BrandMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 170 170" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="10" y="24" width="150" height="140" rx="26" fill="#EE5A52" />
      <rect x="36" y="10" width="16" height="34" rx="8" fill="#C6362E" />
      <rect x="118" y="10" width="16" height="34" rx="8" fill="#C6362E" />
      <rect x="10" y="24" width="150" height="34" rx="26" fill="#D8443B" />
      <rect x="10" y="44" width="150" height="14" fill="#D8443B" />
      <path d="M54 106 L76 130 L118 78" fill="none" stroke="#fff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#FFF8F3', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui,sans-serif' }}>

      {/* Standard PTM Now header — matches the unbranded login/landing site. */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 clamp(16px,3vw,32px)', height: 'clamp(54px,7vw,64px)', background: '#fff', borderBottom: '0.5px solid #E9E4DC', flexShrink: 0 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none', color: '#1F2421', fontWeight: 600, fontSize: 'clamp(16px,2vw,18px)' }}>
          <BrandMark size={30} />
          PTM Now
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px,2.5vw,28px)', flexShrink: 0 }}>
          <a href="/how-it-works" style={navLink}>How it works</a>
          <a href="/privacy" style={navLink}>Privacy</a>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(48px,10vw,80px)', fontWeight: 800, color: '#EE5A52', lineHeight: 1, letterSpacing: '-.03em' }}>404</div>
        <div style={{ fontSize: 'clamp(16px,2.2vw,22px)', fontWeight: 700, color: '#1B3F7A' }}>Page not found</div>
        <div style={{ fontSize: 'clamp(13px,1.6vw,15px)', color: '#4A524D', maxWidth: 360 }}>
          The page you’re looking for doesn’t exist or may have moved.
        </div>
        <a href="/" style={{ marginTop: 8, display: 'inline-block', padding: '10px 22px', background: '#EE5A52', color: '#fff', textDecoration: 'none', borderRadius: 10, fontWeight: 700, fontSize: 'clamp(13px,1.6vw,15px)' }}>
          Back to home
        </a>
      </div>
    </div>
  )
}
