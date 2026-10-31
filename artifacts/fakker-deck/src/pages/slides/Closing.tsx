import { PartnerMarks, SlideBackdrop } from '@/components/DeckElements';

export default function Closing() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop tone="rose" />
    <div className="absolute z-10 left-[6vw] top-[6vh]"><PartnerMarks /></div>
    <div className="absolute right-[8vw] top-[25vh] w-[52vw]">
      <p className="deck-kicker"><span className="deck-rule" /> فَكّر</p>
      <h1 className="font-display text-[6.3vw] font-extrabold leading-[1.45] m-0 mt-[2vh]">شكرًا لكم</h1>
      <p className="m-0 mt-[2vh] text-[2.2vw] text-muted">نتمنى أن يجعل فَكّر المذاكرة أوضح وأسهل تنظيمًا.</p>
      <div className="mt-[5vh] border-t border-[#d8c4ba] pt-[2.5vh]">
        <p className="m-0 text-[1.7vw]">إعداد الطالبة: <strong>نورهان نادر حجازي</strong></p>
        <p className="m-0 mt-[1.5vh] text-[1.6vw] text-muted">إشراف: <span dir="ltr" className="inline-block font-semibold">Taha Mahmoud Metwally Nour El-Dein</span></p>
      </div>
    </div>
    <div className="absolute z-10 left-[8vw] top-[29vh] w-[30vw] h-[40vh] rounded-[50%] bg-[#f0ddd5] flex items-center justify-center">
      <div className="w-[19vw] h-[19vw] rounded-[50%] bg-[#fff9f5] flex items-center justify-center text-[4vw] font-display font-bold text-primary">فَكّر</div>
    </div>
    <div className="absolute right-[8vw] bottom-[8vh] text-[1.7vw] text-muted">إدارة أذكى لوقت الدراسة</div>
  </div>;
}
