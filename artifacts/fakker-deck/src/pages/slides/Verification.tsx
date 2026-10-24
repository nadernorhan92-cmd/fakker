export default function Verification() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">لم نتوقف عند تصميم الواجهة</h1>
    <div className="deck-body grid grid-cols-2 gap-x-[4vw] gap-y-[3vh] items-center deck-copy">
      <p className="deck-cell m-0">اختُبرت إضافة المواد وتعديلها وحذفها</p>
      <p className="deck-cell m-0">اختُبرت إضافة المهام وتعديلها وإكمالها وحذفها</p>
      <p className="deck-cell m-0">اختُبر البحث والتصفية والتقويم وجلسات المذاكرة</p>
      <p className="deck-cell m-0">اختُبر بقاء البيانات بعد تحديث الصفحة</p>
      <p className="col-span-2 m-0">روجع العرض على الموبايل والكمبيوتر</p>
    </div>
    <footer className="deck-foot">١٧</footer>
  </div>;
}
