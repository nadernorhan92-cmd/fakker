import { SlideBackdrop, SlideFooter, SlideHeader } from '@/components/DeckElements';

export default function Progress() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop />
    <SlideHeader />
    <div className="deck-content">
      <p className="deck-kicker">متابعة التقدم</p>
      <h1 className="deck-heading mt-[1.5vh]">شاهدي أثر خطواتك</h1>
      <p className="deck-subheading">ملخصات الإنجاز ووقت التركيز تساعدك على مراجعة خطتك.</p>
    </div>
    <div className="absolute z-10 right-[8vw] left-[8vw] top-[48vh] grid grid-cols-3 gap-[2vw]">
      <div className="deck-card h-[26vh] p-[2.2vw] flex flex-col justify-between"><span className="text-[1.8vw] text-muted">المهام المكتملة</span><span className="deck-stat">إنجاز</span><span className="text-[1.7vw]">نسبة الإكمال والمهام المتأخرة</span></div>
      <div className="deck-card h-[26vh] p-[2.2vw] flex flex-col justify-between"><span className="text-[1.8vw] text-muted">وقت التركيز</span><span className="deck-stat">ساعات</span><span className="text-[1.7vw]">جلسات مسجلة على الجهاز</span></div>
      <div className="deck-card h-[26vh] p-[2.2vw] flex flex-col justify-between"><span className="text-[1.8vw] text-muted">إنجاز الأيام</span><span className="deck-stat">أسبوع</span><span className="text-[1.7vw]">رؤية يومية للتقدم والالتزام</span></div>
    </div>
    <div className="absolute z-10 right-[8vw] left-[8vw] bottom-[14vh] text-center text-[1.8vw] text-muted">تُعرض الإحصاءات من البيانات التي يسجلها الطالب داخل التطبيق.</div>
    <SlideFooter page="١٠" />
  </div>;
}
