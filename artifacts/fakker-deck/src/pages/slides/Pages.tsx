const base = import.meta.env.BASE_URL;
export default function Pages() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">ست صفحات، تجربة واحدة</h1>
    <div className="deck-body grid grid-cols-[0.85fr_1.15fr] gap-[4vw] items-center">
      <ul className="deck-list deck-copy">
        <li>الرئيسية: نظرة سريعة على اليوم</li>
        <li>المواد والمهام: إدارة تفاصيل الدراسة</li>
        <li>التقويم: المواعيد وجلسات المذاكرة</li>
        <li>الإحصاءات والإعدادات: التقدم والتفضيلات</li>
      </ul>
      <div className="relative h-full">
        <img src={`${base}calendar.jpg`} crossOrigin="anonymous" alt="صفحة التقويم الفعلية دون بيانات تجريبية" className="absolute w-[38vw] left-0 top-0 border border-[#d4d4d8]"/>
        <img src={`${base}tasks.jpg`} crossOrigin="anonymous" alt="صفحة المهام الفعلية دون بيانات تجريبية" className="absolute w-[36vw] right-0 bottom-0 border border-[#d4d4d8] shadow-lg"/>
      </div>
    </div>
    <footer className="deck-foot">٥</footer>
  </div>;
}
