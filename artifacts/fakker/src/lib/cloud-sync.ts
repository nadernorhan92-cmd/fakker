import type { CloudPlan } from '@workspace/api-client-react';
import { applyCloudPlan, getStudyAccount, loadCloudBase, loadStudyData, type PlanRecords } from './study-db';
import { withReminderLock } from './background-reminders';
import { mergePlans, type Conflict } from './plan-merge';

async function request(method: 'GET' | 'PUT', body?: unknown): Promise<CloudPlan> {
  let response: Response;
  try {
    response = await fetch('/api/study-plan', {
      method, credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Study-Account': getStudyAccount() ?? '' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
    });
  } catch { throw new Error('تعذّر الاتصال. بياناتك المحلية محفوظة؛ أعد المحاولة عند عودة الإنترنت.'); }
  if (response.status === 401) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجددًا؛ لم تُحذف خطتك المحلية.');
  if (response.status === 403) throw new Error('تغيّر الحساب في نافذة أخرى. أعد تحميل الصفحة قبل المزامنة.');
  if (response.status === 409) throw new Error('تغيّرت الخطة على جهاز آخر أثناء المزامنة. أعد المحاولة لمراجعة أحدث النسخ.');
  if (!response.ok) throw new Error('تعذّرت المزامنة. لم تتغيّر بياناتك المحلية؛ حاول مجددًا.');
  return response.json();
}

export function synchronize(uploadConsent: boolean, choices: Record<string, 'local' | 'cloud'>): Promise<{ conflicts: Conflict[] }> {
  return withReminderLock(async () => {
    const [local, base, remote] = await Promise.all([loadStudyData(), loadCloudBase(), request('GET')]);
    const { plan, conflicts } = mergePlans(base, local, remote.plan as PlanRecords, choices);
    if (conflicts.length) return { conflicts };
    // applyCloudPlan confirms reminder changes before committing locally.
    // A failed local commit leaves the server copy available for a retry.
    if (uploadConsent) {
      const saved = await request('PUT', { plan, revision: remote.revision, consent: true });
      await applyCloudPlan(plan, saved.plan as PlanRecords);
    } else {
      await applyCloudPlan(plan, remote.plan as PlanRecords);
    }
    return { conflicts: [] };
  });
}
