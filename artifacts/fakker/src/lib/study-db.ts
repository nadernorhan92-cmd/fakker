export type TaskType = 'homework' | 'study' | 'project' | 'exam';
export type TaskStatus = 'not-started' | 'in-progress' | 'completed';
export type Priority = 'low' | 'medium' | 'high';
export type Subject = { id: string; name: string; teacher?: string; color: string; description?: string };
export type Task = {
  id: string; title: string; description?: string; subjectId?: string; type: TaskType; dueAt: string;
  priority: Priority; status: TaskStatus; reminderAt?: string; studyStart?: string; studyEnd?: string;
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
    const req = work(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('لم نتمكن من حفظ التغيير. حاول مرة أخرى.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(new Error('حدث خطأ أثناء تحديث البيانات.'));
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
export const deleteSubject = (id: string) => remove('subjects', id);
export const saveTask = (task: Task) => put('tasks', task);
export const deleteTask = (id: string) => remove('tasks', id);
export const saveSettings = (settings: Settings) => put('settings', { key: 'main', value: settings });
export async function clearStudyData(): Promise<void> {
  await Promise.all(['subjects','tasks','settings'].map(store => transact<undefined>(store, 'readwrite', s => s.clear())));
}
export function id(): string { return crypto.randomUUID(); }
