export type TaskType = 'homework' | 'study' | 'project' | 'exam';
export type TaskStatus = 'not-started' | 'in-progress' | 'completed';
export type Priority = 'low' | 'medium' | 'high';
export type Subject = { id: string; name: string; teacher?: string; color: string; description?: string };
export type Task = {
  id: string; title: string; description?: string; subjectId?: string; type: TaskType; dueAt: string;
  priority: Priority; status: TaskStatus; completedAt?: string; reminderAt?: string; studyStart?: string; studyEnd?: string;
};
export type Settings = { studentName: string; notificationsEnabled: boolean; reminderLeadMinutes: number };
export type StudyData = { subjects: Subject[]; tasks: Task[]; settings: Settings };
const DB_NAME = 'fakker-study-planner';
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
export async function loadStudyData(): Promise<StudyData> {
  const [subjects, tasks, settingsRecord] = await Promise.all([
    all<Subject>('subjects'), all<Task>('tasks'),
    transact<{key:string;value:Settings}|undefined>('settings', 'readonly', s => s.get('main')),
  ]);
  return { subjects, tasks, settings: settingsRecord?.value ?? DEFAULT_SETTINGS };
}
export const saveSubject = (subject: Subject) => put('subjects', subject);
export async function deleteSubject(id: string): Promise<void> {
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
}
export async function saveTask(task: Task) {
  const previous = task.status === 'completed'
    ? await transact<Task | undefined>('tasks', 'readonly', s => s.get(task.id))
    : undefined;
  const completedAt = task.status === 'completed'
    ? task.completedAt ?? (previous?.status === 'completed' ? previous.completedAt : undefined) ?? new Date().toISOString()
    : undefined;
  return put('tasks', { ...task, completedAt });
}
export const deleteTask = (id: string) => remove('tasks', id);
export const saveSettings = (settings: Settings) => put('settings', { key: 'main', value: settings });
export async function clearStudyData(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['subjects', 'tasks', 'settings'], 'readwrite');
    for (const store of ['subjects', 'tasks', 'settings']) tx.objectStore(store).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(new Error('تعذّر حذف البيانات، ولم تُحفظ تغييرات جزئية.')); };
    tx.onerror = () => reject(new Error('حدث خطأ أثناء حذف البيانات.'));
  });
}
export function id(): string { return crypto.randomUUID(); }
