const base = import.meta.env.BASE_URL;

export function SlideBackdrop({ tone }: { tone?: 'rose' | 'cocoa' }) {
  return <div className={`deck-ambient ${tone ?? ''}`} aria-hidden="true" />;
}

export function SlideHeader() {
  return <header className="deck-header"><span>فَكّر</span><span className="deck-rule" /></header>;
}

export function SlideFooter({ page }: { page: string }) {
  return <footer className="deck-footer"><span>فَكّر · مشروع لتنظيم المذاكرة</span><span>{page}</span></footer>;
}

export function PartnerMarks() {
  return <div className="deck-brand-row" aria-label="شعارا Replit وNordpoints">
    <span className="partner-mark">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M6 4h13a4 4 0 0 1 4 4v3H10v4h17v7H10v6H6z" fill="#f26b4f" />
        <path d="M23 11h4a4 4 0 0 1 4 4v3H10v-7z" fill="#f26b4f" />
        <path d="M10 22h17v2a4 4 0 0 1-4 4H10z" fill="#f26b4f" />
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
