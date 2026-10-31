const base = import.meta.env.BASE_URL;

export function SlideBackdrop({ tone }: { tone?: 'rose' | 'cocoa' }) {
  return <div className={`deck-ambient ${tone ?? ''}`} aria-hidden="true" />;
}

export function SlideHeader() {
  return <header className="deck-header"><span>فَكّر</span><PartnerMarks /></header>;
}

export function SlideFooter({ page }: { page: string }) {
  return <footer className="deck-footer"><span>فَكّر · مشروع لتنظيم المذاكرة</span><span>{page}</span></footer>;
}

export function PartnerMarks() {
  return <div className="deck-brand-row" aria-label="شعارا Replit وNordpoints">
    <span className="partner-mark">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M2 1.5A1.5 1.5 0 0 1 3.5 0h7A1.5 1.5 0 0 1 12 1.5V8H3.5A1.5 1.5 0 0 1 2 6.5ZM12 8h8.5A1.5 1.5 0 0 1 22 9.5v5a1.5 1.5 0 0 1-1.5 1.5H12ZM2 17.5A1.5 1.5 0 0 1 3.5 16H12v6.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 2 22.5Z" fill="#F26207" />
      </svg>
      <span>Replit</span>
    </span>
    <span className="partner-divider" />
    <span className="partner-mark nord">
      <img className="partner-upload" src={`${base}nordpoints-mark.jpeg`} crossOrigin="anonymous" alt="شعار Nordpoints المرفق" />
      <span>nordpoints</span>
    </span>
  </div>;
}
