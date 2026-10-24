const base = import.meta.env.BASE_URL;
export default function Student() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">صُمّم للطالب الذي يريد خطة أوضح</h1>
    <div className="deck-body deck-split">
      <ul className="deck-list deck-copy">
        <li>متابعة المواد الدراسية في مكان واحد</li>
        <li>تنظيم المذاكرة والواجبات والمشروعات</li>
        <li>مراجعة المواعيد من الموبايل أو الكمبيوتر</li>
        <li>تجربة عربية كاملة باتجاه من اليمين إلى اليسار</li>
      </ul>
      <img src={`${base}study-workspace.jpg`} crossOrigin="anonymous" alt="مساحة دراسة منظمة وهادئة" className="deck-photo"/>
    </div>
    <footer className="deck-foot">٣</footer>
  </div>;
}
