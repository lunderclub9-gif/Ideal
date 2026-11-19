import React, { useEffect, useState } from 'react';
import { CheckCheck, Download, Plus, Trash2 } from 'lucide-react';
import { apiFetch, downloadWithAuth, formatDA, formatDateFr, hasPerm } from '../lib/api';
import { Modal, PageHeader, StatusText } from '../components/ui';

export default function AttendancePage({ permissions }: { permissions: string[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState('2026-11-19');
  const [showAllDates, setShowAllDates] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    attendance_date: '2026-11-19',
    worker_id: '',
    project_id: '',
    status: 'present',
    day_fraction: 1,
    overtime_hours: 0,
    advance_amount: 0,
    notes: '',
  });

  const canWrite = hasPerm(permissions, 'attendance:write');
  const canApprove = hasPerm(permissions, 'attendance:approve');

  async function load() {
    try {
      const q = showAllDates ? '' : `?date=${encodeURIComponent(dateFilter)}`;
      const [a, w, p] = await Promise.all([
        apiFetch(`/attendance${q}`),
        apiFetch('/workers'),
        apiFetch('/projects'),
      ]);
      setRows(a);
      setWorkers(w);
      setProjects(p);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [dateFilter, showAllDates]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/attendance', { method: 'POST', body: JSON.stringify(form) });
      setCreateOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function approveVisible() {
    setError('');
    const pendingIds = rows.filter((r) => r.approval_status === 'pending').map((r) => r.id);
    if (pendingIds.length === 0) return;
    try {
      await apiFetch('/attendance/approve', { method: 'POST', body: JSON.stringify({ ids: pendingIds }) });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeEntry(id: number) {
    try {
      await apiFetch(`/attendance/${id}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const pendingCount = rows.filter((r) => r.approval_status === 'pending').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pointage journalier & Avances"
        subtitle="Affectation par chantier (y compris demi-journées 0,5 j) et validation Admin obligatoire avant paie"
        actions={
          <>
            <button
              type="button"
              onClick={() => downloadWithAuth('/attendance/export/xlsx', 'pointage_gestionpro_dz.xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
            {canApprove && pendingCount > 0 && (
              <button
                type="button"
                onClick={approveVisible}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Valider le pointage ({pendingCount})
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Saisir pointage
              </button>
            )}
          </>
        }
      />

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2">
          <span className="font-medium">Date :</span>
          <input
            type="date"
            disabled={showAllDates}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-50"
          />
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showAllDates}
            onChange={(e) => setShowAllDates(e.target.checked)}
          />
          Afficher tout l’historique récent
        </label>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3 text-left font-medium">Date</th>
                <th className="p-3 text-left font-medium">Ouvrier</th>
                <th className="p-3 text-left font-medium">Chantier affecté</th>
                <th className="p-3 text-left font-medium">Présence</th>
                <th className="p-3 text-right font-medium">Journée</th>
                <th className="p-3 text-right font-medium">H. Sup</th>
                <th className="p-3 text-right font-medium">Avance</th>
                <th className="p-3 text-left font-medium">Validation</th>
                <th className="p-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-mono">{formatDateFr(r.attendance_date)}</td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-900 dark:text-white">{r.worker_name}</div>
                    <div className="text-[11px] text-slate-500">{r.job_title}</div>
                  </td>
                  <td className="p-3">
                    {r.project_number ? (
                      <span><strong className="font-mono">{r.project_number}</strong> · {r.project_title}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusText status={r.status} />
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">{r.day_fraction} j</td>
                  <td className="p-3 text-right font-mono tabular-nums">{r.overtime_hours} h</td>
                  <td className="p-3 text-right font-mono tabular-nums text-amber-700">
                    {r.advance_amount > 0 ? formatDA(r.advance_amount) : '—'}
                  </td>
                  <td className="p-3">
                    <StatusText status={r.approval_status} />
                  </td>
                  <td className="p-3 text-right">
                    {canWrite && (r.approval_status === 'pending' || canApprove) && (
                      <button
                        type="button"
                        onClick={() => removeEntry(r.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle saisie de pointage">
        <form onSubmit={handleAdd} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Date *</label>
              <input
                type="date"
                required
                value={form.attendance_date}
                onChange={(e) => setForm({ ...form, attendance_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Ouvrier *</label>
              <select
                required
                value={form.worker_id}
                onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="">Sélectionner...</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.full_name} ({w.job_title})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Statut de présence</label>
              <select
                value={form.status}
                onChange={(e) => {
                  const st = e.target.value;
                  setForm({
                    ...form,
                    status: st,
                    day_fraction: st === 'half_day' ? 0.5 : st === 'absent' || st === 'unpaid_leave' ? 0 : 1,
                  });
                }}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="present">Présent (1,0 jour)</option>
                <option value="half_day">Demi-journée (0,5 jour — fractionné possible)</option>
                <option value="absent">Absent (0 jour)</option>
                <option value="paid_leave">Congé payé</option>
                <option value="unpaid_leave">Congé sans solde</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Chantier d’affectation</label>
              <select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="">Sélectionner un chantier...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Heures supplémentaires</label>
              <input
                type="number"
                step="0.5"
                value={form.overtime_hours}
                onChange={(e) => setForm({ ...form, overtime_hours: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Avance sur salaire (DA)</label>
              <input
                type="number"
                value={form.advance_amount}
                onChange={(e) => setForm({ ...form, advance_amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg font-medium">Enregistrer</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
