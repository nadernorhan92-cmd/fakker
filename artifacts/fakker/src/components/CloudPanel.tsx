import { useState } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/react';
import { Link } from 'wouter';
import { mergeStudyData, readGuestPlan } from '@/lib/study-db';
import { synchronize } from '@/lib/cloud-sync';
import type { Conflict } from '@/lib/plan-merge';

export default function CloudPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [consent, setConsent] = useState(false);
  const [copyConsent, setCopyConsent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [choices, setChoices] = useState<Record<string, 'local' | 'cloud'>>({});
  const run = async (upload: boolean) => {
    if (busy || (upload && !consent)) return;
    setBusy(true); setMessage(''); setError(false);
    try {
      const result = await synchronize(upload, choices);
      setConflicts(result.conflicts);
      if (result.conflicts.length) setMessage('توجد نسخ مختلفة. راجع التفاصيل واختر لكل سجل، ثم اضغط الإجراء نفسه مجددًا. لم تُحفظ تغييرات.');
      else {
        setChoices({}); await onChanged();
        setMessage(upload ? `اكتملت المزامنة الآن (${new Date().toLocaleTimeString('ar')}). اضغط «مزامنة الآن» بعد أي تعديلات جديدة.` : 'استُعيدت النسخة السحابية مع الاحتفاظ بتعديلاتك المحلية غير المتعارضة. لم نرفع أي بيانات.');
      }
    } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'تعذّرت المزامنة.'); }
    finally { setBusy(false); }
  };
  return <section className="card cloud-panel" aria-labelledby="cloud-title">
    <h3 id="cloud-title">حسابك والمزامنة السحابية الاختيارية</h3>
    {!isSignedIn ? <>
      <p className="quiet">خطتك محفوظة على هذا المتصفح فقط. سجّل الدخول لاستعادتها على أجهزتك. تسجيل الدخول وحده لا يرفع بياناتك.</p>
      <Link className="btn small" href="/sign-in">تسجيل الدخول</Link>{' '}
      <Link className="btn soft small" href="/sign-up">إنشاء حساب</Link>
    </> : <>
      <p>الحساب الحالي: <bdi>{user?.primaryEmailAddress?.emailAddress ?? 'حسابك الدراسي'}</bdi></p>
      <p className="quiet">هذه مساحة حسابك المنفصلة. تبقى خطتك القديمة في وضع «دون حساب». المزامنة يدوية، وتشمل المواد والمهام فقط؛ إعدادات الاسم والإشعارات تبقى على الجهاز. يمكنك العمل محليًا دون مزامنة.</p>
      <label className="cloud-consent"><input type="checkbox" checked={copyConsent} disabled={busy || copied} onChange={e => setCopyConsent(e.target.checked)}/> أؤكد أن خطة هذا المتصفح القديمة تخصني، وأوافق على نسخها إلى مساحة حسابي المحلية. لن تُرفع الآن.</label>
      <button className="btn soft small" disabled={!copyConsent || busy || copied} onClick={async () => {
        setBusy(true); setError(false);
        try {
          const guest = await readGuestPlan();
          // New IDs distinguish the guest copy from pre-existing account records.
          const prefix = 'guest-';
          const result = await mergeStudyData({
            subjects: guest.subjects.map(s => ({ ...s, id: prefix + s.id })),
            tasks: guest.tasks.map(t => ({ ...t, id: prefix + t.id, subjectId: t.subjectId ? prefix + t.subjectId : undefined })),
          });
          setCopied(true); await onChanged();
          setMessage(`نُسخت ${result.subjects} مواد و${result.tasks} مهام محليًا دون حذف الأصل. لم تُرفع البيانات.`);
        } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'تعذّر النسخ.'); }
        finally { setBusy(false); }
      }}>نسخ خطتي القديمة دون رفع</button>
      <label className="cloud-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)}/> أوافق على رفع مواد ومهام مساحة حسابي إلى الخادم، ودمجها مع خطة حسابي، بما في ذلك الحذف والتعديلات التي اخترتها.</label>
      <div className="cloud-actions">
        <button className="btn small" disabled={!consent || busy} onClick={() => void run(true)}>مزامنة الآن</button>
        <button className="btn soft small" disabled={busy} onClick={() => void run(false)}>استعادة من السحابة دون رفع</button>
        <button className="btn soft small" disabled={busy} onClick={() => void signOut({ redirectUrl: import.meta.env.BASE_URL })}>تسجيل الخروج</button>
      </div>
      <p className="quiet">لن تُرفع تعديلاتك تلقائيًا. عند تسجيل الخروج تبقى نسخة حسابك محليًا وتُخفى عن وضع «دون حساب». إلغاء الموافقة يترك العمل محليًا، ولا يحذف النسخة السحابية.</p>
      {conflicts.map(c => <fieldset className="cloud-conflict" key={c.key}>
        <legend>تعارض: {c.name}</legend>
        <div className="cloud-versions">
          <div><strong>هذا الجهاز</strong><pre dir="rtl">{describe(c.local)}</pre></div>
          <div><strong>السحابة</strong><pre dir="rtl">{describe(c.cloud)}</pre></div>
        </div>
        <label><input type="radio" name={c.key} checked={choices[c.key] === 'local'} onChange={() => setChoices({ ...choices, [c.key]: 'local' })}/> الاحتفاظ بنسخة الجهاز</label>{' '}
        <label><input type="radio" name={c.key} checked={choices[c.key] === 'cloud'} onChange={() => setChoices({ ...choices, [c.key]: 'cloud' })}/> الاحتفاظ بنسخة السحابة</label>
      </fieldset>)}
    </>}
    {busy && <p role="status">جارٍ تنفيذ العملية… لا تغلق الصفحة.</p>}
    {message && <p role={error ? 'alert' : 'status'} style={{ color: error ? '#a64949' : undefined }}>{message}</p>}
  </section>;
}

const names: Record<string, string> = { id: 'المعرّف', name: 'المادة', teacher: 'المعلم', color: 'اللون', description: 'التفاصيل', title: 'المهمة', subjectId: 'معرّف المادة', type: 'النوع', dueAt: 'الموعد', priority: 'الأولوية', status: 'الحالة', completedAt: 'وقت الإنجاز', reminderAt: 'التذكير', studyStart: 'بداية المذاكرة', studyEnd: 'نهاية المذاكرة' };
const values: Record<string, string> = { homework: 'واجب', study: 'مذاكرة', project: 'مشروع', exam: 'امتحان', low: 'منخفضة', medium: 'متوسطة', high: 'عالية', 'not-started': 'لم تبدأ', 'in-progress': 'قيد التنفيذ', completed: 'مكتملة' };
function describe(record: Conflict['local']) {
  if (!record) return 'محذوفة';
  return Object.entries(record).filter(([k, v]) => k !== 'id' && v !== undefined).map(([k, v]) => `${names[k] ?? k}: ${values[String(v)] ?? v}`).join('\n');
}
