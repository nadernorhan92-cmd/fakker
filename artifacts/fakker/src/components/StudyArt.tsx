export default function StudyArt({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 150" aria-hidden="true" focusable="false">
      <ellipse cx="112" cy="138" rx="96" ry="9" fill="#f3c9b3" opacity=".55" />
      <rect x="26" y="104" width="92" height="16" rx="5" fill="#f2672e" />
      <rect x="32" y="90" width="80" height="15" rx="5" fill="#cfdcb8" />
      <rect x="22" y="119" width="100" height="16" rx="5" fill="#fbe0a0" />
      <path d="M30 111h80M36 97h68M28 127h86" stroke="#fffaf3" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      <rect x="128" y="30" width="70" height="78" rx="12" fill="#fffaf3" stroke="#1f1a17" strokeWidth="2.5" />
      <rect x="128" y="30" width="70" height="20" rx="10" fill="#f2672e" stroke="#1f1a17" strokeWidth="2.5" />
      <path d="M144 24v14M182 24v14" stroke="#1f1a17" strokeWidth="3" strokeLinecap="round" />
      <path d="M150 74l9 9 18-20" stroke="#f2672e" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="150" y="112" width="30" height="24" rx="8" fill="#c9b8f0" stroke="#1f1a17" strokeWidth="2.5" />
      <path d="M165 112c-2-14-14-18-20-24 12 0 18 8 20 16 2-12 10-18 22-18-8 6-18 12-22 26" fill="#8fa66b" />
      <circle cx="58" cy="52" r="20" fill="#fbe0a0" />
      <path d="M58 22v8M58 74v8M28 52h8M80 52h8M37 31l5 5M74 68l5 5M79 31l-5 5M42 68l-5 5" stroke="#f2a24a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
