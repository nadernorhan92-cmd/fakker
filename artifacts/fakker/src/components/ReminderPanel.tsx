import { Bell, ChevronLeft, X } from 'lucide-react';
import type { Task } from '@/lib/study-db';

export default function ReminderPanel({ tasks, onOpen, onDismiss }: {
  tasks: Task[]; onOpen: (task: Task) => void; onDismiss: (id: string) => void;
}) {
  if (!tasks.length) return null;
  return <section className="card reminder-panel" aria-labelledby="reminder-panel-title" data-testid="reminder-panel">
    <div className="section-head"><h3 id="reminder-panel-title"><Bell size={18}/> تذكيراتك الآن</h3><span className="pill">{tasks.length} تذكير</span></div>
    <p className="quiet">تبقى هنا حتى تخفيها أو تكمل المهمة. افتح المهمة لمراجعة تفاصيلها.</p>
    <div className="reminder-items">{tasks.map(task => <div className="reminder-item" key={task.id}>
      <button className="reminder-open" data-testid={`button-open-reminder-${task.id}`} onClick={() => onOpen(task)}>
        <span><strong>{task.title}</strong><small>الموعد: {new Intl.DateTimeFormat('ar', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(task.dueAt))}</small></span><ChevronLeft size={16}/>
      </button>
      <button className="icon-btn" aria-label={`إخفاء تذكير ${task.title}`} data-testid={`button-dismiss-reminder-${task.id}`} onClick={() => onDismiss(task.id)}><X size={16}/></button>
    </div>)}</div>
  </section>;
}
