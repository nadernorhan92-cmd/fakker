export default function FindTasks() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">اعثر على المهمة، ثم حدّد خطوتك التالية</h1>
    <div className="deck-body deck-columns deck-copy">
      <ul className="deck-list">
        <li>ابحث بعنوان المهمة</li>
        <li>صفِّ حسب المادة أو الحالة أو الأولوية</li>
        <li>اعرض الأقرب موعدًا أولًا</li>
      </ul>
      <div className="h-full flex flex-col justify-center gap-[5vh] border-r border-[#d4d4d8] pr-[4vw]">
        <p className="m-0">عدّل المهمة أو أكملها أو أعد فتحها</p>
        <p className="m-0">لا تُحذف المهمة إلا بعد التأكيد</p>
      </div>
    </div>
    <footer className="deck-foot">٩</footer>
  </div>;
}
