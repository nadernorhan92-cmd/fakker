import type { PlanRecords, Subject, Task } from './study-db';

// Stable comparison ignores property order, undefined fields and array order.
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, val) => val && !Array.isArray(val) && typeof val === 'object'
    ? Object.fromEntries(Object.keys(val).sort().map(key => [key, val[key]]))
    : val) ?? 'undefined';
}
export type Conflict = { key: string; name: string; local?: Subject | Task; cloud?: Subject | Task };
export function mergePlans(base: PlanRecords, local: PlanRecords, cloud: PlanRecords, choices: Record<string, 'local' | 'cloud'> = {}) {
  const plan: PlanRecords = { subjects: [], tasks: [] };
  const conflicts: Conflict[] = [];
  for (const kind of ['subjects', 'tasks'] as const) {
    const old = new Map<string, Subject | Task>(base[kind].map(r => [r.id, r]));
    const left = new Map<string, Subject | Task>(local[kind].map(r => [r.id, r]));
    const right = new Map<string, Subject | Task>(cloud[kind].map(r => [r.id, r]));
    for (const id of new Set([...old.keys(), ...left.keys(), ...right.keys()])) {
      const b = old.get(id), l = left.get(id), r = right.get(id);
      let result: Subject | Task | undefined;
      if (canonical(l) === canonical(r)) result = l;
      else if (canonical(l) === canonical(b)) result = r;
      else if (canonical(r) === canonical(b)) result = l;
      else {
        // Choices only apply to the exact two versions the student saw.
        const key = canonical([kind, id, l, r]);
        const choice = choices[key];
        if (!choice) conflicts.push({ key, name: (l && ('title' in l ? l.title : l.name)) || (r && ('title' in r ? r.title : r.name)) || id, local: l, cloud: r });
        result = choice === 'cloud' ? r : l;
      }
      if (result) (plan[kind] as (Subject | Task)[]).push(result);
    }
  }
  const subjects = new Set(plan.subjects.map(s => s.id));
  plan.tasks = plan.tasks.map(t => t.subjectId && !subjects.has(t.subjectId) ? { ...t, subjectId: undefined } : t);
  return { plan, conflicts };
}
