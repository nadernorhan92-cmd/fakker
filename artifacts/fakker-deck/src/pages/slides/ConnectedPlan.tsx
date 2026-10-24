export default function ConnectedPlan() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">من قائمة مهام إلى خطة دراسة مترابطة</h1>
    <div className="deck-body grid grid-cols-4 gap-[2vw] items-center">
      <div className="h-[37vh] bg-primary text-bg px-[2vw] flex items-center"><p className="deck-copy">اربط كل مهمة بمادتها الدراسية</p></div>
      <div className="h-[37vh] border-t border-primary flex items-center"><p className="deck-copy">حدّد الموعد والأولوية والحالة</p></div>
      <div className="h-[37vh] bg-accent px-[2vw] flex items-center"><p className="deck-copy">خطّط لجلسات المذاكرة في التقويم</p></div>
      <div className="h-[37vh] border-t border-primary flex items-center"><p className="deck-copy">تابع الإنجاز من لوحة واضحة</p></div>
    </div>
    <footer className="deck-foot">٤</footer>
  </div>;
}
