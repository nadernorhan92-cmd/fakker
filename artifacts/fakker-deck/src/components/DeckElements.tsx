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
    <span className="partner-mark replit">
      <img className="replit-logo" src={`${base}replit-logo.svg`} alt="شعار Replit الأصلي" />
    </span>
    <span className="partner-divider" />
    <span className="partner-mark nord">
      <img className="partner-upload" src={`${base}nordpoints-mark.jpeg`} crossOrigin="anonymous" alt="شعار Nordpoints المرفق" />
      <span>nordpoints</span>
    </span>
  </div>;
}
