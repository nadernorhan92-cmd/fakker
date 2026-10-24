import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, Pencil, Plus, X } from 'lucide-react';
import type { StudyData, Task } from '@/lib/study-db';
import { cancelReviewPlan, loadReviewPlans, saveReviewPlan } from '@/lib/study-db';
import { isUpcomingReview, previewReviews, type ReviewDraft, type ReviewPlan } from '@/lib/spaced-review';
import { trackReviewEvent } from '@/lib/review-analytics';
import { useDialogKeyboard } from '@/hooks/use-dialog-keyboard';

const DEFAULT_INTERVALS = '1، 3، 7، 14';
const toLatin = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const localInput = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fmt = (iso: string) => new Intl.DateTimeFormat('ar', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

function parseIntervals(text: string): number[] | string {
  const parts = toLatin(text).split(/[,،\s]+/).filter(Boolean);
  if (!parts.length) return 'أدخل فاصلًا واحدًا على الأقل بالأيام.';
  const nums = parts.map(Number);
  if (nums.some(n => !Number.isInteger(n) || n < 1 || n > 365)) return 'كل فاصل يجب أن يكون عددًا صحيحًا من ١ إلى ٣٦٥ يومًا.';
  if (new Set(nums).size !== nums.length) return 'لا تكرر الفاصل نفسه.';
  if (nums.length > 12) return 'الحد الأقصى ١٢ مراجعة.';
  return [...nums].sort((a, b) => a - b);
}

type Editor = { plan?: ReviewPlan };

export default function SpacedReviewPanel({ data, onChanged }: { data: StudyData; onChanged: () => Promise<void> }) {
  const [plans, setPlans] = useState<ReviewPlan[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [cancelling, setCancelling] = useState<ReviewPlan | null>(null);

  const reload = async () => {
    setLoadError('');
    try { setPlans(await loadReviewPlans()); } catch (e) { setLoadError(e instanceof Error ? e.message : 'تعذّر تحميل خطط المراجعة.'); }
  };
  useEffect(() => { void reload(); }, [data.tasks]);

  const active = (plans ?? []).filter(p => !p.cancelled);
  const pending = (planId: string) => data.tasks.filter(t => t.reviewPlanId === planId && isUpcomingReview(t)).length;
  const subjectName = (sid: string) => data.subjects.find(s => s.id === sid)?.name ?? 'مادة محذوفة';

  return <section className="card review-panel" data-testid="panel-spaced-review" aria-labelledby="review-title">
    <div className="section-head"><h3 id="review-title"><CalendarClock size={17} style={{ verticalAlign: 'middle', marginLeft: 6 }} />مراجعات متباعدة</h3>
      <button className="btn small" data-testid="button-new-review" onClick={() => { setMessage(null); setEditor({}); }}><Plus size={15} /> خطة مراجعة</button></div>
    <p className="quiet review-lead">ثبّت الدرس بمراجعات بعد أيام محددة من موعد البداية، تظهر كمهام دراسة في خطتك.</p>
    <p className="review-local" data-testid="text-review-local">تُحفظ خطط المراجعة على هذا الجهاز. يمكنك تضمينها اختياريًا في النسخة الاحتياطية لنقلها إلى جهاز آخر؛ لا تدخل في المزامنة السحابية.</p>
    {message && <div className={`review-message ${message.error ? 'failed' : ''}`} role={message.error ? 'alert' : 'status'} data-testid="status-review-message">{message.text}</div>}
    {loadError ? <div className="review-message failed" role="alert">{loadError} <button className="btn soft small" data-testid="button-retry-reviews" onClick={() => void reload()}>إعادة المحاولة</button></div>
      : plans === null ? <div className="review-skeleton" aria-label="جارٍ تحميل خطط المراجعة" />
      : active.length ? <ul className="review-list">{active.map(p => <li key={p.id} className="review-item" data-testid={`row-review-plan-${p.id}`}>
        <div className="review-item-info"><strong>{p.lesson}</strong><small>{subjectName(p.subjectId)} · بعد {p.intervals.join('، ')} أيام</small></div>
        <span className="pill" data-testid={`text-review-pending-${p.id}`}>{pending(p.id)} قادمة</span>
        <button className="icon-btn" aria-label={`تعديل خطة ${p.lesson}`} data-testid={`button-edit-review-${p.id}`} onClick={() => { setMessage(null); setEditor({ plan: p }); }}><Pencil size={15} /></button>
        <button className="icon-btn" aria-label={`إلغاء خطة ${p.lesson}`} data-testid={`button-cancel-review-${p.id}`} onClick={() => { setMessage(null); setCancelling(p); }}><X size={15} /></button>
      </li>)}</ul>
      : <div className="empty review-empty"><strong>لا خطط مراجعة بعد</strong><p>اختر درسًا أنهيته، وسنقترح لك مواعيد مراجعته.</p></div>}
    {editor && <ReviewDialog data={data} plan={editor.plan} onClose={() => setEditor(null)} onSaved={async text => { setEditor(null); setMessage({ text }); await onChanged(); await reload(); }} />}
    {cancelling && <CancelDialog plan={cancelling} count={pending(cancelling.id)} onClose={() => setCancelling(null)} onDone={async (text, error) => { setMessage({ text, error }); if (!error) { setCancelling(null); await onChanged(); await reload(); } }} />}
  </section>;
}

function ReviewDialog({ data, plan, onClose, onSaved }: { data: StudyData; plan?: ReviewPlan; onClose: () => void; onSaved: (text: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  useDialogKeyboard(() => { if (!busy) onClose(); });
  const candidates = useMemo(() => data.tasks.filter(t => !t.reviewPlanId), [data.tasks]);
  const [source, setSource] = useState<string>(plan?.sourceTaskId && data.tasks.some(t => t.id === plan.sourceTaskId && !t.reviewPlanId) ? plan.sourceTaskId : '');
  const sourceMissing = Boolean(plan?.sourceTaskId) && !source;
  const preserved = useMemo(() => plan ? data.tasks.filter(t => t.reviewPlanId === plan.id && !isUpcomingReview(t)) : [], [data.tasks, plan]);
  const [lesson, setLesson] = useState(plan?.lesson ?? '');
  const [subjectId, setSubjectId] = useState(plan?.subjectId ?? '');
  const [baseAt, setBaseAt] = useState(localInput(plan?.baseAt ?? new Date().toISOString()));
  const [intervals, setIntervals] = useState(plan ? plan.intervals.join('، ') : DEFAULT_INTERVALS);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ draft: ReviewDraft; items: { offsetDays: number; dueAt: string }[] } | null>(null);
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPreview(null); setError(''); };

  const pickSource = (taskId: string) => {
    edit(setSource)(taskId);
    const t: Task | undefined = candidates.find(c => c.id === taskId);
    if (t) { setLesson(t.title); setSubjectId(t.subjectId && data.subjects.some(s => s.id === t.subjectId) ? t.subjectId : ''); }
  };

  const doPreview = (e: FormEvent) => {
    e.preventDefault();
    if (!lesson.trim()) return setError('اكتب اسم الدرس أو اختر مهمة.');
    if (!subjectId || !data.subjects.some(s => s.id === subjectId)) return setError('اختر المادة؛ المراجعة تحتاج إلى مادة.');
    const base = new Date(baseAt);
    if (!baseAt || Number.isNaN(base.getTime())) return setError('حدّد تاريخ البداية ووقتها بشكل صحيح.');
    const parsed = parseIntervals(intervals);
    if (typeof parsed === 'string') return setError(parsed);
    const draft: ReviewDraft = { lesson: lesson.trim(), subjectId, sourceTaskId: source || undefined, baseAt: base.toISOString(), intervals: parsed };
    try {
      const now = Date.now();
      const items = previewReviews(draft).filter(it => new Date(it.dueAt).getTime() > now && !preserved.some(t => t.reviewOffsetDays === it.offsetDays || t.dueAt === it.dueAt));
      if (!items.length) return setError('لا توجد مراجعات مقبلة جديدة بهذه الفواصل؛ كل المواعيد ماضية أو محفوظة. اختر بداية أو فواصل لاحقة.');
      setPreview({ draft, items }); setError('');
      trackReviewEvent('spaced_review_previewed', items.length);
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذّر حساب المواعيد.'); }
  };

  const confirm = async () => {
    if (!preview || busy) return;
    if (preview.items.some(item => new Date(item.dueAt).getTime() <= Date.now())) {
      setPreview(null); setError('مرّ أحد مواعيد المعاينة. عاين المواعيد مجددًا قبل الحفظ.'); return;
    }
    setBusy(true); setError('');
    try {
      await saveReviewPlan(preview.draft, plan?.id);
      trackReviewEvent(plan ? 'spaced_review_updated' : 'spaced_review_saved', preview.items.length);
      await onSaved(plan ? 'حُدّثت المراجعات القادمة للخطة.' : `أُضيفت ${preview.items.length} مراجعات إلى خطتك.`);
    }
    catch (err) { setError(err instanceof Error ? err.message : 'تعذّر حفظ خطة المراجعة. لم يتغير شيء.'); setBusy(false); }
  };

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div className="modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title">
      <h3 id="review-dialog-title">{plan ? 'تعديل خطة المراجعة' : 'خطة مراجعة جديدة'}</h3>
      <form onSubmit={doPreview} noValidate>
        <div className="form-grid">
          <div className="field-wrap span-2"><label htmlFor="review-source">من مهمة موجودة (اختياري)</label>
            <select id="review-source" className="select" data-testid="select-review-source" value={source} onChange={e => pickSource(e.target.value)}>
              <option value="">درس أكتبه بنفسي</option>{candidates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
            {sourceMissing && <small className="quiet" data-testid="text-review-source-missing">حُذفت المهمة الأصلية لهذه الخطة، فصار الدرس مكتوبًا يدويًا.</small>}</div>
          <div className="field-wrap span-2"><label htmlFor="review-lesson">الدرس</label>
             <input id="review-lesson" className="field" maxLength={120} data-testid="input-review-lesson" value={lesson} onChange={e => edit(setLesson)(e.target.value)} placeholder="مثال: قوانين نيوتن" /></div>
          <div className="field-wrap"><label htmlFor="review-subject">المادة (مطلوبة)</label>
            <select id="review-subject" className="select" data-testid="select-review-subject" value={subjectId} onChange={e => edit(setSubjectId)(e.target.value)} aria-required="true">
              <option value="">اختر مادة</option>{data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            {!data.subjects.length && <small className="quiet">أضف مادة أولًا من صفحة المواد.</small>}</div>
          <div className="field-wrap"><label htmlFor="review-base">موعد البداية</label>
            <input id="review-base" type="datetime-local" className="field" data-testid="input-review-base" value={baseAt} onChange={e => edit(setBaseAt)(e.target.value)} /></div>
          <div className="field-wrap span-2"><label htmlFor="review-intervals">بعد كم يوم من البداية؟</label>
            <input id="review-intervals" className="field" inputMode="numeric" data-testid="input-review-intervals" value={intervals} onChange={e => edit(setIntervals)(e.target.value)} aria-describedby="review-intervals-hint" />
            <small id="review-intervals-hint" className="quiet">كل رقم يُحسب من موعد البداية نفسه، لا من المراجعة السابقة. تُقبل الأرقام العربية والفواصل.</small></div>
        </div>
        {plan && preserved.length > 0 && <p className="review-note" data-testid="text-review-preserved">ستبقى {preserved.length} مراجعات مكتملة أو متأخرة كما هي، ولن تتكرر أيامها.</p>}
        {plan && <p className="review-note">تتغير فقط المراجعات القادمة غير المكتملة. تبقى المراجعات المكتملة والمتأخرة ومهامك العادية كما هي.</p>}
        {error && <div className="review-message failed" role="alert" data-testid="text-review-error">{error}</div>}
        {preview && <div className="review-preview" data-testid="list-review-preview"><strong>المراجعات القادمة التي ستُنشأ ({preview.items.length})</strong>
          <ol>{preview.items.map((it, i) => <li key={i} data-testid={`text-review-preview-${i}`}><span className="review-offset">بعد {it.offsetDays} يوم</span>{fmt(it.dueAt)}</li>)}</ol>
          <small className="quiet">المواعيد الماضية لا تُنشأ. راجع المواعيد ثم أكّد الحفظ. أي تعديل في الحقول يلغي هذه المعاينة.</small></div>}
        <div className="form-actions">
          {preview ? <button type="button" className="btn" disabled={busy} data-testid="button-confirm-review" onClick={() => void confirm()}>{busy ? 'جارٍ الحفظ...' : 'تأكيد وحفظ'}</button>
            : <button type="submit" className="btn" data-testid="button-preview-review">معاينة المواعيد</button>}
          <button type="button" className="btn ghost" disabled={busy} data-testid="button-close-review" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </div>
  </div>;
}

function CancelDialog({ plan, count, onClose, onDone }: { plan: ReviewPlan; count: number; onClose: () => void; onDone: (text: string, error?: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  useDialogKeyboard(() => { if (!busy) onClose(); });
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await cancelReviewPlan(plan.id);
      trackReviewEvent('spaced_review_cancelled', count);
      await onDone(`أُلغيت خطة «${plan.lesson}» وحُذفت مراجعاتها القادمة.`);
    }
    catch (e) { await onDone(e instanceof Error ? e.message : 'تعذّر إلغاء الخطة. لم يتغير شيء.', true); setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="cancel-review-title" aria-describedby="cancel-review-desc">
      <h3 id="cancel-review-title">إلغاء خطة «{plan.lesson}»؟</h3>
      <p id="cancel-review-desc" className="quiet" style={{ lineHeight: 1.9 }}>{count ? `ستُحذف ${count} مراجعات قادمة غير مكتملة فقط.` : 'لا مراجعات قادمة لهذه الخطة؛ سيُوقف الإلغاء الخطة فقط لتتمكن من إنشاء خطة جديدة للدرس لاحقًا.'} تبقى المراجعات المكتملة والمتأخرة ومهامك العادية دون تغيير.</p>
      <div className="form-actions">
        <button className="btn danger" disabled={busy} data-testid="button-confirm-cancel-review" onClick={() => void run()}>{busy ? 'جارٍ الإلغاء...' : 'نعم، ألغِ الخطة'}</button>
        <button className="btn ghost" disabled={busy} data-testid="button-keep-review" onClick={onClose}>الإبقاء عليها</button>
      </div>
    </div>
  </div>;
}
