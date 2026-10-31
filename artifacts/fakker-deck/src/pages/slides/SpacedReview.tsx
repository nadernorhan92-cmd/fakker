import { SlideBackdrop, SlideFooter, SlideHeader } from '@/components/DeckElements';

export default function SpacedReview() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop tone="cocoa" />
    <SlideHeader />
    <div className="deck-content">
      <p className="deck-kicker">المراجعة المتباعدة</p>
      <h1 className="deck-heading mt-[1.5vh]">وزّعي المراجعة على أيام محددة</h1>
      <p className="deck-subheading">حوّلي الدرس إلى خطة مراجعات بتواريخ يمكن تعديلها.</p>
    </div>
    <div className="absolute z-10 right-[8vw] top-[48vh] w-[40vw] flex flex-col gap-[2.2vh] deck-copy-medium">
      <p className="m-0">اختاري فواصل الأيام بعد تاريخ بداية الخطة.</p>
      <p className="m-0">راجعي المواعيد المقترحة قبل الحفظ.</p>
      <p className="m-0">تظهر المراجعات القادمة ضمن مهامك.</p>
    </div>
    <div className="absolute z-10 left-[8vw] top-[44vh] w-[37vw] deck-card p-[2.4vw]">
      <p className="m-0 text-[1.7vw] text-muted">مثال لخطة تبدأ اليوم</p>
      <div className="mt-[3vh] flex items-center justify-between">
        <div className="flex flex-col items-center gap-[1.5vh]"><span className="deck-stat">١</span><span className="text-[1.7vw]">اليوم الأول</span></div>
        <span className="deck-line" />
        <div className="flex flex-col items-center gap-[1.5vh]"><span className="deck-stat">٣</span><span className="text-[1.7vw]">بعد ٣ أيام</span></div>
        <span className="deck-line" />
        <div className="flex flex-col items-center gap-[1.5vh]"><span className="deck-stat">٧</span><span className="text-[1.7vw]">بعد أسبوع</span></div>
      </div>
      <p className="m-0 mt-[3vh] text-[1.7vw] text-muted">الفواصل تُحسب من تاريخ البداية.</p>
    </div>
    <SlideFooter page="٨" />
  </div>;
}
