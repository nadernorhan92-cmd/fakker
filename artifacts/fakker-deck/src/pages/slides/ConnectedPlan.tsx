import { SlideBackdrop, SlideFooter, SlideHeader } from '@/components/DeckElements';

export default function ConnectedPlan() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop tone="cocoa" />
    <SlideHeader />
    <div className="deck-content">
      <p className="deck-kicker">رحلة الاستخدام</p>
      <h1 className="deck-heading mt-[1.5vh]">من المادة إلى إنجاز قابل للمتابعة</h1>
      <p className="deck-subheading">كل خطوة ترتبط بما بعدها لتسهيل التخطيط اليومي.</p>
    </div>
    <div className="absolute z-10 right-[8vw] left-[8vw] top-[48vh] grid grid-cols-4 gap-[2vw]">
      <div className="deck-card h-[27vh] p-[2vw] flex flex-col justify-between"><span className="deck-chip">١</span><p className="m-0 text-[2.1vw] font-semibold">أضيفي مادة</p><span className="text-[1.6vw] text-muted">مساحة لكل مقرر</span></div>
      <div className="deck-card h-[27vh] p-[2vw] flex flex-col justify-between"><span className="deck-chip">٢</span><p className="m-0 text-[2.1vw] font-semibold">حدّدي المهمة</p><span className="text-[1.6vw] text-muted">نوع وموعد وأولوية</span></div>
      <div className="deck-card h-[27vh] p-[2vw] flex flex-col justify-between"><span className="deck-chip">٣</span><p className="m-0 text-[2.1vw] font-semibold">رتّبي وقتك</p><span className="text-[1.6vw] text-muted">تقويم وجلسات دراسة</span></div>
      <div className="deck-card h-[27vh] p-[2vw] flex flex-col justify-between"><span className="deck-chip">٤</span><p className="m-0 text-[2.1vw] font-semibold">تابعي التقدم</p><span className="text-[1.6vw] text-muted">إنجازات ومراجعات</span></div>
    </div>
    <div className="absolute z-10 right-[8vw] left-[8vw] bottom-[15vh] text-center text-[2vw] text-muted">خطة مرنة تتغير مع يوم الطالب واحتياجاته.</div>
    <SlideFooter page="٣" />
  </div>;
}
