import { SlideBackdrop, SlideFooter, SlideHeader } from '@/components/DeckElements';

export default function Privacy() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop tone="cocoa" />
    <SlideHeader />
    <div className="deck-content">
      <p className="deck-kicker">البيانات والنسخ</p>
      <h1 className="deck-heading mt-[1.5vh]">اختيارات واضحة لحفظ الخطة</h1>
      <p className="deck-subheading">تظل الخطة محلية ما لم يختَر المستخدم نقلها أو مزامنتها.</p>
    </div>
    <div className="absolute z-10 right-[8vw] top-[47vh] w-[39vw] flex flex-col gap-[2.1vh] deck-copy-medium">
      <p className="m-0">تسجيل الدخول لا يرفع البيانات تلقائيًا.</p>
      <p className="m-0">المزامنة السحابية يدوية وبعد موافقة المستخدم.</p>
      <p className="m-0">تتيح النسخة الاحتياطية نقل الخطة إلى متصفح آخر.</p>
    </div>
    <div className="absolute z-10 left-[8vw] top-[44vh] w-[36vw] deck-card p-[2.5vw]">
      <div className="flex items-center gap-[1.2vw]"><span className="deck-chip">محلي</span><span className="deck-line" /><span className="deck-chip">اختياري</span></div>
      <p className="m-0 mt-[3vh] text-[2vw] font-semibold">المواد والمهام</p>
      <p className="m-0 mt-[1vh] text-[1.7vw] leading-[1.7] text-muted">مزامنة يدوية للحساب بعد الموافقة، أو حفظ نسخة احتياطية واستعادتها.</p>
      <p className="m-0 mt-[2.5vh] text-[1.7vw] leading-[1.7] text-muted">إعدادات الجهاز وسجل التركيز لا ينتقلان ضمن المزامنة السحابية.</p>
    </div>
    <SlideFooter page="١١" />
  </div>;
}
