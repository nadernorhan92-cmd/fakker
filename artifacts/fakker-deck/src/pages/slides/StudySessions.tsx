import { SlideBackdrop, SlideFooter, SlideHeader } from '@/components/DeckElements';

const base = import.meta.env.BASE_URL;

export default function StudySessions() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop tone="rose" />
    <SlideHeader />
    <div className="deck-content">
      <p className="deck-kicker">التركيز</p>
      <h1 className="deck-heading mt-[1.5vh]">جلسة تركيز تتبع إيقاعك</h1>
      <p className="deck-subheading">اضبطي وقت التركيز والاستراحة، ثم ابدئي حين تكونين مستعدة.</p>
    </div>
    <div className="absolute z-10 right-[8vw] top-[47vh] w-[39vw] flex flex-col gap-[2.2vh] deck-copy-medium">
      <p className="m-0">اربطِي المؤقّت بمهمة أو اتركيه عامًا.</p>
      <p className="m-0">أوقفي الجلسة مؤقتًا أو استأنفيها.</p>
      <p className="m-0">راجعي سجل جلسات التركيز والوقت المسجل.</p>
    </div>
    <div className="absolute z-10 left-[8vw] top-[42vh] w-[37vw] h-[39vh] deck-photo-frame">
      <img src={`${base}ai-focus-still-life_2.jpg`} crossOrigin="anonymous" alt="صورة مولّدة لمؤقّت ودفتر في مساحة مذاكرة هادئة" />
    </div>
    <div className="absolute z-10 left-[11vw] bottom-[10vh] deck-chip">تنبيه الانتهاء يظهر داخل التطبيق</div>
    <SlideFooter page="٧" />
  </div>;
}
