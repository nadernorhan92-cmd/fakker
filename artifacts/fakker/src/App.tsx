import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  BookOpen, CalendarDays, ChartNoAxesCombined, Check, CheckCheck, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, LayoutDashboard, ListTodo, Plus, Search, Settings2,
  Sparkles, Bell, Pencil, Trash2, X, Sun, FolderOpen, ArrowUpRight, AlarmClock,
} from 'lucide-react';
import {
  clearStudyData, deleteSubject, deleteTask, id, loadStudyData, saveSettings, saveSubject, saveTask,
  type Priority, type Settings, type StudyData, type Subject, type Task, type TaskStatus, type TaskType,
} from '@/lib/study-db';
import NotFound from '@/pages/not-found';
import BackupPanel from '@/components/BackupPanel';
import CloudPanel from '@/components/CloudPanel';
import AuthProvider from '@/components/AuthProvider';
import AccountWorkspace from '@/components/AccountWorkspace';
import { SignIn, SignUp } from '@clerk/react';
import { useDialogKeyboard } from '@/hooks/use-dialog-keyboard';
import ReminderPanel from '@/components/ReminderPanel';
import StudyArt from '@/components/StudyArt';
import FocusTimer from '@/components/FocusTimer';
import SpacedReviewPanel from '@/components/SpacedReviewPanel';
import { getDueReminders, reminderKey, reminderTime } from '@/lib/reminders';
import { useFocusSessions } from '@/lib/use-focus-sessions';
import { focusRange, localDayKey, summarizeFocus, type FocusPeriod } from '@/lib/focus-statistics';

import BackgroundReminders from '@/components/BackgroundReminders';
import { syncBackgroundReminders, withReminderLock } from '@/lib/background-reminders';

const palette = ['#a75e43', '#aa7b3c', '#7b8050', '#b47868', '#bd8d4c', '#8b6952', '#bd7650'];
const nav = [
  { href: '/', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/subjects', label: 'المواد', icon: BookOpen },
  { href: '/tasks', label: 'المهام', icon: ListTodo },
  { href: '/calendar', label: 'التقويم', icon: CalendarDays },
  { href: '/statistics', label: 'إحصاءاتي', icon: ChartNoAxesCombined },
  { href: '/settings', label: 'الإعدادات', icon: Settings2 },
];
const typeLabel: Record<TaskType, string> = { homework: 'واجب', study: 'مذاكرة', project: 'مشروع', exam: 'امتحان' };
const statusLabel: Record<TaskStatus, string> = { 'not-started': 'لم تبدأ', 'in-progress': 'قيد التنفيذ', completed: 'مكتملة' };
const priorityLabel: Record<Priority, string> = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية' };
const todayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const fmtDate = (value?: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  value ? new Intl.DateTimeFormat('ar', opts).format(new Date(value)) : '';
const dateInput = (value?: string) => {
  if (!value) return '';
  const d = new Date(value); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,16);
};
const dueDate = (value: string) => new Date(value).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' });

function Workspace() {
  const [location, setLocation] = useLocation();
  const [data, setData] = useState<StudyData>({ subjects: [], tasks: [], settings: { studentName: '', notificationsEnabled: false, reminderLeadMinutes: 30 } });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState<{text:string; error?:boolean} | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [reminderIds, setReminderIds] = useState<string[]>([]);
  const [taskModal, setTaskModal] = useState<Task | 'new' | null>(null);
  const [subjectModal, setSubjectModal] = useState<Subject | 'new' | null>(null);
  const [deleteModal, setDeleteModal] = useState<{kind:'task'|'subject'; item:Task|Subject} | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ subject: '', status: '', priority: '' });
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'month'|'week'>('month');
  const [settingsDraft, setSettingsDraft] = useState<Settings>(data.settings);
  const notifiedReminders = useRef(new Set<string>());
  const [taskPresetDate, setTaskPresetDate] = useState<string | undefined>();
  const refresh = async () => { setLoadError(''); try { const fresh = await loadStudyData(); setData(fresh); setSettingsDraft(fresh.settings); } catch (e) { setLoadError(e instanceof Error ? e.message : 'تعذّر تحميل بياناتك.'); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  const say = (text:string, error=false) => {
    window.clearTimeout(toastTimer.current);
    setToast({text,error});
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => {
    const reconcile = () => { void withReminderLock(() => loadStudyData().then(syncBackgroundReminders)).catch(e => say(e instanceof Error ? e.message : 'تعذّرت مزامنة التذكيرات.', true)); };
    reconcile();
    window.addEventListener('online', reconcile);
    window.addEventListener('focus', reconcile);
    return () => { window.removeEventListener('online', reconcile); window.removeEventListener('focus', reconcile); };
  }, []);
  const subjectById = (sid?:string) => data.subjects.find(s => s.id === sid);
  const tasks = useMemo(() => [...data.tasks].sort((a,b)=>new Date(a.dueAt).getTime()-new Date(b.dueAt).getTime()), [data.tasks]);
  const goNewTask = (date?:string) => { setTaskPresetDate(typeof date==='string'?date:undefined); setTaskModal('new'); };
  const upsertTask = async (task:Task) => { try { await saveTask(task); await refresh(); setTaskModal(null); say(task.id && data.tasks.some(t=>t.id===task.id) ? 'حُفظت تعديلات المهمة.' : 'أُضيفت المهمة إلى خطتك.'); } catch(e) { say(e instanceof Error ? e.message : 'تعذّر حفظ المهمة.', true); } };
  const removeTask = async (task:Task) => { try { await deleteTask(task.id); await refresh(); setDeleteModal(null); say('حُذفت المهمة.'); } catch(e) { say(e instanceof Error ? e.message : 'تعذّر حذف المهمة، حاول مرة أخرى.', true); } };
  const transitionTask = async (task:Task) => { const status:TaskStatus = task.status === 'completed' ? 'not-started' : 'completed'; try { await saveTask({...task,status}); await refresh(); say(status === 'completed' ? 'أحسنت، أُنجزت المهمة!' : 'أُعيدت المهمة إلى قائمتك.'); } catch { say('تعذّر تحديث حالة المهمة.', true); } };
  const removeSubject = async (subject:Subject) => {
    try {
      const linked = data.tasks.filter(t=>t.subjectId===subject.id);
      await deleteSubject(subject.id);
      setFilters(current=>current.subject===subject.id?{...current,subject:''}:current);
      await refresh(); setDeleteModal(null); say(linked.length ? `حُذفت المادة وفُصلت عنها ${linked.length} مهام دون حذفها.` : 'حُذفت المادة.');
    } catch { say('تعذّر حذف المادة. لم تُحذف المهام المرتبطة بها.', true); }
  };
  const changeStatus = async (task:Task, status:TaskStatus) => { try { await saveTask({...task,status}); await refresh(); say(`تم تحديث حالة المهمة إلى «${statusLabel[status]}».`); } catch { say('تعذّر تحديث الحالة.',true); } };
  const persistSettings = async (next:Settings) => { try { await saveSettings(next); setSettingsDraft(next); await refresh(); say('حُفظت إعداداتك على هذا الجهاز.'); } catch(e) { say(e instanceof Error ? e.message : 'تعذّر حفظ الإعدادات.',true); } };
  useEffect(() => {
    if (!data.settings.notificationsEnabled) return;
    const check = () => {
      const now = Date.now();
      const due = getDueReminders(data.tasks, data.settings.reminderLeadMinutes, notifiedReminders.current, now);
      if (due.length) {
        setReminderIds(current=>[...new Set([...current,...due.map(task=>task.id)])]);
        say(`حان وقت التذكير: ${due.map(t => `«${t.title}»`).join('، ')}.`);
        for (const task of due) {
          notifiedReminders.current.add(reminderKey(task, data.settings.reminderLeadMinutes));
        }
      }
    };
    check();
    const timer = window.setInterval(check, 15_000);
    const resume = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', resume);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, [data.tasks, data.settings.notificationsEnabled, data.settings.reminderLeadMinutes]);
  const pageTitle = nav.find(n=>n.href===location)?.label ?? 'فَكّر';
  useEffect(() => { document.title = `${pageTitle} | فَكّر`; }, [pageTitle]);
  const children = loading ? <main className="main-area"><div className="topbar"/><div className="page"><div className="card" style={{height:180,background:'linear-gradient(90deg,#fff 25%,#f5f2fa 38%,#fff 60%)',backgroundSize:'300% 100%',animation:'shimmer 1.4s infinite'}} aria-label="جارٍ تحميل بياناتك"/></div></main>
    : loadError ? <main className="main-area"><div className="topbar"/><div className="page"><div className="empty"><div className="empty-mark"><CircleHelp size={20}/></div><strong>تعذّر فتح مساحتك</strong><p>{loadError}</p><button className="btn small" data-testid="button-retry-load" onClick={()=>{setLoading(true);void refresh();}}>إعادة المحاولة</button></div></div></main>
    : <main className="main-area">
      <header className="topbar"><div className="topbar-date">{fmtDate(new Date().toISOString())}</div><div className="topbar-user"><div className="avatar">{(data.settings.studentName || 'ط').slice(0,1)}</div><div><strong data-testid="text-student-name">{data.settings.studentName || 'مساحتك الدراسية'}</strong><small>{pageTitle} · فَكّر</small></div></div></header>
      {data.settings.notificationsEnabled&&<ReminderPanel tasks={data.tasks.filter(task=>reminderIds.includes(task.id)&&task.status!=='completed'&&reminderTime(task,data.settings.reminderLeadMinutes)<=Date.now())} onOpen={task=>setTaskModal(task)} onDismiss={taskId=>setReminderIds(current=>current.filter(value=>value!==taskId))}/>}
      <FocusTimer tasks={tasks}/>
      <Switch>
        <Route path="/"><Dashboard data={data} tasks={tasks} subjectById={subjectById} onAdd={goNewTask} onComplete={transitionTask}/></Route>
        <Route path="/subjects"><SubjectsPage data={data} onAdd={()=>setSubjectModal('new')} onEdit={s=>setSubjectModal(s)} onDelete={s=>setDeleteModal({kind:'subject',item:s})} onShowTasks={id=>{setFilters({subject:id,status:'',priority:''});setQuery('');setLocation('/tasks');}}/></Route>
        <Route path="/tasks"><SpacedReviewPanel data={data} onChanged={refresh}/><TasksPage data={data} tasks={tasks} filters={filters} setFilters={setFilters} query={query} setQuery={setQuery} onAdd={goNewTask} onEdit={t=>setTaskModal(t)} onDelete={t=>setDeleteModal({kind:'task',item:t})} onComplete={transitionTask} onStatus={changeStatus}/></Route>
        <Route path="/calendar"><CalendarPage data={data} tasks={tasks} selected={selectedDate} setSelected={setSelectedDate} cursor={monthCursor} setCursor={setMonthCursor} view={calendarView} setView={setCalendarView} onAdd={date=>goNewTask(date)} onEdit={t=>setTaskModal(t)} onComplete={transitionTask}/></Route>
        <Route path="/statistics"><StatisticsPage data={data} tasks={tasks}/></Route>
        <Route path="/settings"><SettingsPage settings={settingsDraft} onSave={persistSettings} onImported={refresh}/></Route>
        <Route component={NotFound}/>
      </Switch>
    </main>;
  return <div className="app-shell" dir="rtl">
    <aside className="sidebar"><Link href="/" className="brand"><span className="brand-mark"><Sparkles size={20}/></span><span><h1>فَكّر</h1><small>خطوة صغيرة، يوم أوضح</small></span></Link><div className="nav-label">مساحتك الدراسية</div><nav className="nav-list">{nav.map(item=><NavItem key={item.href} {...item} active={location===item.href}/>)}</nav><div className="sidebar-note"><strong>خُذها على مهل</strong>كل مهمة تنجزها تقرّبك من أسبوع أخفّ.</div></aside>
    {children}
    <nav className="mobile-nav" aria-label="التنقل الرئيسي">{nav.map(item=><NavItem key={item.href} {...item} active={location===item.href}/>)}</nav>
    {taskModal && <TaskDialog initial={taskModal==='new'?undefined:taskModal} defaultDue={taskPresetDate} subjects={data.subjects} remindersEnabled={data.settings.notificationsEnabled} onClose={()=>setTaskModal(null)} onSave={upsertTask}/>}
    {subjectModal && <SubjectDialog initial={subjectModal==='new'?undefined:subjectModal} onClose={()=>setSubjectModal(null)} onSave={async s=>{try{await saveSubject(s);await refresh();setSubjectModal(null);say(data.subjects.some(x=>x.id===s.id)?'حُفظت تعديلات المادة.':'أُضيفت المادة إلى قائمتك.');}catch{say('تعذّر حفظ المادة.',true);}}}/>}
    {deleteModal && <ConfirmDialog title={deleteModal.kind==='task'?'حذف المهمة؟':'حذف المادة؟'} message={deleteModal.kind==='subject'?'ستبقى مهام هذه المادة محفوظة، لكن ستُفصل عنها ولن تُحذف. هل تريد المتابعة؟':'لا يمكن التراجع عن حذف هذه المهمة.'} onCancel={()=>setDeleteModal(null)} onConfirm={()=>deleteModal.kind==='task'?removeTask(deleteModal.item as Task):removeSubject(deleteModal.item as Subject)}/>}
    {toast && <div className={`toast ${toast.error?'error':''}`} role="status" data-testid="status-toast">{toast.text}</div>}
  </div>;
}
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function App() {
  return <WouterRouter base={basePath}><AuthProvider><Switch>
    <Route path="/sign-in/*?"><main className="auth-page" dir="rtl"><Link href="/settings">العودة إلى فَكّر دون رفع بيانات</Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/></main></Route>
    <Route path="/sign-up/*?"><main className="auth-page" dir="rtl"><Link href="/settings">العودة إلى فَكّر دون رفع بيانات</Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/></main></Route>
    <Route><AccountWorkspace><Workspace/></AccountWorkspace></Route>
  </Switch></AuthProvider></WouterRouter>;
}
function NavItem({href,label,icon:Icon,active}:{href:string;label:string;icon:typeof LayoutDashboard;active:boolean}) { return <Link href={href} className={`nav-link ${active?'active':''}`} data-testid={`link-nav-${href==='/'?'home':href.slice(1)}`} aria-label={label} title={label} aria-current={active?'page':undefined}><Icon size={19} aria-hidden="true"/><span>{label}</span></Link>; }
function Head({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:ReactNode}){return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>}
function Empty({title,description,action}:{title:string;description:string;action?:React.ReactNode}) {return <div className="empty"><div className="empty-mark"><FolderOpen size={20}/></div><strong>{title}</strong><p>{description}</p>{action&&<div style={{marginTop:15}}>{action}</div>}</div>}
function Dashboard({data,tasks,subjectById,onAdd,onComplete}:{data:StudyData;tasks:Task[];subjectById:(id?:string)=>Subject|undefined;onAdd:()=>void;onComplete:(t:Task)=>void}) {
  const today = tasks.filter(t=>todayKey(new Date(t.dueAt))===todayKey());
  const completed=today.filter(t=>t.status==='completed').length;
  const completedToday=tasks.filter(t=>t.status==='completed'&&t.completedAt&&todayKey(new Date(t.completedAt))===todayKey()).length;
  const nextExam=tasks.find(t=>t.type==='exam'&&t.status!=='completed'&&new Date(t.dueAt)>=new Date());
  const progress=tasks.length?Math.round(tasks.filter(t=>t.status==='completed').length/tasks.length*100):0;
  const firstName=data.settings.studentName.trim().split(/\s+/)[0];
  return <div className="page"><Head eyebrow="مساحة هادئة لأسبوعك" title={firstName?`أهلًا ${firstName}، لنرتّب يومك`:'أهلًا بك في فَكّر'} description="خطوات صغيرة وواضحة، تصنع فرقًا كبيرًا." action={<button className="btn" data-testid="button-add-task" onClick={onAdd}><Plus size={17}/> مهمة جديدة</button>}/>
    <section className="hero-card" data-testid="card-daily-hero"><div><h3>تحدّي اليوم</h3><p>{today.length?`أمامك ${today.length-completed} من ${today.length} مهام اليوم.`:'لا مهام لليوم بعد، ابدأ بخطوة صغيرة.'}</p><div className="hero-meta"><span>{fmtDate(new Date().toISOString(),{weekday:'long',day:'numeric',month:'long'})}</span><span>إنجازك {progress}٪</span></div></div><StudyArt className="hero-art"/></section>
    <div className="grid stats-grid">
      <Stat title="مهام اليوم" value={today.length} sub="ما ينتظرك اليوم" icon={<Sun size={17}/>}/>
      <Stat title="أُنجزت اليوم" value={completedToday} sub="حسب تاريخ إكمال المهمة" icon={<CheckCheck size={17}/>}/>
      <Stat title="متبقية اليوم" value={today.length-completed} sub="على مهل، لديك وقت" icon={<Clock3 size={17}/>}/>
      <Stat title="إنجازك الكلي" value={`${progress}٪`} sub={`${tasks.filter(t=>t.status==='completed').length} مهمة مكتملة`} icon={<ChartNoAxesCombined size={17}/>}/>
    </div>
    <div className="grid dashboard-grid"><section className="card"><div className="section-head"><h3>خطة اليوم</h3><Link href="/tasks" className="text-link">كل المهام <ChevronLeft size={14}/></Link></div>
      {today.length?<div className="task-list">{today.map(t=><TaskRow key={t.id} task={t} subject={subjectById(t.subjectId)} onComplete={()=>onComplete(t)}/>)}</div>:<Empty title="يومك يبدأ من هنا" description="لا توجد مهام مقررة لليوم. أضف واحدة صغيرة لتبدأ بإيقاعك." action={<button className="btn soft small" onClick={onAdd} data-testid="button-empty-add-task"><Plus size={15}/> أضف مهمة</button>}/>}</section>
      <div className="grid"><section className="card exam-card"><div className="exam-label"><AlarmClock size={15} style={{verticalAlign:'middle',marginLeft:6}}/> الاختبار القادم</div>{nextExam?<><h3>{nextExam.title}</h3><p>{subjectById(nextExam.subjectId)?.name||'دون مادة'} · {fmtDate(nextExam.dueAt)}</p><div className="exam-count">{Math.max(0,Math.ceil((new Date(nextExam.dueAt).getTime()-Date.now())/86400000))} يوم متبقٍ</div></>:<><h3>لا اختبارات قريبة</h3><p>حين تضيف موعد اختبار، ستجده هنا.</p></>}</section>
      <section className="card"><div className="section-head"><h3>إنجازك حتى الآن</h3><span className="quiet">{progress}٪</span></div><p className="quiet">كل خطوة تُحتسب، حتى الصغيرة منها.</p><div className="progress-wrap"><div className="progress-fill" style={{width:`${progress}%`}}/></div><div style={{display:'flex',justifyContent:'space-between',marginTop:9}}><span className="quiet">{tasks.filter(t=>t.status==='completed').length} مكتملة</span><span className="quiet">{tasks.length} إجمالي</span></div></section></div>
    </div>
  </div>;
}
function Stat({title,value,sub,icon}:{title:string;value:string|number;sub:string;icon:ReactNode}){return <div className="card stat-card"><div style={{display:'flex',justifyContent:'space-between',position:'relative',zIndex:1}}><span className="stat-title">{title}</span><span style={{color:'#8577b9'}}>{icon}</span></div><div className="stat-number" data-testid={`stat-${title}`}>{value}</div><div className="stat-sub">{sub}</div></div>}
function TaskRow({task,subject,onComplete,compact=false}:{task:Task;subject?:Subject;onComplete:()=>void;compact?:boolean}) {
  const overdue=task.status!=='completed'&&new Date(task.dueAt).getTime()<Date.now();
  return <div className={`task-row ${overdue?'task-overdue':''} ${task.status==='completed'?'is-complete':''}`} data-testid={`row-task-${task.id}`}>
    <button className={`check-btn ${task.status==='completed'?'done':''}`} aria-label={task.status==='completed'?'إعادة فتح المهمة':'إنجاز المهمة'} data-testid={`button-complete-${task.id}`} onClick={event=>{event.stopPropagation();onComplete();}}>{task.status==='completed'&&<Check size={14}/>}</button>
    <div className="task-info"><strong>{task.title}</strong><small>{subject&&<><span className="subject-dot" style={{background:subject.color}}/>{subject.name} · </>}{task.reviewPlanId?'مراجعة متباعدة':typeLabel[task.type]}{compact&&<> · {dueDate(task.dueAt)}</>}{overdue&&<span className="overdue-label"> · متأخرة</span>}</small></div>
    {!compact&&<span className="task-date">{fmtDate(task.dueAt,{day:'numeric',month:'short'})} · {dueDate(task.dueAt)}</span>}
    <span className={`pill ${task.status==='completed'?'completed':task.priority}`}>{task.status==='completed'?'مكتملة':priorityLabel[task.priority]}</span>
  </div>;
}

function SubjectsPage({data,onAdd,onEdit,onDelete,onShowTasks}:{data:StudyData;onAdd:()=>void;onEdit:(s:Subject)=>void;onDelete:(s:Subject)=>void;onShowTasks:(id:string)=>void}) {
  return <div className="page"><Head eyebrow="موادك في مكان واحد" title="المواد الدراسية" description="نظّم المواد، وستبقى مهامك مرتبطة بها." action={<button className="btn" data-testid="button-add-subject" onClick={onAdd}><Plus size={17}/> مادة جديدة</button>}/>
    {data.subjects.length?<div className="grid subject-grid">{data.subjects.map(s=>{
      const count=data.tasks.filter(t=>t.subjectId===s.id).length;
      return <article className="card subject-card" key={s.id} data-testid={`card-subject-${s.id}`} onClick={event=>{
        if (!(event.target as HTMLElement).closest('button,a')) onShowTasks(s.id);
      }}>
        <div className="subject-top"><span className="subject-color" style={{background:`${s.color}20`,color:s.color}}><BookOpen size={19}/></span>
          <div><button className="icon-btn" aria-label={`تعديل مادة ${s.name}`} data-testid={`button-edit-subject-${s.id}`} onClick={()=>onEdit(s)}><Pencil size={16}/></button><button className="icon-btn" aria-label={`حذف مادة ${s.name}`} data-testid={`button-delete-subject-${s.id}`} onClick={()=>onDelete(s)}><Trash2 size={16}/></button></div>
        </div>
        <h3><button className="subject-title" data-testid={`button-open-subject-${s.id}`} aria-label={`عرض مهام وامتحانات ${s.name}`} onClick={()=>onShowTasks(s.id)}>{s.name}</button></h3>
        <p>{s.teacher||'دون اسم معلم'} · {count} مهام</p>
        {s.description&&<p style={{marginTop:10,lineHeight:1.7}}>{s.description}</p>}
        <div className="subject-actions"><button className="btn soft small" data-testid={`button-view-subject-tasks-${s.id}`} onClick={()=>onShowTasks(s.id)}>عرض المهام <ArrowUpRight size={14}/></button></div>
      </article>;
    })}</div>:<Empty title="لم تضف موادك بعد" description="ابدأ بإضافة مادة أو اثنتين، ثم اربط بهما مهامك." action={<button className="btn small" data-testid="button-empty-add-subject" onClick={onAdd}><Plus size={15}/> إضافة مادة</button>}/>}
  </div>;
}

function TasksPage({data,tasks,filters,setFilters,query,setQuery,onAdd,onEdit,onDelete,onComplete,onStatus}:{data:StudyData;tasks:Task[];filters:{subject:string;status:string;priority:string};setFilters:(f:{subject:string;status:string;priority:string})=>void;query:string;setQuery:(q:string)=>void;onAdd:()=>void;onEdit:(t:Task)=>void;onDelete:(t:Task)=>void;onComplete:(t:Task)=>void;onStatus:(t:Task,s:TaskStatus)=>void}) {
  const [reviewOnly,setReviewOnly]=useState(false);
  const filtered=tasks.filter(t=>(!reviewOnly||Boolean(t.reviewPlanId))&&(!query||t.title.toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar'))||t.description?.includes(query))&&(!filters.subject||t.subjectId===filters.subject)&&(!filters.status||t.status===filters.status)&&(!filters.priority||t.priority===filters.priority));
  const set=(key:'subject'|'status'|'priority',value:string)=>setFilters({...filters,[key]:value});
  const hasFilters=Boolean(query||filters.subject||filters.status||filters.priority||reviewOnly);
  return <div className="page"><Head eyebrow="كل ما يشغل بالك، صار مرتبًا" title="قائمة المهام" description="ابحث، صفِّ، ورتّب أولوياتك كما يناسبك." action={<button className="btn" data-testid="button-add-task-list" onClick={onAdd}><Plus size={17}/> أضف مهمة</button>}/>
    <div className="filters"><label style={{display:'flex',alignItems:'center',gap:8,flex:'1',minWidth:220}}><Search size={17} color="#9089a2"/><input className="field search" placeholder="ابحث عن مهمة..." aria-label="ابحث عن مهمة" data-testid="input-search-tasks" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <select className="select" aria-label="تصفية حسب المادة" data-testid="select-filter-subject" value={filters.subject} onChange={e=>set('subject',e.target.value)}><option value="">كل المواد</option>{data.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select className="select" aria-label="تصفية حسب الحالة" data-testid="select-filter-status" value={filters.status} onChange={e=>set('status',e.target.value)}><option value="">كل الحالات</option>{Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
      <select className="select" aria-label="تصفية حسب الأولوية" data-testid="select-filter-priority" value={filters.priority} onChange={e=>set('priority',e.target.value)}><option value="">كل الأولويات</option>{Object.entries(priorityLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
      <label className="quiet" style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" data-testid="filter-reviews-only" checked={reviewOnly} onChange={e=>setReviewOnly(e.target.checked)}/> المراجعات المتباعدة فقط</label>
      {hasFilters&&<button className="btn soft small" data-testid="button-reset-filters" onClick={()=>{setQuery('');setReviewOnly(false);setFilters({subject:'',status:'',priority:''});}}><X size={14}/> مسح البحث والتصفية</button>}
    </div>
    {filtered.length?<div className="card">
      <div className="section-head"><h3>المهام القادمة</h3><span className="quiet">{filtered.length} مهمة · الأقرب موعدًا أولًا</span></div>
      <div className="task-list">{filtered.map(t=><div key={t.id}>
        <TaskRow task={t} subject={data.subjects.find(s=>s.id===t.subjectId)} onComplete={()=>onComplete(t)}/>
        <div className="task-controls">
          <select className="select" aria-label={`حالة ${t.title}`} data-testid={`select-status-${t.id}`} value={t.status} onChange={e=>onStatus(t,e.target.value as TaskStatus)}>{Object.entries(statusLabel).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select>
          <button className="icon-btn" aria-label="تعديل المهمة" data-testid={`button-edit-task-${t.id}`} onClick={()=>onEdit(t)}><Pencil size={15}/></button>
          <button className="icon-btn" aria-label="حذف المهمة" data-testid={`button-delete-task-${t.id}`} onClick={()=>onDelete(t)}><Trash2 size={15}/></button>
        </div>
      </div>)}</div>
    </div>:<Empty title={tasks.length?'لا توجد نتائج مطابقة':'قائمتك تنتظر أول مهمة'} description={tasks.length?'جرّب تغيير كلمات البحث أو الفلاتر.':'أضف واجبًا أو جلسة مذاكرة، وسنرتّبها حسب موعدها.'} action={tasks.length?undefined:<button className="btn small" data-testid="button-empty-add-task-list" onClick={onAdd}><Plus size={15}/> أضف أول مهمة</button>}/>}
  </div>;
}

function CalendarPage({data,tasks,selected,setSelected,cursor,setCursor,view,setView,onAdd,onEdit,onComplete}:{data:StudyData;tasks:Task[];selected:string;setSelected:(s:string)=>void;cursor:Date;setCursor:(d:Date)=>void;view:'month'|'week';setView:(v:'month'|'week')=>void;onAdd:(date?:string)=>void;onEdit:(t:Task)=>void;onComplete:(t:Task)=>void}) {
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const start=new Date(first); start.setDate(1-first.getDay());
  const weekStart=new Date(`${selected}T12:00:00`); weekStart.setDate(weekStart.getDate()-weekStart.getDay());
  const days=Array.from({length:view==='month'?42:7},(_,i)=>{const d=new Date(view==='week'?weekStart:start);d.setDate(d.getDate()+i);return d;});
  const picked=tasks.filter(t=>todayKey(new Date(t.dueAt))===selected);
  const sessions=tasks.filter(t=>t.studyStart&&t.studyEnd&&todayKey(new Date(t.studyStart))===selected).sort((a,b)=>new Date(a.studyStart!).getTime()-new Date(b.studyStart!).getTime());
  const studyMinutes=sessions.reduce((sum,t)=>sum+Math.max(0,(new Date(t.studyEnd!).getTime()-new Date(t.studyStart!).getTime())/60000),0);
  const shift=(n:number)=>{const d=view==='week'?new Date(`${selected}T12:00:00`):new Date(cursor.getFullYear(),cursor.getMonth()+n,1);if(view==='week')d.setDate(d.getDate()+7*n);setCursor(d);setSelected(todayKey(d));};
  return <div className="page"><Head eyebrow="خطتك على امتداد الأيام" title="التقويم" description="شاهد مواعيدك وجلسات مذاكرتك في صورة أوضح." action={<button className="btn" data-testid="button-calendar-add-task" onClick={()=>onAdd(selected)}><Plus size={17}/> أضف موعدًا</button>}/>
    <div className="calendar-layout"><section className="card"><div className="calendar-toolbar">
      <button className="icon-btn" aria-label={view==='week'?'الأسبوع السابق':'الشهر السابق'} data-testid="button-calendar-prev" onClick={()=>shift(-1)}><ChevronRight/></button>
      <div className="calendar-month">{view==='week'?`${fmtDate(days[0].toISOString(),{day:'numeric',month:'short'})} — ${fmtDate(days[6].toISOString(),{day:'numeric',month:'short',year:'numeric'})}`:new Intl.DateTimeFormat('ar',{month:'long',year:'numeric'}).format(cursor)}</div>
      <button className="icon-btn" aria-label={view==='week'?'الأسبوع التالي':'الشهر التالي'} data-testid="button-calendar-next" onClick={()=>shift(1)}><ChevronLeft/></button>
      <div className="view-toggle"><button className={view==='month'?'active':''} aria-pressed={view==='month'} data-testid="button-calendar-month" onClick={()=>setView('month')}>شهري</button><button className={view==='week'?'active':''} aria-pressed={view==='week'} data-testid="button-calendar-week" onClick={()=>setView('week')}>أسبوعي</button></div>
      <button className="btn soft small" data-testid="button-calendar-today" onClick={()=>{const now=new Date();setCursor(now);setSelected(todayKey(now));}}>اليوم</button>
    </div>
      <div className="calendar-days">{['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'].map(n=><div className="day-name" key={n}>{n}</div>)}{days.map(d=>{const key=todayKey(d);const dayTasks=tasks.filter(t=>todayKey(new Date(t.dueAt))===key||(t.studyStart&&todayKey(new Date(t.studyStart))===key));return <button key={key} className={`day-cell ${d.getMonth()!==cursor.getMonth()?'outside':''} ${key===selected?'selected':''} ${key===todayKey()?'today':''}`} aria-label={`اختيار ${fmtDate(d.toISOString())}`} aria-pressed={key===selected} data-testid={`button-calendar-day-${key}`} onClick={()=>{setSelected(key);setCursor(new Date(`${key}T12:00:00`));}}><span className="day-num">{new Intl.NumberFormat('ar').format(d.getDate())}</span><span className="day-dots">{dayTasks.slice(0,4).map(t=><i key={t.id} className="day-dot" style={{background:data.subjects.find(s=>s.id===t.subjectId)?.color||palette[0]}}/>)}</span></button>})}</div>
    </section><aside className="card day-detail"><div className="section-head"><div><div className="eyebrow">تفاصيل اليوم</div><h3 style={{marginTop:6}}>{fmtDate(`${selected}T12:00:00`,{weekday:'long',day:'numeric',month:'long'})}</h3></div><button className="btn soft small" data-testid="button-add-selected-day" onClick={()=>onAdd(selected)}><Plus size={14}/> مهمة</button></div>
      {studyMinutes>0&&<div className="pill" style={{display:'inline-flex',alignItems:'center',gap:6,marginBottom:13}}><Clock3 size={13}/> وقت المذاكرة: {Math.floor(studyMinutes/60)} س {Math.round(studyMinutes%60)} د</div>}
      {sessions.length>0&&<section style={{marginBottom:18}} aria-label="جدول المذاكرة اليومي"><h3>جلسات المذاكرة</h3>{sessions.map(t=><button key={t.id} className="task-row" style={{width:'100%',textAlign:'right'}} data-testid={`schedule-task-${t.id}`} onClick={()=>onEdit(t)}><Clock3 size={16}/><span className="task-info"><strong>{t.title}</strong><small>{dueDate(t.studyStart!)} — {dueDate(t.studyEnd!)}</small></span></button>)}</section>}
      {picked.length?<div className="task-list">{picked.map(t=><div key={t.id} onClick={()=>onEdit(t)} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onEdit(t);}}} role="button" tabIndex={0} data-testid={`calendar-task-${t.id}`}><TaskRow task={t} subject={data.subjects.find(s=>s.id===t.subjectId)} onComplete={()=>onComplete(t)} compact/></div>)}</div>:!sessions.length&&<Empty title="هذا اليوم متّسع" description="لا توجد مواعيد هنا بعد. مساحة جميلة لتبدأ بهدوء."/>}
    </aside></div>
  </div>;
}

function StatisticsPage({data,tasks}:{data:StudyData;tasks:Task[]}) {
  const { sessions, loading: sessionsLoading, error: sessionsError, clearSessions } = useFocusSessions();
  const [focusPeriod,setFocusPeriod]=useState<FocusPeriod>('week');
  const [customRange,setCustomRange]=useState(()=>focusRange('week',{start:'',end:''})!);
  const range=focusRange(focusPeriod,customRange);
  const focus=summarizeFocus(sessions,range);
  const periodLabel=focusPeriod==='all'?'كل السجل':focusPeriod==='week'?'آخر ٧ أيام':focusPeriod==='month'?'آخر ٣٠ يومًا':'الفترة المخصصة';
  const [confirmClearSessions,setConfirmClearSessions]=useState(false);
  const [clearSessionsError,setClearSessionsError]=useState('');
  const [sessionsCleared,setSessionsCleared]=useState(false);
  const removeSessions=async()=>{
    setClearSessionsError('');
    try {
      await clearSessions();
      setConfirmClearSessions(false);
      setSessionsCleared(true);
    } catch {
      setClearSessionsError('تعذّر مسح سجل التركيز. لم يكتمل الحذف؛ حاول مرة أخرى.');
    }
  };
  const complete=tasks.filter(t=>t.status==='completed').length;
  const overdue=tasks.filter(t=>t.status!=='completed'&&new Date(t.dueAt)<new Date()).length;
  const pct=tasks.length?Math.round(complete/tasks.length*100):0;
  const week=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const key=todayKey(d);return {day:new Intl.DateTimeFormat('ar',{weekday:'short'}).format(d),count:tasks.filter(t=>t.status==='completed'&&t.completedAt&&todayKey(new Date(t.completedAt))===key).length};});
  const max=Math.max(1,...week.map(d=>d.count));
  const top=data.subjects.map(s=>({subject:s,count:tasks.filter(t=>t.subjectId===s.id&&t.status==='completed').length})).sort((a,b)=>b.count-a.count).slice(0,5);
  const totalFocusMs=focus.totalMs;
  const focusHours=totalFocusMs/3600000;
  const focusNumber=new Intl.NumberFormat('ar',{maximumFractionDigits:1});
  const focusDays=focus.days;
  const byTask=focus.tasks;
  const recentSessions=focus.sessions;
  const durationLabel=(ms:number)=>{
    const minutes=Math.round(ms/60000);
    return `${focusNumber.format(Math.floor(minutes/60))} س ${focusNumber.format(minutes%60)} د`;
  };
  return <div className="page"><Head eyebrow="التقدّم لا يُقاس بالكمال" title="إحصاءاتي" description="نظرة هادئة على ما أنجزته والوقت الذي خصصته."/>
    <section className="card" style={{marginBottom:19}} aria-label="فترة إحصاءات التركيز">
      <div className="section-head"><h3>فترة التركيز</h3><span className="quiet">تؤثر في وقت التركيز وملخصاته وسجله فقط</span></div>
      <div className="filters">
        <div className="field-wrap"><label htmlFor="focus-period">الفترة الزمنية</label><select id="focus-period" className="select" data-testid="select-focus-period" value={focusPeriod} onChange={event=>setFocusPeriod(event.target.value as FocusPeriod)}>
          <option value="week">آخر ٧ أيام</option><option value="month">آخر ٣٠ يومًا</option><option value="custom">فترة مخصصة</option><option value="all">كل السجل</option>
        </select></div>
        {focusPeriod==='custom'&&<>
          <div className="field-wrap"><label htmlFor="focus-start">من تاريخ</label><input id="focus-start" className="field" type="date" data-testid="input-focus-start" value={customRange.start} max={customRange.end||localDayKey(new Date())} aria-invalid={!!focus.error} aria-describedby={focus.error?'focus-range-error':undefined} onChange={event=>setCustomRange(value=>({...value,start:event.target.value}))}/></div>
          <div className="field-wrap"><label htmlFor="focus-end">إلى تاريخ</label><input id="focus-end" className="field" type="date" data-testid="input-focus-end" value={customRange.end} min={customRange.start} aria-invalid={!!focus.error} aria-describedby={focus.error?'focus-range-error':undefined} onChange={event=>setCustomRange(value=>({...value,end:event.target.value}))}/></div>
        </>}
      </div>
      {focus.error?<p id="focus-range-error" className="ft-error" role="alert">{focus.error}</p>:<p className="quiet" role="status" data-testid="text-focus-range">{periodLabel}{range?`: ${fmtDate(`${range.start}T12:00:00`,{day:'numeric',month:'short',year:'numeric'})} — ${fmtDate(`${range.end}T12:00:00`,{day:'numeric',month:'short',year:'numeric'})}`:''} · حسب يوم إكمال الجلسة بالتوقيت المحلي، شاملًا يوم البداية والنهاية.</p>}
      <p className="quiet">تغيير الفترة لا يحذف أي جلسة. سجل التركيز محلي فقط ولا يُرفع للسحابة أو يدخل في النسخة الاحتياطية.</p>
    </section>
    <div className="grid stats-grid"><Stat title="مهام مكتملة" value={complete} sub="إنجازات تستحق التقدير" icon={<CheckCheck size={17}/>}/><Stat title="نسبة الإكمال" value={`${pct}٪`} sub={`من ${tasks.length} مهام مسجلة`} icon={<ChartNoAxesCombined size={17}/>}/><Stat title="مهام متأخرة" value={overdue} sub={overdue?'رتّب موعدها من قائمة المهام':'أنت على المسار'} icon={<AlarmClock size={17}/>}/><Stat title="وقت التركيز المسجّل" value={sessionsLoading?'…':sessionsError||focus.error?'—':`${focusNumber.format(focusHours)} س`} sub={sessionsLoading?'جارٍ تحميل السجل':sessionsError?'تعذّر تحميل سجل الجلسات':focus.error?'اختر فترة صحيحة':`${focus.sessions.length} جلسة مكتملة · ${periodLabel}`} icon={<Clock3 size={17}/>}/></div>
    {sessionsError&&<p className="ft-error" role="alert" data-testid="text-focus-sessions-error">{sessionsError}</p>}
    <div className="grid dashboard-grid"><section className="card"><div className="section-head"><h3>إنجازات آخر سبعة أيام</h3><span className="quiet">حسب تاريخ الإكمال</span></div><div className="chart" role="img" aria-label="مخطط المهام المكتملة خلال الأسبوع"><div className="chart-bars">{week.map((d,i)=><div className="chart-col" key={`${d.day}-${i}`}><span className="chart-value">{d.count||''}</span><div className="bar-stack"><div className="bar" style={{height:`${Math.max(3,(d.count/max)*100)}%`}}/></div><span className="chart-label">{d.day}</span></div>)}</div></div></section>
      <section className="card"><div className="section-head"><h3>موادك النشطة</h3><BookOpen size={17} color="#8374b8"/></div>{top.length&&top.some(x=>x.count)?<div className="task-list">{top.filter(x=>x.count>0).map(({subject,count})=><div className="task-row" key={subject.id}><span className="subject-dot" style={{background:subject.color,width:12,height:12}}/><div className="task-info"><strong>{subject.name}</strong><small>{count} مهام مكتملة</small></div><span className="pill completed">{count}</span></div>)}</div>:<Empty title="كل إنجاز يبدأ بخطوة" description="أكمل مهمة مرتبطة بمادة لتظهر هنا."/>}</section>
    </div>
    <div className="grid dashboard-grid" style={{marginTop:19}}>
      <section className="card"><div className="section-head"><h3>وقت التركيز حسب اليوم</h3><span className="quiet">{periodLabel} · الأيام ذات الجلسات فقط</span></div>
        {focus.error?<p className="quiet">اختر فترة صحيحة لعرض الملخص.</p>:sessionsError?<p className="quiet">تعذّر عرض الملخص اليومي.</p>:sessionsLoading?<p className="quiet">جارٍ تحميل سجل الجلسات…</p>:focusDays.length?<div className="task-list">{focusDays.map(day=><div className="task-row" key={day.key}><div className="task-info"><strong>{fmtDate(`${day.key}T12:00:00`,{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</strong><small>{day.count} جلسة مكتملة</small></div><span className="pill">{durationLabel(day.totalMs)}</span></div>)}</div>:<Empty title="لا توجد جلسات في هذه الفترة" description="اختر فترة أخرى أو أكمل جلسة تركيز لتظهر هنا."/>}
      </section>
      <section className="card"><div className="section-head"><h3>وقت التركيز حسب المهمة</h3><span className="quiet">{byTask.length} مهام</span></div>
        {focus.error?<p className="quiet">اختر فترة صحيحة لعرض الملخص.</p>:sessionsError?<p className="quiet">تعذّر عرض الملخص حسب المهمة.</p>:sessionsLoading?<p className="quiet">جارٍ تحميل سجل الجلسات…</p>:byTask.length?<div className="task-list">{byTask.map(({taskId,count,totalMs})=>{
          const task=tasks.find(item=>item.id===taskId);
          return <div className="task-row" key={taskId??'__unassigned__'}><div className="task-info"><strong>{taskId===null?'دون مهمة محددة':task?.title??'مهمة محذوفة'}</strong><small>{count} جلسة مكتملة</small></div><span className="pill">{durationLabel(totalMs)}</span></div>;
        })}</div>:<Empty title="لا توجد بيانات لعرضها" description="اربط جلسة بمهمة اختياريًا لتظهر ضمن هذا الملخص."/>}
      </section>
    </div>
    <section className="card" style={{marginTop:19}}><div className="section-head"><h3>سجل جلسات التركيز</h3><span className="quiet">محفوظ محليًا لهذا الحساب أو مساحة الضيف فقط</span></div>
      <p className="quiet">المعروض: {periodLabel}. مسح السجل يحذف جميع الجلسات، بما فيها الجلسات خارج الفترة المختارة، من هذا الجهاز لهذه المساحة فقط، ولا يحذف خطتك أو يوقف المؤقّت الحالي.</p>
      <button className="btn danger small" data-testid="button-clear-focus-sessions" disabled={sessionsLoading||(!sessionsError&&sessions.length===0)} onClick={()=>{setClearSessionsError('');setSessionsCleared(false);setConfirmClearSessions(true);}}><Trash2 size={14}/> مسح سجل التركيز المحلي</button>
      {sessionsCleared&&<p role="status" data-testid="text-focus-sessions-cleared">مُسح سجل التركيز المحلي. بقيت خطتك وإعداداتك دون تغيير.</p>}
      {focus.error?<p className="quiet">اختر فترة صحيحة لعرض السجل.</p>:sessionsError?<p className="quiet">تعذّر قراءة سجل الجلسات.</p>:sessionsLoading?<p className="quiet">جارٍ تحميل سجل الجلسات…</p>:recentSessions.length?<div className="task-list">{recentSessions.map(session=>{
        const task=session.taskId?tasks.find(item=>item.id===session.taskId):undefined;
        const completedAt=new Date(session.completedAt);
        return <div className="task-row" key={session.id} data-testid={`row-focus-session-${session.id}`}><Clock3 size={16}/><div className="task-info"><strong>{session.taskId===null?'دون مهمة محددة':task?.title??'مهمة محذوفة'}</strong><small>{fmtDate(completedAt.toISOString(),{weekday:'short',day:'numeric',month:'short'})} · {completedAt.toLocaleTimeString('ar',{hour:'numeric',minute:'2-digit'})}</small></div><span className="pill completed">{durationLabel(session.durationMs)}</span></div>;
      })}</div>:<Empty title="لا توجد جلسات في هذه الفترة" description="اختر كل السجل لعرض الجلسات الأخرى. تُسجّل جلسات التركيز المكتملة فقط."/>}
    </section>
    {confirmClearSessions&&<ConfirmDialog title="مسح سجل التركيز المحلي؟" message="ستُحذف نهائيًا جميع جلسات التركيز المسجّلة على هذا الجهاز للحساب الحالي أو مساحة الضيف الحالية فقط. لن تُحذف المواد أو المهام أو خطط المراجعة أو الإعدادات، ولن يتوقف المؤقّت الحالي أو يتأثر سجل أي حساب آخر. لا يمكن التراجع عن هذا الحذف." error={clearSessionsError} onCancel={()=>setConfirmClearSessions(false)} onConfirm={removeSessions}/>}
  </div>;
}

function SettingsPage({settings,onSave,onImported}:{settings:Settings;onSave:(s:Settings)=>Promise<void>;onImported:()=>Promise<void>}) {
  const [name,setName]=useState(settings.studentName);
  const [lead,setLead]=useState(String(settings.reminderLeadMinutes));
  useEffect(()=>{setName(settings.studentName);setLead(String(settings.reminderLeadMinutes));},[settings]);
  return <div className="page"><Head eyebrow="مساحتك، بطريقتك" title="الإعدادات" description="تفضيلاتك محفوظة في هذا المتصفح وعلى هذا الجهاز."/>
    <CloudPanel onChanged={onImported}/>
    <section className="card setting-card">
      <div className="setting-row"><div className="setting-copy"><strong>اسمك في فَكّر</strong><small>يظهر الاسم في ترحيبك ومساحتك الشخصية.</small></div><div style={{display:'flex',gap:8}}><input className="field" aria-label="اسم الطالب" data-testid="input-student-name" maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="اكتب اسمك"/><button className="btn small" data-testid="button-save-name" onClick={()=>void onSave({...settings,studentName:name.trim(),reminderLeadMinutes:Number(lead)||30})}>حفظ</button></div></div>
      <div className="setting-row"><div className="setting-copy"><strong>تذكيرات داخل التطبيق</strong><small>اعرض تنبيهًا عند حلول موعد التذكير أثناء فتح فَكّر، دون الحاجة إلى إذن المتصفح. إيقاف هذا الخيار يوقف أيضًا جدولة إشعارات الخلفية دون إلغاء الاشتراك.</small></div><button className={`switch ${settings.notificationsEnabled?'on':''}`} role="switch" aria-checked={settings.notificationsEnabled} aria-label="تفعيل التذكيرات" data-testid="switch-notifications" onClick={()=>void onSave({...settings,notificationsEnabled:!settings.notificationsEnabled})}><span/></button></div>
      <BackgroundReminders onUpdated={onImported}/>
      <div className="setting-row"><div className="setting-copy"><strong>مهلة التذكير</strong><small>المدة التي تسبق الموعد. فعّل التذكيرات ثم اختر ما يناسبك.</small></div><select className="select" aria-label="مهلة التذكير بالدقائق" data-testid="select-reminder-lead" value={lead} onChange={e=>{setLead(e.target.value);void onSave({...settings,reminderLeadMinutes:Number(e.target.value)});}}><option value="10">١٠ دقائق</option><option value="30">٣٠ دقيقة</option><option value="60">ساعة</option><option value="1440">يوم واحد</option></select></div>
      <div className="setting-row"><div className="setting-copy"><strong>خصوصية بياناتك</strong><small>خطتك محفوظة محليًا في IndexedDB. تسجيل الدخول اختياري، ورفع المواد والمهام لا يحدث إلا بموافقتك وضغط «مزامنة الآن». لكل حساب مساحة منفصلة. تذكيرات الخلفية خدمة مستقلة: عند تفعيلها تُحفظ عناوين المهام ومواعيدها واشتراك المتصفح على الخادم؛ تُحذف عند إلغائها، وتُنظّف المواعيد المنتهية خلال يوم. حذف بيانات الموقع مباشرة لا يلغي الاشتراك؛ ألغِه من هنا أولًا.</small></div><span className="pill completed">تحكّم ببياناتك</span></div>
      <div className="setting-row"><div className="setting-copy"><strong>تحديث التذكيرات وإلغاؤها</strong><small>عند تفعيل الخلفية، يلزم الإنترنت لتعديل مهمة أو حذفها أو إكمالها أو تغيير مهلة تذكيرها، كي نؤكّد تحديث الموعد على الخادم قبل الحفظ. إلغاء الخلفية لا يوقف التذكيرات داخل التطبيق.</small></div><span className="pill">معلومة</span></div>
      <BackupPanel onImported={onImported}/>
      <div className="setting-row"><div className="setting-copy"><strong>حذف النسخة المحلية لهذه المساحة</strong><small>يحذف المواد والمهام والتفضيلات من مساحة الحساب الحالي أو وضع «دون حساب» فقط. لا يحذف النسخة السحابية أو بيانات الحسابات الأخرى؛ يمكنك استعادة السحابة لاحقًا.</small></div><button className="btn danger small" data-testid="button-clear-data" onClick={async()=>{if(window.confirm('هل تريد حذف النسخة المحلية لهذه المساحة؟ لن تُحذف السحابة أو مساحات الحسابات الأخرى. لا يمكن التراجع عن حذف بيانات محلية لم تزامنها.')){try{await clearStudyData();await onSave({studentName:'',notificationsEnabled:false,reminderLeadMinutes:30});window.location.reload();}catch{window.alert('تعذّر حذف البيانات.');}}}}><Trash2 size={14}/> حذف النسخة المحلية</button></div>
    </section>
  </div>;
}

function TaskDialog({initial,defaultDue,subjects,remindersEnabled,onClose,onSave}:{initial?:Task;defaultDue?:string;subjects:Subject[];remindersEnabled:boolean;onClose:()=>void;onSave:(t:Task)=>void|Promise<void>}) {
  useDialogKeyboard(onClose);
  const [title,setTitle]=useState(initial?.title||'');
  const [description,setDescription]=useState(initial?.description||'');
  const [subjectId,setSubjectId]=useState(initial?.subjectId||'');
  const [type,setType]=useState<TaskType>(initial?.type||'homework');
  const [dueAt,setDueAt]=useState(dateInput(initial?.dueAt)||(defaultDue?`${defaultDue}T10:00`:dateInput(new Date(Date.now()+3600000).toISOString())));
  const [priority,setPriority]=useState<Priority>(initial?.priority||'medium');
  const [status,setStatus]=useState<TaskStatus>(initial?.status||'not-started');
  const [reminderAt,setReminderAt]=useState(dateInput(initial?.reminderAt));
  const [studyStart,setStudyStart]=useState(dateInput(initial?.studyStart));
  const [studyEnd,setStudyEnd]=useState(dateInput(initial?.studyEnd));
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    if(saving)return;
    if(!title.trim()){setError('اكتب عنوان المهمة أولًا.');return;}
    if(!dueAt||!Number.isFinite(Date.parse(dueAt))){setError('اختر موعدًا صالحًا للمهمة.');return;}
    if(reminderAt&&(!Number.isFinite(Date.parse(reminderAt))||new Date(reminderAt)>new Date(dueAt))){setError('موعد التذكير يجب ألا يكون بعد موعد المهمة.');return;}
    if(Boolean(studyStart)!==Boolean(studyEnd)){setError('حدّد وقت بداية المذاكرة ووقت نهايتها معًا.');return;}
    if(studyStart&&studyEnd&&(!Number.isFinite(Date.parse(studyStart))||!Number.isFinite(Date.parse(studyEnd))||new Date(studyEnd)<=new Date(studyStart))){setError('وقت نهاية المذاكرة يجب أن يكون بعد بدايتها.');return;}
    setError('');setSaving(true);
    try { await onSave({...initial,id:initial?.id||id(),title:title.trim(),description:description.trim()||undefined,subjectId:subjectId||undefined,type,dueAt:new Date(dueAt).toISOString(),priority,status,reminderAt:reminderAt?new Date(reminderAt).toISOString():undefined,studyStart:studyStart?new Date(studyStart).toISOString():undefined,studyEnd:studyEnd?new Date(studyEnd).toISOString():undefined}); }
    finally {setSaving(false);}
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h3 id="task-dialog-title">{initial?'تعديل المهمة':'مهمة جديدة'}</h3><button className="icon-btn" aria-label="إغلاق" data-testid="button-close-task-dialog" onClick={onClose}><X/></button></div>
    <form onSubmit={submit}><div className="form-grid">
      <div className="field-wrap span-2"><label htmlFor="task-title">عنوان المهمة *</label><input id="task-title" className="field" autoFocus maxLength={120} required placeholder="مثل: مراجعة الفصل الثالث" data-testid="input-task-title" value={title} onChange={e=>setTitle(e.target.value)}/></div>
      <div className="field-wrap span-2"><label htmlFor="task-description">تفاصيل (اختياري)</label><textarea id="task-description" className="textarea" maxLength={500} placeholder="أضف ملاحظة تساعدك عند البدء..." data-testid="input-task-description" value={description} onChange={e=>setDescription(e.target.value)}/></div>
      <div className="field-wrap"><label htmlFor="task-type">نوع المهمة</label><select id="task-type" className="select" data-testid="select-task-type" value={type} onChange={e=>setType(e.target.value as TaskType)}>{Object.entries(typeLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
      <div className="field-wrap"><label htmlFor="task-subject">المادة</label><select id="task-subject" className="select" data-testid="select-task-subject" value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">دون مادة</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div className="field-wrap"><label htmlFor="task-due">الموعد *</label><input id="task-due" className="field" type="datetime-local" required data-testid="input-task-due" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></div>
      <div className="field-wrap"><label htmlFor="task-priority">الأولوية</label><select id="task-priority" className="select" data-testid="select-task-priority" value={priority} onChange={e=>setPriority(e.target.value as Priority)}>{Object.entries(priorityLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
      <div className="field-wrap"><label htmlFor="task-status">الحالة</label><select id="task-status" className="select" data-testid="select-task-status" value={status} onChange={e=>setStatus(e.target.value as TaskStatus)}>{Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
      <div className="field-wrap"><label htmlFor="task-reminder">تذكير في (اختياري)</label><input id="task-reminder" className="field" type="datetime-local" aria-describedby="task-reminder-hint" data-testid="input-task-reminder" value={reminderAt} onChange={e=>setReminderAt(e.target.value)}/><small id="task-reminder-hint" className="quiet">{remindersEnabled?'اتركه فارغًا لاستخدام مهلة التذكير المحددة في الإعدادات.':'التذكيرات متوقفة حاليًا؛ فعّل «تذكيرات داخل التطبيق» من الإعدادات لتلقيها.'}</small></div>
      <div className="field-wrap"><label htmlFor="study-start">بداية المذاكرة (اختياري)</label><input id="study-start" className="field" type="datetime-local" data-testid="input-study-start" value={studyStart} onChange={e=>setStudyStart(e.target.value)}/></div>
      <div className="field-wrap"><label htmlFor="study-end">نهاية المذاكرة (اختياري)</label><input id="study-end" className="field" type="datetime-local" data-testid="input-study-end" value={studyEnd} onChange={e=>setStudyEnd(e.target.value)}/></div>
    </div>{error&&<p role="alert" style={{color:'#a64949',fontSize:12}}>{error}</p>}<div className="form-actions"><button type="button" className="btn soft" data-testid="button-cancel-task" onClick={onClose}>إلغاء</button><button type="submit" className="btn" disabled={saving} data-testid="button-save-task">{saving?'جارٍ الحفظ…':initial?'حفظ التعديلات':'إضافة المهمة'}</button></div></form>
  </section></div>;
}

function SubjectDialog({initial,onClose,onSave}:{initial?:Subject;onClose:()=>void;onSave:(s:Subject)=>void|Promise<void>}) {
  useDialogKeyboard(onClose);
  const [name,setName]=useState(initial?.name||'');const [teacher,setTeacher]=useState(initial?.teacher||'');const [description,setDescription]=useState(initial?.description||'');const [color,setColor]=useState(initial?.color||palette[0]);const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [subjectId]=useState(()=>initial?.id||id());
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    if(saving)return;
    if(!name.trim()){setError('اكتب اسم المادة.');return;}
    setError('');setSaving(true);
    try { await onSave({id:subjectId,name:name.trim(),teacher:teacher.trim()||undefined,description:description.trim()||undefined,color}); }
    catch { setError('تعذّر حفظ المادة. حاول مرة أخرى.'); }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)onClose();}}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="subject-dialog-title">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3 id="subject-dialog-title">{initial?'تعديل المادة':'إضافة مادة'}</h3>
        <button className="icon-btn" disabled={saving} aria-label="إغلاق" data-testid="button-close-subject-dialog" onClick={onClose}><X/></button>
      </div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field-wrap span-2"><label htmlFor="subject-name">اسم المادة *</label><input id="subject-name" className="field" autoFocus required maxLength={80} placeholder="مثل: الرياضيات" data-testid="input-subject-name" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="field-wrap span-2"><label htmlFor="subject-teacher">اسم المعلم (اختياري)</label><input id="subject-teacher" className="field" maxLength={80} placeholder="اسم المعلم" data-testid="input-subject-teacher" value={teacher} onChange={e=>setTeacher(e.target.value)}/></div>
          <div className="field-wrap span-2"><label htmlFor="subject-description">وصف (اختياري)</label><textarea id="subject-description" className="textarea" maxLength={300} placeholder="ما الذي تريد تذكره عن هذه المادة؟" data-testid="input-subject-description" value={description} onChange={e=>setDescription(e.target.value)}/></div>
          <div className="field-wrap span-2"><label>لون المادة</label><div className="color-options">{palette.map((c,index)=><button key={c} type="button" aria-label={`اختيار اللون ${index+1}`} aria-pressed={c===color} className={`color-choice ${c===color?'selected':''}`} style={{background:c}} data-testid={`button-subject-color-${c.slice(1)}`} onClick={()=>setColor(c)}/>)}</div></div>
        </div>
        {error&&<p role="alert" style={{color:'#a64949',fontSize:12}}>{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn soft" disabled={saving} data-testid="button-cancel-subject" onClick={onClose}>إلغاء</button>
          <button type="submit" className="btn" disabled={saving} data-testid="button-save-subject">{saving?'جارٍ الحفظ…':initial?'حفظ التعديلات':'إضافة المادة'}</button>
        </div>
      </form>
    </section>
  </div>;
}
function ConfirmDialog({title,message,error,onCancel,onConfirm}:{title:string;message:string;error?:string;onCancel:()=>void;onConfirm:()=>void|Promise<void>}) {
  const [busy,setBusy]=useState(false);
  useDialogKeyboard(()=>{if(!busy)onCancel();});
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onCancel();}}><section className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" style={{maxWidth:420}}><h3 id="confirm-title">{title}</h3><p id="confirm-message" className="quiet" style={{fontSize:13,lineHeight:1.9}}>{message}</p>{error&&<p className="ft-error" role="alert">{error}</p>}<div className="form-actions"><button className="btn soft" disabled={busy} data-testid="button-cancel-delete" onClick={onCancel}>تراجع</button><button className="btn danger" disabled={busy} data-testid="button-confirm-delete" onClick={async()=>{if(busy)return;setBusy(true);try{await onConfirm();}finally{setBusy(false);}}}>{busy?'جارٍ الحذف…':'نعم، احذف'}</button></div></section></div>;
}

export default App;
