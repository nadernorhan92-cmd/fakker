import { SlideBackdrop, SlideFooter, SlideHeader } from '@/components/DeckElements';

export default function Reminders() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop tone="rose" />
    <SlideHeader />
    <div className="deck-content">
      <p className="deck-kicker">التذكيرات</p>
      <h1 className="deck-heading mt-[1.5vh]">تذكير مناسب لكل موعد</h1>
      <p className="deck-subheading">التنبيهات داخل التطبيق متاحة، وإشعارات الخلفية اختيارية.</p>
    </div>
    <div className="absolute z-10 right-[8vw] top-[48vh] w-[39vw] flex flex-col gap-[2.2vh] deck-copy-medium">
      <p className="m-0">حدّدي موعد تذكير للمهمة.</p>
      <p className="m-0">تحتاج إشعارات الخلفية إلى إذن المتصفح واتصال بالإنترنت.</p>
      <p className="m-0">يمكن إلغاء اشتراك الخلفية من الإعدادات.</p>
    </div>
    <div className="absolute z-10 left-[8vw] top-[45vh] w-[36vw] deck-card p-[2.5vw]">
      <div className="flex items-center gap-[1.5vw]">
        <span className="w-[5vw] h-[5vw] rounded-full bg-[#f1e3dd] flex items-center justify-center text-[2.6vw] text-primary">!</span>
        <div>
          <p className="m-0 text-[2.2vw] font-bold">مواعيد الدراسة</p>
          <p className="m-0 mt-[1vh] text-[1.7vw] text-muted">إشعار قبل موعد المهمة</p>
        </div>
      </div>
      <div className="mt-[3vh] border-t border-[#ead9d0] pt-[2.5vh] text-[1.7vw] leading-[1.7] text-muted">
        يصل إشعار الخلفية وفق دعم المتصفح والجهاز وإعداداتهما.
      </div>
    </div>
    <SlideFooter page="٩" />
  </div>;
}
