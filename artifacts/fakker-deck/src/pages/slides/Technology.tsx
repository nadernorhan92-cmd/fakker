export default function Technology() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">تقنيات مناسبة لتجربة ويب خفيفة</h1>
    <div className="deck-body grid grid-cols-2 gap-x-[4vw] gap-y-[1vh] content-center deck-copy">
      <p className="deck-cell m-0"><b dir="ltr" className="font-semibold">React</b> لبناء الواجهة التفاعلية</p>
      <p className="deck-cell m-0"><b dir="ltr" className="font-semibold">TypeScript</b> لتنظيم الكود والتحقق من الأنواع</p>
      <p className="deck-cell m-0"><b dir="ltr" className="font-semibold">Vite</b> لتطوير التطبيق وبنائه</p>
      <p className="deck-cell m-0"><b dir="ltr" className="font-semibold">IndexedDB</b> لحفظ البيانات داخل المتصفح</p>
      <p className="col-span-2 m-0 pt-[3vh]">واجهة متجاوبة للموبايل والكمبيوتر</p>
    </div>
    <footer className="deck-foot">١٥</footer>
  </div>;
}
