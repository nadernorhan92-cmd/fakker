import { PartnerMarks, SlideBackdrop } from '@/components/DeckElements';

const base = import.meta.env.BASE_URL;

export default function Cover() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop tone="rose" />
    <div className="absolute z-10 left-[6vw] top-[6vh]"><PartnerMarks /></div>
    <div className="absolute left-[3vw] top-[17vh] w-[43vw] h-[70vh] deck-photo-frame">
      <img src={`${base}ai-cover-study_2.jpg`} crossOrigin="anonymous" alt="صورة مولّدة لمكتب مذاكرة هادئ بألوان كشمير" />
    </div>
    <div className="absolute z-10 right-[8vw] top-[22vh] w-[42vw]">
      <p className="deck-kicker"><span className="deck-rule" /> عرض تقديمي عن الموقع</p>
      <h1 className="font-display text-[8vw] font-extrabold leading-[1.35] m-0 mt-[2vh]">فَكّر</h1>
      <p className="text-[2.3vw] leading-[1.7] text-muted mt-[1vh] mb-0">مساحة عربية تجمع خطة المذاكرة والمهام والمواعيد في مكان واحد.</p>
      <div className="mt-[5vh] border-t border-[#d8c4ba] pt-[2.5vh]">
        <p className="m-0 text-[2vw] font-semibold">إعداد الطالبة</p>
        <p className="m-0 mt-[.5vh] text-[2.15vw]">نورهان نادر حجازي</p>
        <p className="m-0 mt-[2vh] text-[1.7vw] text-muted">إشراف</p>
        <p className="m-0 mt-[.5vh] text-[1.8vw] font-semibold" dir="ltr">Taha Mahmoud Metwally Nour El-Dein</p>
      </div>
    </div>
  </div>;
}
