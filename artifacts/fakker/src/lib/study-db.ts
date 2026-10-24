import { backgroundEnabled, disableBackgroundReminders, syncBackgroundReminders, withReminderLock } from './background-reminders';
import { completedFocusSession, initialFocusTimer, transitionTimer, validateFocusTimer, type FocusSession, type FocusTimerState, type TimerAction } from './focus-timer';
import { mergeImportedReviewPlans, planReviewChange, type ReviewDraft, type ReviewPlan } from './spaced-review';

export type TaskType = 'homework' | 'study' | 'project' | 'exam';
export type TaskStatus = 'not-started' | 'in-progress' | 'completed';
export type Priority = 'low' | 'medium' | 'high';
export type Subject = { id: string; name: string; teacher?: string; color: string; description?: string };
export type Task = {
  id: string; title: string; description?: string; subjectId?: string; type: TaskType; dueAt: string;
  priority: Priority; status: TaskStatus; completedAt?: string; reminderAt?: string; studyStart?: string; studyEnd?: string;
  reviewPlanId?: string; reviewOffsetDays?: number;
};
export type Settings = { studentName: string; notificationsEnabled: boolean; reminderLeadMinutes: number };
export type StudyData = { subjects: Subject[]; tasks: Task[]; settings: Settings };
let DB_NAME = 'fakker-study-planner';
let studyAccount: string | null = null;
export const getStudyAccount = () => studyAccount;
// Set once, before mounting the workspace. Account changes reload the document.
export function setStudyAccount(userId: string | null) {
  studyAccount = userId;
  DB_NAME = userId ? `fakker-study-planner-account-${userId}` : 'fakker-study-planner';
}
const DB_VERSION = 1;
const DEFAULT_SETTINGS: Settings = { studentName: '', notificationsEnabled: false, reminderLeadMinutes: 30 };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('المتصفح لا يدعم قاعدة البيانات المحلية.')); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('subjects')) db.createObjectStore('subjects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('تعذّر فتح مساحة الحفظ على هذا الجهاز.'));
  });
}
function transact<T>(store: string, mode: IDBTransactionMode, work: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result: T;
    const req = work(tx.objectStore(store));
    req.onsuccess = () => { result = req.result; };
    req.onerror = () => reject(new Error('لم نتمكن من حفظ التغيير. حاول مرة أخرى.'));
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => reject(new Error('حدث خطأ أثناء تحديث البيانات.'));
    tx.onabort = () => { db.close(); reject(new Error('لم يكتمل حفظ البيانات. حاول مرة أخرى.')); };
  }));
}
const all = <T,>(store: string) => transact<T[]>(store, 'readonly', s => s.getAll());
const put = <T,>(store: string, value: T) => transact<IDBValidKey>(store, 'readwrite', s => s.put(value));
const remove = (store: string, id: string) => transact<undefined>(store, 'readwrite', s => s.delete(id));
// A separate settings record keeps the timer local to this account without
// changing the plan/backup/cloud shape or upgrading the existing database.
export async function updateFocusTimer(action: TimerAction): Promise<{ state: FocusTimerState; sessionRecorded: boolean }> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const timerRequest = store.get('focus-timer');
    let result: FocusTimerState;
    let sessionRecorded = false;
    let cause: unknown;
    timerRequest.onsuccess = () => {
      try {
        const timerRecord = timerRequest.result as { key: string; value: unknown } | undefined;
        const previous = timerRecord ? validateFocusTimer(timerRecord.value) : initialFocusTimer();
        const now = Date.now();
        result = transitionTimer(previous, action, now);
        const isFocusComplete = previous.phase === 'focus' && previous.status === 'running'
          && previous.endsAt !== null && previous.endsAt <= now;
        const completed = isFocusComplete
          ? completedFocusSession(previous, now, crypto.randomUUID())
          : null;
        if (completed) {
          const sessionsRequest = store.get('focus-sessions');
          sessionsRequest.onsuccess = () => {
            try {
              const sessions = validateFocusSessions(sessionsRequest.result?.value);
              if (!sessions.some(session => session.id === completed.id)) {
                store.put({ key: 'focus-sessions', value: [...sessions, completed] });
                sessionRecorded = true;
              }
              if (!timerRecord || result !== previous) store.put({ key: 'focus-timer', value: result });
            } catch (error) { cause = error; tx.abort(); }
          };
        } else if (!timerRecord || result !== previous) {
          store.put({ key: 'focus-timer', value: result });
        }
      } catch (error) { cause = error; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve({ state: result, sessionRecorded }); };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(cause ?? new Error('تعذّر حفظ المؤقّت. أعد المحاولة؛ لم تتغير بيانات خطتك.'));
    };
  });
}

function validateFocusSessions(value: unknown): FocusSession[] {
  if (value === undefined) return [];
  const isFocusSession = (session: unknown): session is FocusSession => {
    if (!session || typeof session !== 'object') return false;
    const candidate = session as Partial<FocusSession>;
    return typeof candidate.id === 'string' && candidate.id.length > 0
      && (candidate.taskId === null || typeof candidate.taskId === 'string')
      && typeof candidate.durationMs === 'number' && Number.isFinite(candidate.durationMs) && candidate.durationMs > 0
      && typeof candidate.completedAt === 'number' && Number.isFinite(candidate.completedAt) && candidate.completedAt > 0;
  };
  if (!Array.isArray(value) || !value.every(isFocusSession)) {
    throw new Error('تعذّرت قراءة سجل جلسات التركيز المحفوظ. لم تتغير بيانات خطتك.');
  }
  return value as FocusSession[];
}

export async function loadFocusSessions(): Promise<FocusSession[]> {
  const record = await transact<{ key: string; value: unknown } | undefined>('settings', 'readonly', store => store.get('focus-sessions'));
  return validateFocusSessions(record?.value);
}
export async function loadStudyData(): Promise<StudyData> {
  const [subjects, tasks, settingsRecord] = await Promise.all([
    all<Subject>('subjects'), all<Task>('tasks'),
    transact<{key:string;value:Settings}|undefined>('settings', 'readonly', s => s.get('main')),
  ]);
  return { subjects, tasks, settings: settingsRecord?.value ?? DEFAULT_SETTINGS };
}
export const saveSubject = (subject: Subject) => withReminderLock(() => put('subjects', subject));
export const deleteSubject = (id: string): Promise<void> => withReminderLock(async () => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['subjects', 'tasks'], 'readwrite');
    const tasks = tx.objectStore('tasks');
    const request = tasks.getAll();
    request.onsuccess = () => {
      for (const task of request.result as Task[]) {
        if (task.subjectId === id) tasks.put({ ...task, subjectId: undefined });
      }
      tx.objectStore('subjects').delete(id);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(new Error('تعذّر حذف المادة، ولم تتغيّر مهامها.')); };
    tx.onerror = () => reject(new Error('تعذّر تحديث المادة والمهام المرتبطة بها.'));
  });
});
export const saveTask = (task: Task) => withReminderLock(async () => {
  if (backgroundEnabled()) {
    const data = await loadStudyData();
    await syncBackgroundReminders({ ...data, tasks: [...data.tasks.filter(t => t.id !== task.id), task] });
  }
  const previous = task.status === 'completed'
    ? await transact<Task | undefined>('tasks', 'readonly', s => s.get(task.id))
    : undefined;
  const completedAt = task.status === 'completed'
    ? task.completedAt ?? (previous?.status === 'completed' ? previous.completedAt : undefined) ?? new Date().toISOString()
    : undefined;
  return put('tasks', { ...task, completedAt });
});
export const deleteTask = (id: string) => withReminderLock(async () => {
  if (backgroundEnabled()) {
    const data = await loadStudyData();
    await syncBackgroundReminders({ ...data, tasks: data.tasks.filter(task => task.id !== id) });
  }
  return remove('tasks', id);
});
export const saveSettings = (settings: Settings) => withReminderLock(async () => {
  if (backgroundEnabled()) {
    const data = await loadStudyData();
    await syncBackgroundReminders({ ...data, settings });
  }
  return put('settings', { key: 'main', value: settings });
});
export const clearStudyData = (): Promise<void> => withReminderLock(async () => {
  if (backgroundEnabled()) await disableBackgroundReminders();
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['subjects', 'tasks', 'settings'], 'readwrite');
    for (const store of ['subjects', 'tasks', 'settings']) tx.objectStore(store).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(new Error('تعذّر حذف البيانات، ولم تُحفظ تغييرات جزئية.')); };
    tx.onerror = () => reject(new Error('حدث خطأ أثناء حذف البيانات.'));
  });
});
// Merge backup records without replacing local student work or device settings.
export const mergeStudyData = (data: Pick<StudyData, 'subjects' | 'tasks'> & {
  reviewPlans?: ReviewPlan[]; includeReviewPlans?: boolean;
}): Promise<{ subjects: number; tasks: number; reviewPlans: number }> => withReminderLock(async () => {
  const includeReviewPlans = data.includeReviewPlans === true && Array.isArray(data.reviewPlans);
  const incomingPlans = includeReviewPlans ? data.reviewPlans ?? [] : [];
  const incomingTasks: Task[] = includeReviewPlans ? data.tasks : data.tasks.map(({ reviewPlanId: _planId, reviewOffsetDays: _offset, ...task }) => task as Task);
  if (backgroundEnabled()) {
    const existing = await loadStudyData();
    const ids = new Set(existing.tasks.map(task => task.id));
    await syncBackgroundReminders({ ...existing, tasks: [...existing.tasks, ...incomingTasks.filter(task => !ids.has(task.id))] });
  }
  const db = await openDb();
  return new Promise<{ subjects: number; tasks: number; reviewPlans: number }>((resolve, reject) => {
    const tx = db.transaction(['subjects', 'tasks', 'settings'], 'readwrite');
    const subjectStore = tx.objectStore('subjects');
    const taskStore = tx.objectStore('tasks');
    const settingsStore = tx.objectStore('settings');
    const subjectKeys = subjectStore.getAllKeys();
    const currentTasksRequest = taskStore.getAll();
    const currentPlansRequest = settingsStore.get('review-plans');
    const counts = { subjects: 0, tasks: 0, reviewPlans: 0 };
    let cause: unknown;
    let processed = false;
    const process = () => {
      if (processed || subjectKeys.readyState !== 'done' || currentTasksRequest.readyState !== 'done' || currentPlansRequest.readyState !== 'done') return;
      processed = true;
      try {
        const existingSubjects = new Set(subjectKeys.result);
        const existingTasks = currentTasksRequest.result as Task[];
        const existingTaskIds = new Set(existingTasks.map(task => task.id));
        const storedPlans = currentPlansRequest.result as { key: string; value: ReviewPlan[] } | undefined;
        const currentPlans = storedPlans?.value ?? [];
        const byBackupSource = new Map(data.tasks.map(task => [task.id, task]));
        const adjustedPlans = incomingPlans.map(plan => {
          if (!plan.sourceTaskId) return plan;
          const local = existingTasks.find(task => task.id === plan.sourceTaskId);
          const source = byBackupSource.get(plan.sourceTaskId);
          if (local && source && (local.title !== source.title || local.type !== source.type || local.subjectId !== source.subjectId)) {
            return { ...plan, sourceTaskId: undefined };
          }
          return plan;
        }).filter(plan => !incomingTasks.some(task => task.reviewPlanId === plan.id &&
          existingTasks.some(current => current.id === task.id && current.reviewPlanId !== plan.id)));
        const mergedPlans = mergeImportedReviewPlans(currentPlans, adjustedPlans);
        const acceptedTasks = incomingTasks.filter(task => !task.reviewPlanId || mergedPlans.acceptedIds.has(task.reviewPlanId));
        for (const subject of data.subjects) {
          if (!existingSubjects.has(subject.id)) { subjectStore.add(subject); counts.subjects++; }
        }
        for (const task of acceptedTasks) {
          if (!existingTaskIds.has(task.id)) { taskStore.add(task); counts.tasks++; }
        }
        counts.reviewPlans = mergedPlans.plans.filter(plan => !currentPlans.some(current => current.id === plan.id)).length;
        if (counts.reviewPlans > 0) settingsStore.put({ key: 'review-plans', value: mergedPlans.plans });
      } catch (error) { cause = error; tx.abort(); }
    };
    subjectKeys.onsuccess = currentTasksRequest.onsuccess = currentPlansRequest.onsuccess = process;
    tx.oncomplete = () => { db.close(); resolve(counts); };
    tx.onerror = () => reject(cause ?? new Error('تعذّرت الاستعادة. لم تتغير بياناتك الحالية.'));
    tx.onabort = () => { db.close(); reject(cause ?? new Error('لم تكتمل الاستعادة، ولم تُحفظ تغييرات جزئية.')); };
  });
});
export function id(): string { return crypto.randomUUID(); }

// Review plans stay device-local, like settings. Their generated tasks are real
// study tasks, so existing calendar, subject and status filters need no copies.
export async function loadReviewPlans(): Promise<ReviewPlan[]> {
  const record = await transact<{ key: string; value: ReviewPlan[] } | undefined>('settings', 'readonly', s => s.get('review-plans'));
  return record?.value ?? [];
}
async function mutateReviewPlan(draft: ReviewDraft | null, planId: string, editing = false): Promise<void> {
  return withReminderLock(async () => {
    const [data, plans] = await Promise.all([loadStudyData(), loadReviewPlans()]);
    if (editing && !plans.some(plan => plan.id === planId)) {
      throw new Error('لم تعد خطة المراجعة موجودة. حدّث الصفحة قبل المحاولة.');
    }
    if (draft && !plans.some(plan => plan.id === planId) && data.tasks.some(task => task.reviewPlanId === planId)) {
      throw new Error('تعذّرت قراءة خطة المراجعة الحالية. حدّث الصفحة وحاول مجددًا.');
    }
    const next = planReviewChange(data.tasks, plans, draft, planId, data.subjects.map(subject => subject.id));
    // Keep the existing cancellation guarantee if reminders were already enabled.
    if (backgroundEnabled()) await syncBackgroundReminders({ ...data, tasks: next.tasks });
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['tasks', 'settings', 'subjects'], 'readwrite');
      const tasks = tx.objectStore('tasks');
      const settings = tx.objectStore('settings');
      const currentTasks = tasks.getAll();
      const currentPlans = settings.get('review-plans');
      const currentSubjects = tx.objectStore('subjects').getAll();
      let cause: unknown;
      currentSubjects.onsuccess = () => {
        try {
          // Compare inside the write transaction: even two tabs without Web Locks
          // cannot overwrite a newer plan or completion with an older preview.
          const snapshot = (records: {id: string}[]) => JSON.stringify([...records].sort((a, b) => a.id.localeCompare(b.id)));
          if (snapshot(currentTasks.result) !== snapshot(data.tasks) ||
              JSON.stringify(currentPlans.result?.value ?? []) !== JSON.stringify(plans) ||
              snapshot(currentSubjects.result) !== snapshot(data.subjects)) {
            throw new Error('تغيّرت خطتك في نافذة أخرى. حدّث الصفحة ثم راجع المواعيد مجددًا.');
          }
          const retained = new Set(next.tasks.map(task => task.id));
          for (const task of data.tasks) if (!retained.has(task.id)) tasks.delete(task.id);
          for (const task of next.tasks) {
            if (task.reviewPlanId === planId && !data.tasks.some(old => old === task)) tasks.put(task);
          }
          settings.put({ key: 'review-plans', value: next.plans });
        } catch (error) { cause = error; tx.abort(); }
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(cause ?? new Error('تعذّر حفظ المراجعات. لم تُحفظ تغييرات جزئية؛ حاول مرة أخرى.'));
      };
    });
  });
}
export const saveReviewPlan = (draft: ReviewDraft, planId?: string) => mutateReviewPlan(draft, planId ?? id(), Boolean(planId));
export const cancelReviewPlan = (planId: string) => mutateReviewPlan(null, planId);

export type PlanRecords = Pick<StudyData, 'subjects' | 'tasks'>;
export const emptyPlan = (): PlanRecords => ({ subjects: [], tasks: [] });
export async function loadCloudBase(): Promise<PlanRecords> {
  const record = await transact<{ key: string; value: PlanRecords } | undefined>('settings', 'readonly', s => s.get('cloud-base'));
  return record?.value ?? emptyPlan();
}
// Caller holds withReminderLock for the full read/network/commit operation.
// Settings stay device-local; plan and its merge baseline commit together.
export async function applyCloudPlan(plan: PlanRecords, base: PlanRecords): Promise<void> {
  const current = await loadStudyData();
  if (backgroundEnabled()) await syncBackgroundReminders({ ...current, ...plan });
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['subjects', 'tasks', 'settings'], 'readwrite');
    for (const name of ['subjects', 'tasks'] as const) {
      const store = tx.objectStore(name);
      store.clear();
      for (const record of plan[name]) store.put(record);
    }
    tx.objectStore('settings').put({ key: 'cloud-base', value: base });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('لم يكتمل الحفظ المحلي. أعد المزامنة؛ بقيت نسختك السحابية محفوظة.')); };
  });
}
export async function readGuestPlan(): Promise<PlanRecords> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('fakker-study-planner', DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of ['subjects', 'tasks', 'settings']) req.result.createObjectStore(name, { keyPath: name === 'settings' ? 'key' : 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('تعذّر قراءة خطتك المحلية القديمة.'));
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['subjects', 'tasks'], 'readonly');
    const subjects = tx.objectStore('subjects').getAll();
    const tasks = tx.objectStore('tasks').getAll();
    tx.oncomplete = () => { db.close(); resolve({ subjects: subjects.result, tasks: tasks.result }); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('تعذّرت قراءة الخطة المحلية.')); };
  });
}
