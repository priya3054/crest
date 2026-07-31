// The "Rising C" brand mark: an open blue C stroke with a green upward zigzag.
export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path d="M33,11 A16,16 0 1 0 33,29" stroke="#3B6EF6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20,26 L26,15 L33,22" stroke="#2FC98C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Full sidebar logo: mark + "crest" wordmark (green peak over the t) + subline.
export function Logo() {
  return (
    <div className="logo-block">
      <LogoMark size={32} />
      <div className="logo-word">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <span className="name">crest</span>
          <svg className="peak" width="9" height="5" viewBox="0 0 14 8" fill="none" aria-hidden>
            <path d="M1,7 L5,2 L8,4.5 L13,1" stroke="#2FC98C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="subline">PAPER TRADING</div>
      </div>
    </div>
  );
}
