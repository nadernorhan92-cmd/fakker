export default function Problem() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">حين تتعدد المواعيد، يصعب تحديد البداية</h1>
    <div className="deck-body deck-index deck-copy">
      <p>واجبات ومشروعات موزعة بين مواد مختلفة</p>
      <p>امتحانات تحتاج إلى استعداد مبكر</p>
      <p>صعوبة معرفة ما أُنجز وما بقي</p>
      <p>الحاجة إلى خطة يومية واضحة</p>
    </div>
    <footer className="deck-foot">٢</footer>
  </div>;
}
