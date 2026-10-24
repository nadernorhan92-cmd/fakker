const base = import.meta.env.BASE_URL;
export default function Dashboard() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">الرئيسية تجيب: ماذا أفعل اليوم؟</h1>
    <div className="deck-body grid grid-cols-[0.75fr_1.25fr] gap-[3vw] items-center">
      <ul className="deck-list deck-copy">
        <li>ترحيب باسم الطالب</li>
        <li>مهام اليوم والمكتمل والمتبقي</li>
        <li>أقرب امتحان قادم وقائمة مهام اليوم</li>
        <li>شريط إنجاز وزر لإضافة مهمة</li>
      </ul>
      <img src={`${base}dashboard.jpg`} crossOrigin="anonymous" alt="لوحة فَكّر الرئيسية الفعلية" className="deck-screen border border-[#d4d4d8]"/>
    </div>
    <footer className="deck-foot">٦</footer>
  </div>;
}
