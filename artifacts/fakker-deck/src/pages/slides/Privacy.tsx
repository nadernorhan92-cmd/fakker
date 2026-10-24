export default function Privacy() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">بيانات محفوظة محليًا، وحدود واضحة</h1>
    <div className="deck-body deck-columns deck-copy">
      <div className="bg-primary text-bg h-full px-[3vw] flex flex-col justify-center gap-[4vh]">
        <p className="m-0">تبقى المواد والمهام والإعدادات بعد تحديث الصفحة</p>
        <p className="m-0">الحفظ مرتبط بالمتصفح والجهاز المستخدمين</p>
      </div>
      <ul className="deck-list">
        <li>لا يوجد تسجيل دخول أو مزامنة سحابية حاليًا</li>
        <li>مسح بيانات المتصفح قد يحذف بيانات التطبيق</li>
        <li>يمكن حذف البيانات المحلية من الإعدادات</li>
      </ul>
    </div>
    <footer className="deck-foot">١٦</footer>
  </div>;
}
