export default function Progress() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">تقدّم يمكن ملاحظته</h1>
    <div className="deck-body deck-index deck-copy">
      <p>عدد المهام المكتملة والمتأخرة</p>
      <p>نسبة إكمال المهام</p>
      <p>المواد الأكثر إنجازًا</p>
      <p>رسم لإنجازات آخر سبعة أيام حسب تاريخ الإكمال</p>
      <p>ساعات جلسات المذاكرة المكتملة</p>
    </div>
    <footer className="deck-foot">١٤</footer>
  </div>;
}
