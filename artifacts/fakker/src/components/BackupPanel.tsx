import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload, ShieldCheck } from 'lucide-react';
import { loadStudyData, mergeStudyData } from '@/lib/study-db';
import { makeBackup, parseBackup, type StudyBackup } from '@/lib/backup';

export default function BackupPanel({ onImported }: { onImported: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<StudyBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const report = (text: string, failed = false) => { setMessage(text); setError(failed); };
  const download = async () => {
    setBusy(true);
    try {
      const data = await loadStudyData();
      const backup = makeBackup(data.subjects, data.tasks);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `fakker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      report('جُهّزت النسخة للتحميل. احتفظ بها في مكان آمن؛ قد تحتوي على ملاحظاتك الشخصية.');
    } catch { report('تعذّر تجهيز النسخة الاحتياطية. حاول مرة أخرى.', true); }
    finally { setBusy(false); }
  };
  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setPending(null); setMessage('');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { report('اختر ملفًا لا يزيد حجمه عن ٥ ميجابايت.', true); return; }
    setBusy(true);
    try { setPending(parseBackup(await file.text())); }
    catch (e) { report(e instanceof Error ? e.message : 'تعذّر قراءة الملف.', true); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await mergeStudyData(pending);
      await onImported();
      setPending(null);
      report(`اكتملت الاستعادة: أُضيفت ${result.subjects} مواد و${result.tasks} مهام. جرى تخطي العناصر الموجودة دون تغييرها.`);
    } catch (e) { report(e instanceof Error ? e.message : 'تعذّرت الاستعادة.', true); }
    finally { setBusy(false); }
  };
  return <section className="backup-panel" aria-labelledby="backup-title">
    <div className="section-head"><h3 id="backup-title"><ShieldCheck size={18}/> نسخة احتياطية لخطتك</h3><span className="pill">على جهازك</span></div>
    <p className="quiet">حمّل موادك ومهامك في ملف، أو استعدها في متصفح آخر. تُضاف العناصر غير الموجودة فقط؛ لن تُحذف بياناتك الحالية أو تُستبدل، ولن تتغير إعدادات الجهاز.</p>
    <div className="backup-actions">
      <button className="btn soft small" data-testid="button-export-backup" disabled={busy} onClick={() => void download()}><Download size={16}/> تحميل نسخة احتياطية</button>
      <button className="btn soft small" data-testid="button-import-backup" disabled={busy} onClick={() => input.current?.click()}><Upload size={16}/> اختيار ملف للاستعادة</button>
      <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label="ملف النسخة الاحتياطية" data-testid="input-backup-file" onChange={event => void selectFile(event)}/>
    </div>
    {pending && <div className="backup-preview" data-testid="backup-preview">
      <strong>تحتوي النسخة على {pending.subjects.length} مواد و{pending.tasks.length} مهام.</strong>
      <p className="quiet">راجعت سلامة الملف. هل تريد إضافة العناصر غير الموجودة إلى خطتك؟</p>
      <div className="backup-actions"><button className="btn small" disabled={busy} data-testid="button-confirm-restore" onClick={() => void restore()}>{busy ? 'جارٍ الاستعادة…' : 'تأكيد الاستعادة'}</button><button className="btn soft small" disabled={busy} onClick={() => setPending(null)}>إلغاء</button></div>
    </div>}
    {message && <p className={`backup-message ${error ? 'failed' : ''}`} role={error ? 'alert' : 'status'} data-testid="status-backup">{message}</p>}
  </section>;
}
