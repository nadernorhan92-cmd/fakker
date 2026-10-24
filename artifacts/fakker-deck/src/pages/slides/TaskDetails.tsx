export default function TaskDetails() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">مهمة واحدة، بكل تفاصيلها</h1>
    <div className="deck-body deck-index deck-copy">
      <p>عنوان ووصف ومادة دراسية مرتبطة</p>
      <p>النوع: واجب أو مذاكرة أو مشروع أو امتحان</p>
      <p>الموعد والأولوية: منخفضة أو متوسطة أو عالية</p>
      <p>الحالة: لم تبدأ أو قيد التنفيذ أو مكتملة</p>
      <p>موعد تذكير وأوقات مذاكرة اختيارية</p>
    </div>
    <footer className="deck-foot">٨</footer>
  </div>;
}
