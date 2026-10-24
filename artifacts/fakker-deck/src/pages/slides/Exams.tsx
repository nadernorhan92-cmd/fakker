export default function Exams() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">الامتحان القادم حاضر في خطتك</h1>
    <div className="deck-body grid grid-cols-[1.15fr_0.85fr] gap-[4vw] items-center deck-copy">
      <div className="bg-primary text-bg h-full px-[3vw] flex flex-col justify-center gap-[4vh]">
        <p className="m-0">سجّل الامتحان ضمن أنواع المهام</p>
        <p className="m-0">اربطه بمادته وموعده</p>
      </div>
      <div className="flex flex-col justify-center gap-[5vh]">
        <p className="deck-cell m-0">يظهر أقرب امتحان قادم في الرئيسية</p>
        <p className="deck-cell m-0">تظهر مواعيد الامتحانات في التقويم</p>
      </div>
    </div>
    <footer className="deck-foot">١٠</footer>
  </div>;
}
