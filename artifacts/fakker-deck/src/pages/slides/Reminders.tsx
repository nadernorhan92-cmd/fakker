export default function Reminders() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">تذكيرات دون وعود غير واقعية</h1>
    <div className="deck-body grid grid-cols-[1.2fr_0.8fr] gap-[4vw] items-center deck-copy">
      <ul className="deck-list">
        <li>اختر موعد تذكير لكل مهمة</li>
        <li>تعمل التذكيرات داخل التطبيق دون إذن إشعارات المتصفح</li>
        <li>إشعارات المتصفح اختيارية وبعد الحصول على الإذن</li>
      </ul>
      <div className="bg-accent h-full px-[2.4vw] flex flex-col justify-center gap-[4vh]">
        <p className="m-0">التذكيرات الحالية تحتاج إلى بقاء التطبيق مفتوحًا</p>
        <p className="m-0">العمل في الخلفية يحتاج إلى إعداد إضافي</p>
      </div>
    </div>
    <footer className="deck-foot">١٣</footer>
  </div>;
}
