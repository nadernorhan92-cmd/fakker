import { SlideBackdrop, SlideFooter, SlideHeader } from '@/components/DeckElements';

const base = import.meta.env.BASE_URL;

export default function Calendar() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <SlideBackdrop tone="cocoa" />
    <SlideHeader />
    <div className="deck-content">
      <p className="deck-kicker">التقويم والامتحانات</p>
      <h1 className="deck-heading mt-[1.5vh]">المواعيد تظهر في سياقها</h1>
      <p className="deck-subheading">تنقّلي بين العرض الشهري والأسبوعي، واختاري اليوم لعرض تفاصيله.</p>
    </div>
    <div className="absolute z-10 right-[8vw] top-[45vh] w-[32vw] flex flex-col gap-[2.2vh] deck-copy-medium">
      <p className="m-0">اربطي الامتحان بالمادة وموعده.</p>
      <p className="m-0">شاهدي أقرب امتحان في الرئيسية.</p>
      <p className="m-0">خططي لجلسة مذاكرة حول الموعد.</p>
    </div>
    <div className="absolute z-10 left-[8vw] top-[39vh] w-[47vw] h-[44vh] deck-screen-wrap">
      <img src={`${base}calendar.jpg`} crossOrigin="anonymous" alt="لقطة فعلية للتقويم الشهري في تطبيق فَكّر" />
    </div>
    <SlideFooter page="٦" />
  </div>;
}
