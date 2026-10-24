const base = import.meta.env.BASE_URL;
export default function Calendar() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">التقويم يحوّل المواعيد إلى صورة واضحة</h1>
    <div className="deck-body grid grid-cols-[0.75fr_1.25fr] gap-[3vw] items-center">
      <ul className="deck-list deck-copy">
        <li>عرض شهري للمواعيد على امتداد الشهر</li>
        <li>عرض أسبوعي للتخطيط القريب</li>
        <li>اختيار أي يوم لعرض مهامه</li>
        <li>التنقل بين الأسابيع والأشهر</li>
      </ul>
      <img src={`${base}calendar.jpg`} crossOrigin="anonymous" alt="صفحة التقويم الشهري الفعلية في فَكّر" className="deck-screen border border-[#d4d4d8]"/>
    </div>
    <footer className="deck-foot">١١</footer>
  </div>;
}
