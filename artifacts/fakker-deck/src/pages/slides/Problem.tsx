import { SlideBackdrop, SlideFooter, SlideHeader } from '@/components/DeckElements';

const base = import.meta.env.BASE_URL;

export default function Problem() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop tone="rose" />
    <SlideHeader />
    <div className="deck-content">
      <p className="deck-kicker">الفكرة</p>
      <h1 className="deck-heading mt-[1.5vh]">كل ما يحتاجه الطالب، في خطة واحدة</h1>
      <p className="deck-subheading">فَكّر يساعد على تحويل المهام والمواعيد المتفرقة إلى خطوات يومية واضحة.</p>
    </div>
    <div className="absolute z-10 right-[8vw] top-[48vh] w-[43vw] flex flex-col gap-[2.5vh] deck-copy-large">
      <p className="m-0">تنظيم المواد والواجبات والمشروعات.</p>
      <p className="m-0">معرفة ما هو قادم وما أُنجز.</p>
      <p className="m-0">تخصيص مساحة واحدة للدراسة والمتابعة.</p>
    </div>
    <div className="absolute z-10 left-[8vw] bottom-[11vh] w-[36vw] h-[42vh] deck-photo-frame">
      <img src={`${base}ai-planning-illustration_2.jpg`} crossOrigin="anonymous" alt="رسم مولّد لأدوات تخطيط مذاكرة منظمة" />
    </div>
    <SlideFooter page="٢" />
  </div>;
}
