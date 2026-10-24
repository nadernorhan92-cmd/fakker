export default function StudySessions() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">جلسة مذاكرة لها بداية ونهاية</h1>
    <div className="deck-body grid grid-cols-2 gap-x-[4vw] gap-y-[3vh] items-center deck-copy">
      <p className="deck-cell m-0">حدّد وقت بداية الجلسة ونهايتها</p>
      <p className="deck-cell m-0">تظهر الجلسة في يوم المذاكرة المحدد</p>
      <p className="deck-cell m-0">اعرض أوقات الجلسات وإجمالي مدتها</p>
      <p className="bg-accent p-[2.4vw] m-0">يُرفض وقت نهاية يسبق وقت البداية</p>
    </div>
    <footer className="deck-foot">١٢</footer>
  </div>;
}
