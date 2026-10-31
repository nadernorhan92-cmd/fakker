import { SlideBackdrop, SlideFooter, SlideHeader } from '@/components/DeckElements';

const base = import.meta.env.BASE_URL;

export default function Dashboard() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop />
    <SlideHeader />
    <div className="deck-content">
      <p className="deck-kicker">الرئيسية والمهام</p>
      <h1 className="deck-heading mt-[1.5vh]">ابدئي يومك من صورة واضحة</h1>
      <p className="deck-subheading">ملخص اليوم يضع الخطوة التالية أمامك.</p>
    </div>
    <div className="absolute z-10 right-[8vw] top-[44vh] w-[32vw] flex flex-col gap-[2vh] deck-copy-medium">
      <p className="m-0">مهام اليوم وما اكتمل منها.</p>
      <p className="m-0">أقرب موعد وامتحان قادم.</p>
      <p className="m-0">بحث وتصفية حسب المادة والحالة والأولوية.</p>
    </div>
    <div className="absolute z-10 left-[8vw] top-[38vh] w-[47vw] h-[45vh] deck-screen-wrap">
      <img src={`${base}dashboard.jpg`} crossOrigin="anonymous" alt="لقطة فعلية من لوحة فَكّر الرئيسية" />
    </div>
    <div className="absolute z-10 left-[12vw] bottom-[10vh] w-[20vw] h-[23vh] deck-screen-wrap">
      <img src={`${base}tasks.jpg`} crossOrigin="anonymous" alt="لقطة فعلية من قائمة مهام فَكّر" />
    </div>
    <SlideFooter page="٤" />
  </div>;
}
