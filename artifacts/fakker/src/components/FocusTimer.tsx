import { useEffect, useId, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer, Coffee, ArrowLeft } from 'lucide-react';
import type { Task } from '@/lib/study-db';
import { useFocusTimer } from '@/lib/use-focus-timer';
import './FocusTimer.css';

const ar = (n: number) => new Intl.NumberFormat('ar-u-nu-arab', { useGrouping: false }).format(n);
const pad = (n: number) => new Intl.NumberFormat('ar-u-nu-arab', { minimumIntegerDigits: 2, useGrouping: false }).format(n);
function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${ar(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function spoken(ms: number) {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  return mins <= 1 ? 'أقل من دقيقة متبقية' : `متبقٍ نحو ${ar(mins)} دقيقة`;
}
const clamp = (v: number, max: number) => Math.min(max, Math.max(1, Math.round(v)));

export default function FocusTimer({ tasks }: { tasks: Task[] }) {
  const { state, remainingMs, busy, error, start, pause, reset, configure, next } = useFocusTimer();
  const uid = useId();
  const [focusDraft, setFocusDraft] = useState('25');
  const [breakDraft, setBreakDraft] = useState('5');
  const [taskDraft, setTaskDraft] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [open, setOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const prevStatus = useRef<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resetBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state) { setFocusDraft(String(state.focusMinutes)); setBreakDraft(String(state.breakMinutes)); setTaskDraft(state.taskId); }
  }, [state?.status, state?.focusMinutes, state?.breakMinutes, state?.taskId]);

  useEffect(() => {
    const s = state?.status ?? null;
    if (s === 'completed' && prevStatus.current !== 'completed') {
      setOpen(true);
      setAnnounce(state!.phase === 'focus' ? 'انتهت جلسة التركيز. خذ استراحتك حين تكون جاهزًا.' : 'انتهت الاستراحة. ابدأ جلسة التركيز التالية حين تكون جاهزًا.');
    } else if (s !== 'completed') setAnnounce('');
    prevStatus.current = s;
  }, [state?.status, state?.phase]);

  useEffect(() => { if (confirmReset) cancelRef.current?.focus(); }, [confirmReset]);

  if (!state) {
    if (error) return <section className="ft-card"><p className="ft-error" role="alert">{error} ستتم إعادة المحاولة تلقائيًا.</p></section>;
    return <section className="ft-card ft-loading" aria-busy="true" aria-label="جارٍ تحميل مؤقّت التركيز" data-testid="focus-timer-loading"><div className="ft-skel"/><div className="ft-skel short"/></section>;
  }

  const idle = state.status === 'idle';
  const running = state.status === 'running';
  const completed = state.status === 'completed';
  const isFocus = state.phase === 'focus';
  const totalMs = (isFocus ? state.focusMinutes : state.breakMinutes) * 60000;
  const progress = completed ? 1 : idle ? 0 : Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
  const task = tasks.find(t => t.id === state.taskId);
  const openTasks = tasks.filter(t => t.status !== 'completed' || t.id === state.taskId);
  const shownMs = idle ? totalMs : remainingMs;

  const commit = async (f: string, b: string, taskId: string | null) => {
    const fm = clamp(Number(f) || state.focusMinutes, 120), bm = clamp(Number(b) || state.breakMinutes, 60);
    setFocusDraft(String(fm)); setBreakDraft(String(bm));
    if (fm !== state.focusMinutes || bm !== state.breakMinutes || taskId !== state.taskId) return configure(fm, bm, taskId);
    return true;
  };

  const phaseName = isFocus ? 'تركيز' : 'استراحة';
  const statusText = completed ? `انتهت ${isFocus ? 'جلسة التركيز' : 'الاستراحة'}` : running ? `${phaseName} جارٍ` : state.status === 'paused' ? `${phaseName} متوقف مؤقتًا` : `جاهز لل${phaseName}`;

  return <section className={`ft-card phase-${state.phase} st-${state.status} ${open ? 'is-open' : ''}`} aria-labelledby={`${uid}-title`} data-testid="focus-timer">
    <div role="alert" aria-live="assertive" className="ft-sr">{announce}</div>
    <button type="button" className="ft-bar" aria-expanded={open} aria-controls={`${uid}-body`} onClick={() => setOpen(o => !o)} data-testid="button-toggle-focus-timer">
      <span className="ft-dial" style={{ ['--p' as string]: progress }} aria-hidden="true">{isFocus ? <Timer size={17}/> : <Coffee size={17}/>}</span>
      <span className="ft-bar-text">
        <strong id={`${uid}-title`}>مؤقّت التركيز</strong>
        <small data-testid="text-focus-status">{statusText}{task ? ` · ${task.title}` : ''}</small>
      </span>
      <span className="ft-mini" aria-label={spoken(shownMs)} data-testid="text-focus-remaining-mini">{clock(shownMs)}</span>
    </button>
    {error && <p className="ft-error" role="alert" data-testid="text-focus-error">{error}</p>}

    {completed && <div className="ft-done" data-testid="status-focus-complete">
      <div><strong>{isFocus ? 'أحسنت، انتهت جلسة التركيز.' : 'انتهت الاستراحة.'}</strong><p>{isFocus ? `خذ ${ar(state.breakMinutes)} دقائق لتريح ذهنك، لن تبدأ تلقائيًا.` : `جلسة التركيز التالية ${ar(state.focusMinutes)} دقيقة، ابدأها حين تكون مستعدًا.`}</p></div>
      <div className="ft-done-actions">
        <button className="btn" disabled={busy || confirmReset} onClick={() => void next()} data-testid="button-focus-next">{isFocus ? 'ابدأ الاستراحة' : 'ابدأ جلسة تركيز'} <ArrowLeft size={15}/></button>
        <button className="btn soft small" disabled={busy} onClick={() => { setOpen(true); setConfirmReset(true); }} data-testid="button-focus-done-reset">إنهاء الدورة</button>
      </div>
    </div>}

    <div id={`${uid}-body`} className="ft-body" hidden={!open}>
      <div className="ft-face">
        <div className="ft-phase-tabs" aria-hidden="true"><span className={isFocus ? 'on' : ''}>تركيز</span><span className={!isFocus ? 'on' : ''}>استراحة</span></div>
        <div className="ft-time" data-testid="text-focus-remaining" aria-label={spoken(shownMs)}>{clock(shownMs)}</div>
        <div className="ft-track" aria-hidden="true"><div className="ft-fill" style={{ transform: `scaleX(${progress})` }}/></div>
      </div>

      <fieldset className="ft-config" disabled={!idle || busy}>
        <legend className="ft-sr">إعدادات الجلسة</legend>
        <label className="ft-field"><span>مدة التركيز (دقيقة)</span>
          <input className="field" type="number" inputMode="numeric" min={1} max={120} value={focusDraft} onChange={e => setFocusDraft(e.target.value)} data-testid="input-focus-minutes"/>
        </label>
        <label className="ft-field"><span>مدة الاستراحة (دقيقة)</span>
          <input className="field" type="number" inputMode="numeric" min={1} max={60} value={breakDraft} onChange={e => setBreakDraft(e.target.value)} data-testid="input-break-minutes"/>
        </label>
        <label className="ft-field wide"><span>المهمة (اختياري)</span>
          <select className="select" value={taskDraft ?? ''} onChange={e => setTaskDraft(e.target.value || null)} data-testid="select-focus-task">
            <option value="">دون مهمة محددة</option>
            {taskDraft && !tasks.some(t => t.id === taskDraft) && <option value={taskDraft}>المهمة لم تعد موجودة</option>}
            {openTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        {!idle && <p className="ft-hint">يمكن تعديل المدد والمهمة بعد إعادة الضبط فقط.</p>}
      </fieldset>
      {idle && <div className="ft-actions"><button className="btn soft small" disabled={busy} onClick={() => void commit(focusDraft, breakDraft, taskDraft)} data-testid="button-focus-save-settings">حفظ المدد والمهمة</button></div>}

      {confirmReset ? <div className="ft-confirm" role="alertdialog" aria-labelledby={`${uid}-ct`} aria-describedby={`${uid}-cd`} onKeyDown={e => { if (e.key === 'Escape') { setConfirmReset(false); resetBtnRef.current?.focus(); } }}>
        <strong id={`${uid}-ct`}>إعادة ضبط المؤقّت؟</strong>
        <p id={`${uid}-cd`}>سيتوقف الوقت الحالي ويعود المؤقّت إلى بداية جلسة التركيز، مع حفظ المدد والمهمة.</p>
        <div className="ft-actions">
          <button ref={cancelRef} className="btn soft small" onClick={() => setConfirmReset(false)} data-testid="button-focus-reset-cancel">تراجع</button>
          <button className="btn danger small" disabled={busy} onClick={async () => { if (await reset()) setConfirmReset(false); }} data-testid="button-focus-reset-confirm">نعم، أعد الضبط</button>
        </div>
      </div> : <div className="ft-actions">
        {running ? <button className="btn" disabled={busy} onClick={() => void pause()} data-testid="button-focus-pause"><Pause size={16}/> إيقاف مؤقت</button>
          : !completed && <button className="btn" disabled={busy} onClick={async () => { if (!idle || await commit(focusDraft, breakDraft, taskDraft)) await start(); }} data-testid="button-focus-start"><Play size={16}/> {state.status === 'paused' ? 'استئناف' : isFocus ? 'ابدأ التركيز' : 'ابدأ الاستراحة'}</button>}
        {!idle && <button ref={resetBtnRef} className="btn soft" disabled={busy} onClick={() => setConfirmReset(true)} data-testid="button-focus-reset"><RotateCcw size={15}/> إعادة الضبط</button>}
      </div>}
      <p className="ft-note">تنبيه الانتهاء يظهر داخل التطبيق فقط، دون صوت أو إشعارات خارجية.</p>
    </div>
  </section>;
}
