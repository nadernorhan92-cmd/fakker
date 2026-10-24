export default function Subjects() {
  return <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="rtl">
    <header className="deck-head"><span>فَكّر</span><span className="w-[3vw] h-[0.4vh] bg-primary"/></header>
    <h1 className="deck-title">كل مادة لها مكانها</h1>
    <div className="deck-body deck-columns deck-copy">
      <div className="flex flex-col gap-[4vh]">
        <p className="deck-cell m-0">اسم المادة ولون يميزها</p>
        <p className="deck-cell m-0">اسم المدرس والوصف حقول اختيارية</p>
      </div>
      <div className="deck-panel flex flex-col gap-[2vh]">
        <p className="m-0">إضافة المواد وتعديلها وحذفها</p>
        <p className="m-0">عرض المهام المرتبطة بكل مادة</p>
        <p className="m-0">حذف المادة يحافظ على مهامها ويفصل ارتباطها</p>
      </div>
    </div>
    <footer className="deck-foot">٧</footer>
  </div>;
}
