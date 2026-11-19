import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
type UpdateStatus = { state: string; version: string | null; percent: number; message: string };
type DesktopBridge = { getVersion: () => Promise<string>; getUpdateStatus: () => Promise<UpdateStatus>; checkForUpdates: () => Promise<UpdateStatus>; installUpdate: () => Promise<boolean>; onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void };
declare global { interface Window { gestionProDesktop?: DesktopBridge } }
export default function UpdaterPanel({ canBackup }: { canBackup: boolean }) {
  const bridge = window.gestionProDesktop;
  const [version, setVersion] = useState('…');
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle', version: null, percent: 0, message: 'جاهز للتحقق من التحديثات.' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { if (!bridge) return; bridge.getVersion().then(setVersion).catch(() => setVersion('غير معروف')); bridge.getUpdateStatus().then(setStatus).catch(() => {}); return bridge.onUpdateStatus(setStatus); }, []);
  if (!bridge) return null;
  const check = async () => { setBusy(true); try { setStatus(await bridge.checkForUpdates()); } finally { setBusy(false); } };
  const install = async () => {
    if (!canBackup) { setNotice('يلزم تسجيل الدخول بحساب يملك صلاحية النسخ الاحتياطي.'); return; }
    setBusy(true); setNotice('إنشاء نسخة احتياطية موثقة قبل التحديث…');
    try {
      const backup = await apiFetch<{ verified: boolean; file_name: string }>('/backups/create', { method: 'POST', body: JSON.stringify({ backup_type: 'manual_local' }) });
      if (!backup.verified || !backup.file_name) throw new Error('لم يتم تأكيد سلامة النسخة الاحتياطية؛ أُلغي التحديث لحماية بياناتك.');
      setNotice('تم إنشاء نسخة احتياطية موثقة بنجاح.');
      await bridge.installUpdate();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذر إنشاء النسخة الاحتياطية؛ لم يتم تثبيت التحديث.');
    } finally { setBusy(false); }
  };
  return <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400" title={status.message}>
    <span className="hidden xl:inline">v{version}</span>
    {status.state === 'downloading' && <span className="hidden sm:inline">{status.percent}%</span>}
    {status.state === 'downloaded' ? <button type="button" onClick={install} disabled={busy || !canBackup} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50">{busy ? 'تجهيز التحديث…' : 'نسخ احتياطي وتثبيت'}</button> :
      <button type="button" onClick={check} disabled={busy || status.state === 'checking' || status.state === 'downloading'} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50">{busy || status.state === 'checking' ? 'جارٍ التحقق…' : status.state === 'downloading' ? 'تحميل ' + status.percent + '%' : 'التحقق من التحديثات'}</button>}
    {(status.state === 'error' || notice) && <span className="hidden 2xl:inline text-amber-600">{notice || 'تعذر التحقق'}</span>}
  </div>;
}
