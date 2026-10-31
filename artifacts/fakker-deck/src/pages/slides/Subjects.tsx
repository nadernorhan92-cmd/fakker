import { SlideBackdrop, SlideFooter, SlideHeader } from '@/components/DeckElements';

export default function Subjects() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop tone="rose" />
    <SlideHeader />
    <div className="deck-content">
      <p className="deck-kicker">تنظيم المواد والمهام</p>
      <h1 className="deck-heading mt-[1.5vh]">لكل مادة مساحة مستقلة</h1>
      <p className="deck-subheading">تظهر تفاصيل المقرر ومهامه المرتبطة معًا.</p>
    </div>
    <div className="absolute z-10 right-[8vw] top-[48vh] w-[39vw] flex flex-col gap-[2.3vh] deck-copy-large">
      <p className="m-0">اسم المادة ولون يميزها.</p>
      <p className="m-0">أضيفي المدرس أو وصفًا عند الحاجة.</p>
      <p className="m-0">عدّلي المادة دون فقدان مهامها.</p>
    </div>
    <div className="absolute z-10 left-[8vw] top-[43vh] w-[38vw] h-[39vh]">
      <div className="absolute top-0 right-[5vw] w-[27vw] h-[15vh] rounded-[2vw] bg-[#ecd9d0] rotate-[-5deg]" />
      <div className="absolute top-[5vh] right-0 w-[29vw] h-[17vh] rounded-[2vw] bg-[#f4e9e2] rotate-[3deg]" />
      <div className="absolute top-[10vh] right-[3vw] w-[31vw] h-[18vh] rounded-[2vw] bg-[#b97b70] text-white px-[2.4vw] flex items-center justify-between shadow-xl">
        <span className="text-[2.5vw] font-bold">الأحياء</span><span className="w-[2.2vw] h-[2.2vw] rounded-full bg-[#f8e9db]" />
      </div>
      <div className="absolute top-[23vh] right-[7vw] w-[28vw] h-[13vh] rounded-[1.6vw] bg-white border border-[#ead9d0] px-[2vw] flex items-center justify-between shadow-lg">
        <span className="text-[1.9vw]">مراجعة الفصل الثالث</span><span className="deck-chip">مهمة</span>
      </div>
    </div>
    <SlideFooter page="٥" />
  </div>;
}
