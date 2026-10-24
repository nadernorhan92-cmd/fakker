const base = import.meta.env.BASE_URL;

export default function Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body" dir="ltr">
      <div className="absolute left-0 top-0 w-[50vw] h-full px-[6vw] py-[8vh] flex flex-col justify-between" dir="rtl">
        <p className="text-[1.5vw] font-semibold m-0">فَكّر</p>
        <div>
          <div className="w-[3vw] h-[0.4vh] bg-primary mb-[4vh]" />
          <h1 className="font-display text-[8vw] font-extrabold leading-[1.4] m-0">فَكّر</h1>
          <p className="text-[2vw] leading-[1.8] text-muted mt-[3vh] mb-0">مساحة عربية لتنظيم المذاكرة والمهام الدراسية.</p>
        </div>
        <span className="text-[1.5vw] text-muted">فَكّر</span>
      </div>
      <div className="absolute right-0 top-0 w-[50vw] h-full">
        <img src={`${base}study-workspace.jpg`} crossOrigin="anonymous" alt="مساحة دراسة هادئة ومضيئة" className="deck-photo" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-transparent to-transparent" />
      </div>
    </div>
  );
}
