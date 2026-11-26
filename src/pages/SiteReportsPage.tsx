import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Pencil,
  Plus,
  Printer,
  Send,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { apiFetch, downloadWithAuth, formatDateFr, formatNum, hasPerm } from '../lib/api';
import { EmptyState, Modal, PageHeader, StatusText } from '../components/ui';

const WEATHER_LABELS: Record<string, string> = {
  '': 'Non renseignée',
  ensoleille: 'Ensoleillé',
  nuageux: 'Nuageux',
  pluvieux: 'Pluvieux',
  venteux: 'Venteux',
  tres_chaud: 'Très chaud',
  froid: 'Froid',
};

interface WorkforceRow {
  worker_id: string;
  hours_worked: number;
  notes: string;
}

interface EquipmentRow {
  vehicle_id: string;
  hours_used: number;
  notes: string;
}

interface MaterialRow {
  material_id: string;
  quantity: number;
  unit: string;
  notes: string;
}

interface ReportForm {
  project_id: string;
  phase_id: string;
  task_id: string;
  report_date: string;
  weather: string;
  temperature_c: string;
  site_condition: string;
  work_done: string;
  observations: string;
  incidents: string;
  workforce: WorkforceRow[];
  equipment: EquipmentRow[];
  materials: MaterialRow[];
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function blankForm(): ReportForm {
  return {
    project_id: '',
    phase_id: '',
    task_id: '',
    report_date: today(),
    weather: '',
    temperature_c: '',
    site_condition: '',
    work_done: '',
    observations: '',
    incidents: '',
    workforce: [],
    equipment: [],
    materials: [],
  };
}

export default function SiteReportsPage({ permissions }: { permissions: string[] }) {
  const [reports, setReports] = useState<any[]>([]);
  const [options, setOptions] = useState<{ projects: any[]; workers: any[]; materials: any[]; vehicles: any[]; phases: any[]; tasks: any[] }>({
    projects: [],
    workers: [],
    materials: [],
    vehicles: [],
    phases: [],
    tasks: [],
  });
  const [filters, setFilters] = useState({ project_id: '', status: '', from: '', to: '', q: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<ReportForm>(blankForm());
  const [viewing, setViewing] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const canWrite = hasPerm(permissions, 'sites:write');
  const canApprove = hasPerm(permissions, 'sites:approve');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.project_id) params.set('project_id', filters.project_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.q.trim()) params.set('q', filters.q.trim());
    const text = params.toString();
    return text ? `?${text}` : '';
  }, [filters]);

  async function load() {
    setError('');
    try {
      const rows = await apiFetch<any[]>(`/site-reports${query}`);
      setReports(rows);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions(projectId?: string) {
    try {
      const data = await apiFetch<any>(`/site-reports/options${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''}`);
      setOptions(data);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    load();
  }, [query]);

  async function refreshViewing(id: number) {
    try {
      const fresh = await apiFetch<any>(`/site-reports/${id}`);
      setViewing(fresh);
    } catch {
      setViewing(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setOptions((current) => ({ ...current, phases: [], tasks: [] }));
    setError('');
    setEditorOpen(true);
  }

  async function openEdit(report: any) {
    setError('');
    try {
      const detail = await apiFetch<any>(`/site-reports/${report.id}`);
      setEditing(detail);
      setForm({
        project_id: String(detail.project_id),
        phase_id: detail.phase_id ? String(detail.phase_id) : '',
        task_id: detail.task_id ? String(detail.task_id) : '',
        report_date: detail.report_date,
        weather: detail.weather || '',
        temperature_c: detail.temperature_c === null || detail.temperature_c === undefined ? '' : String(detail.temperature_c),
        site_condition: detail.site_condition || '',
        work_done: detail.work_done || '',
        observations: detail.observations || '',
        incidents: detail.incidents || '',
        workforce: (detail.workforce || []).map((row: any) => ({ worker_id: String(row.worker_id), hours_worked: Number(row.hours_worked), notes: row.notes || '' })),
        equipment: (detail.equipment || []).map((row: any) => ({ vehicle_id: String(row.vehicle_id), hours_used: Number(row.hours_used), notes: row.notes || '' })),
        materials: (detail.materials || []).map((row: any) => ({ material_id: String(row.material_id), quantity: Number(row.quantity), unit: row.unit || '', notes: row.notes || '' })),
      });
      await loadOptions(String(detail.project_id));
      setEditorOpen(true);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function changeProject(projectId: string) {
    setForm((current) => ({ ...current, project_id: projectId, phase_id: '', task_id: '' }));
    if (projectId) await loadOptions(projectId);
    else setOptions((current) => ({ ...current, phases: [], tasks: [] }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        ...form,
        phase_id: form.phase_id || null,
        task_id: form.task_id || null,
        temperature_c: form.temperature_c === '' ? null : Number(form.temperature_c),
        workforce: form.workforce.filter((row) => row.worker_id),
        equipment: form.equipment.filter((row) => row.vehicle_id),
        materials: form.materials.filter((row) => row.material_id),
        revision: editing?.revision,
      };
      if (editing) {
        await apiFetch(`/site-reports/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setNotice('Rapport de chantier enregistré.');
      } else {
        await apiFetch('/site-reports', { method: 'POST', body: JSON.stringify(payload) });
        setNotice('Rapport de chantier créé.');
      }
      setEditorOpen(false);
      setEditing(null);
      await load();
      if (viewing) await refreshViewing(viewing.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReport(report: any) {
    setError('');
    if (!window.confirm(`Soumettre le rapport ${report.report_number} à validation ? Il ne sera plus modifiable pendant la validation.`)) return;
    try {
      await apiFetch(`/site-reports/${report.id}/submit`, { method: 'POST' });
      setNotice('Rapport soumis à validation.');
      await load();
      if (viewing?.id === report.id) await refreshViewing(report.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function approveReport(report: any) {
    setError('');
    if (!window.confirm(`Valider le rapport ${report.report_number} ?`)) return;
    try {
      await apiFetch(`/site-reports/${report.id}/approve`, { method: 'POST' });
      setNotice('Rapport validé.');
      await load();
      if (viewing?.id === report.id) await refreshViewing(report.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function rejectReport() {
    if (!rejectTarget) return;
    setError('');
    try {
      await apiFetch(`/site-reports/${rejectTarget.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: rejectReason }) });
      setNotice('Rapport refusé : le chef de chantier peut le corriger.');
      setRejectTarget(null);
      setRejectReason('');
      await load();
      if (viewing?.id === rejectTarget.id) await refreshViewing(rejectTarget.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function deleteReport() {
    if (!deleteTarget) return;
    setError('');
    try {
      await apiFetch(`/site-reports/${deleteTarget.id}`, { method: 'DELETE' });
      setNotice('Brouillon supprimé.');
      if (viewing?.id === deleteTarget.id) setViewing(null);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function uploadAttachment(file: File) {
    if (!viewing) return;
    setError('');
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('title', `Photo / pièce — ${viewing.report_number}`);
      body.append('category', 'Projects');
      body.append('doc_date', viewing.report_date);
      body.append('related_type', 'site_report');
      body.append('related_id', String(viewing.id));
      await apiFetch('/documents', { method: 'POST', body });
      await refreshViewing(viewing.id);
      setNotice('Pièce jointe ajoutée au rapport.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function updateRow(kind: 'workforce' | 'equipment' | 'materials', index: number, patch: Record<string, unknown>) {
    setForm((current) => {
      const rows = [...(current[kind] as any[])];
      rows[index] = { ...rows[index], ...patch };
      return { ...current, [kind]: rows } as ReportForm;
    });
  }

  function addRow(kind: 'workforce' | 'equipment' | 'materials') {
    setForm((current) => {
      if (kind === 'workforce') return { ...current, workforce: [...current.workforce, { worker_id: '', hours_worked: 8, notes: '' }] };
      if (kind === 'equipment') return { ...current, equipment: [...current.equipment, { vehicle_id: '', hours_used: 0, notes: '' }] };
      return { ...current, materials: [...current.materials, { material_id: '', quantity: 1, unit: '', notes: '' }] };
    });
  }

  function removeRow(kind: 'workforce' | 'equipment' | 'materials', index: number) {
    setForm((current) => ({ ...current, [kind]: (current[kind] as any[]).filter((_, i) => i !== index) } as ReportForm));
  }

  function selectMaterial(index: number, materialId: string) {
    const material = options.materials.find((m) => String(m.id) === materialId);
    updateRow('materials', index, { material_id: materialId, unit: material?.unit || '' });
  }

  function canEdit(report: any) {
    return canWrite && ['draft', 'rejected'].includes(report.status);
  }

  const filteredTasks = options.tasks.filter((task) => !form.phase_id || String(task.phase_id) === form.phase_id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Journal de chantier"
        subtitle="Rapports journaliers : météo, équipes présentes, engins, matériaux consommés et travaux réalisés"
        actions={
          <>
            <button
              type="button"
              onClick={() => downloadWithAuth('/site-reports/export/xlsx', 'journal_de_chantier.xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Nouveau rapport
              </button>
            )}
          </>
        }
      />

      {error && (
        <div role="alert" className="px-4 py-3 text-xs rounded-lg border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="px-4 py-3 text-xs rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Chantier
          <select
            value={filters.project_id}
            onChange={(e) => setFilters((f) => ({ ...f, project_id: e.target.value }))}
            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="">Tous les chantiers</option>
            {options.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Statut
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="submitted">Soumis</option>
            <option value="approved">Validé</option>
            <option value="rejected">Refusé</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Du
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Au
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Recherche
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="N° rapport, travaux, chantier…"
            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </label>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Chargement du journal de chantier…</div>
      ) : reports.length === 0 ? (
        <EmptyState
          message="Aucun rapport de chantier"
          hint="Créez le rapport journalier d’une équipe pour consigner la météo, les présences et les travaux réalisés."
          action={canWrite ? (
            <button type="button" onClick={openCreate} className="px-3 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">
              Créer un rapport
            </button>
          ) : undefined}
        />
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2.5 font-semibold">N° / Date</th>
                <th className="px-3 py-2.5 font-semibold">Chantier</th>
                <th className="px-3 py-2.5 font-semibold">Météo</th>
                <th className="px-3 py-2.5 font-semibold text-right">Équipe</th>
                <th className="px-3 py-2.5 font-semibold text-right">Engins</th>
                <th className="px-3 py-2.5 font-semibold text-right">Matériaux</th>
                <th className="px-3 py-2.5 font-semibold">Statut</th>
                <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2.5">
                    <div className="font-mono font-semibold text-slate-800 dark:text-slate-100">{report.report_number}</div>
                    <div className="text-[11px] text-slate-500">{formatDateFr(report.report_date)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{report.project_title}</div>
                    <div className="text-[11px] text-slate-500">{report.project_number} · {report.client_name}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                    {WEATHER_LABELS[report.weather] || report.weather || '—'}
                    {report.temperature_c !== null && report.temperature_c !== undefined && (
                      <span className="block text-[11px] text-slate-500">{formatNum(report.temperature_c, 0)} °C</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {report.workforce_count} pers.
                    <span className="block text-[11px] text-slate-500">{formatNum(report.workforce_hours, 1)} h</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{report.equipment_count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{report.material_count}</td>
                  <td className="px-3 py-2.5"><StatusText status={report.status} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setViewing(report)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" title="Consulter / imprimer" aria-label="Consulter le rapport">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {canEdit(report) && (
                        <>
                          <button type="button" onClick={() => openEdit(report)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" title="Modifier" aria-label="Modifier le rapport">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(report)} className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" title="Supprimer le brouillon" aria-label="Supprimer le brouillon">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {canWrite && ['draft', 'rejected'].includes(report.status) && (
                        <button type="button" onClick={() => submitReport(report)} className="p-1.5 rounded-md text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40" title="Soumettre à validation" aria-label="Soumettre à validation">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canApprove && report.status === 'submitted' && (
                        <>
                          <button type="button" onClick={() => approveReport(report)} className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" title="Valider" aria-label="Valider le rapport">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => { setRejectTarget(report); setRejectReason(''); }} className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" title="Refuser" aria-label="Refuser le rapport">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? `Modifier le rapport ${editing.report_number}` : 'Nouveau rapport de chantier'} maxWidth="max-w-4xl">
        <form onSubmit={save} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="font-medium text-slate-600 dark:text-slate-300">
              Chantier *
              <select required value={form.project_id} onChange={(e) => changeProject(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950">
                <option value="">Sélectionner…</option>
                {options.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>
                ))}
              </select>
            </label>
            <label className="font-medium text-slate-600 dark:text-slate-300">
              Date *
              <input type="date" required value={form.report_date} onChange={(e) => setForm((f) => ({ ...f, report_date: e.target.value }))} className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
            </label>
            <label className="font-medium text-slate-600 dark:text-slate-300">
              Phase
              <select value={form.phase_id} onChange={(e) => setForm((f) => ({ ...f, phase_id: e.target.value, task_id: '' }))} className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950">
                <option value="">Aucune</option>
                {options.phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="font-medium text-slate-600 dark:text-slate-300">
              Tâche
              <select value={form.task_id} onChange={(e) => setForm((f) => ({ ...f, task_id: e.target.value }))} className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950">
                <option value="">Aucune</option>
                {filteredTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </label>
            <label className="font-medium text-slate-600 dark:text-slate-300">
              Météo
              <select value={form.weather} onChange={(e) => setForm((f) => ({ ...f, weather: e.target.value }))} className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950">
                {Object.entries(WEATHER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="font-medium text-slate-600 dark:text-slate-300">
              Température (°C)
              <input type="number" step="0.1" min="-30" max="60" value={form.temperature_c} onChange={(e) => setForm((f) => ({ ...f, temperature_c: e.target.value }))} className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
            </label>
            <label className="sm:col-span-2 font-medium text-slate-600 dark:text-slate-300">
              État du chantier
              <input value={form.site_condition} onChange={(e) => setForm((f) => ({ ...f, site_condition: e.target.value }))} placeholder="Accès, encombrement, sécurité…" className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
            </label>
          </div>

          <label className="block font-medium text-slate-600 dark:text-slate-300">
            Travaux réalisés *
            <textarea required rows={3} value={form.work_done} onChange={(e) => setForm((f) => ({ ...f, work_done: e.target.value }))} className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="font-medium text-slate-600 dark:text-slate-300">
              Observations
              <textarea rows={2} value={form.observations} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
            </label>
            <label className="font-medium text-slate-600 dark:text-slate-300">
              Incidents / observations HSE
              <textarea rows={2} value={form.incidents} onChange={(e) => setForm((f) => ({ ...f, incidents: e.target.value }))} className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
            </label>
          </div>

          <section className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Main-d’œuvre présente</h4>
              <button type="button" onClick={() => addRow('workforce')} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-slate-300 dark:border-slate-700 rounded-md">
                <Plus className="w-3 h-3" /> Ajouter un salarié
              </button>
            </div>
            {form.workforce.length === 0 && <p className="text-[11px] text-slate-500">Aucun salarié déclaré sur ce rapport.</p>}
            {form.workforce.map((row, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_1fr_32px] gap-2 items-center">
                <select value={row.worker_id} onChange={(e) => updateRow('workforce', index, { worker_id: e.target.value })} className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950">
                  <option value="">Salarié…</option>
                  {options.workers.map((w) => (
                    <option key={w.id} value={w.id}>{w.full_name} — {w.job_title}</option>
                  ))}
                </select>
                <input type="number" min="0" max="24" step="0.5" value={row.hours_worked} onChange={(e) => updateRow('workforce', index, { hours_worked: Number(e.target.value) })} aria-label="Heures travaillées" className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
                <input value={row.notes} onChange={(e) => updateRow('workforce', index, { notes: e.target.value })} placeholder="Note (optionnel)" className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
                <button type="button" onClick={() => removeRow('workforce', index)} className="p-1.5 text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40" aria-label="Retirer ce salarié">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </section>

          <section className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Engins utilisés</h4>
              <button type="button" onClick={() => addRow('equipment')} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-slate-300 dark:border-slate-700 rounded-md">
                <Plus className="w-3 h-3" /> Ajouter un engin
              </button>
            </div>
            {form.equipment.length === 0 && <p className="text-[11px] text-slate-500">Aucun engin déclaré sur ce rapport.</p>}
            {form.equipment.map((row, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_1fr_32px] gap-2 items-center">
                <select value={row.vehicle_id} onChange={(e) => updateRow('equipment', index, { vehicle_id: e.target.value })} className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950">
                  <option value="">Engin / véhicule…</option>
                  {options.vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} — {v.registration}</option>
                  ))}
                </select>
                <input type="number" min="0" max="24" step="0.5" value={row.hours_used} onChange={(e) => updateRow('equipment', index, { hours_used: Number(e.target.value) })} aria-label="Heures d’utilisation" className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
                <input value={row.notes} onChange={(e) => updateRow('equipment', index, { notes: e.target.value })} placeholder="Note (optionnel)" className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
                <button type="button" onClick={() => removeRow('equipment', index)} className="p-1.5 text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40" aria-label="Retirer cet engin">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </section>

          <section className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Matériaux consommés</h4>
              <button type="button" onClick={() => addRow('materials')} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-slate-300 dark:border-slate-700 rounded-md">
                <Plus className="w-3 h-3" /> Ajouter un matériau
              </button>
            </div>
            {form.materials.length === 0 && <p className="text-[11px] text-slate-500">Aucun matériau consommé sur ce rapport.</p>}
            {form.materials.map((row, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_80px_1fr_32px] gap-2 items-center">
                <select value={row.material_id} onChange={(e) => selectMaterial(index, e.target.value)} className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950">
                  <option value="">Matériau…</option>
                  {options.materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                  ))}
                </select>
                <input type="number" min="0.01" step="0.01" value={row.quantity} onChange={(e) => updateRow('materials', index, { quantity: Number(e.target.value) })} aria-label="Quantité consommée" className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
                <input value={row.unit} onChange={(e) => updateRow('materials', index, { unit: e.target.value })} placeholder="Unité" aria-label="Unité" className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
                <input value={row.notes} onChange={(e) => updateRow('materials', index, { notes: e.target.value })} placeholder="Note (optionnel)" className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
                <button type="button" onClick={() => removeRow('materials', index)} className="p-1.5 text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40" aria-label="Retirer ce matériau">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </section>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setEditorOpen(false)} className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg">
              Annuler
            </button>
            <button type="submit" disabled={busy} className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60">
              {busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer le rapport'}
            </button>
          </div>
        </form>
      </Modal>

      {viewing && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-start justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden print-area">
            <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 no-print">
              <span className="text-xs font-semibold text-slate-700">Rapport journalier — {viewing.report_number}</span>
              <div className="flex flex-wrap items-center gap-2">
                {canWrite && viewing.status === 'draft' && (
                  <button type="button" onClick={() => { setViewing(null); openEdit(viewing); }} className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-white">
                    Modifier
                  </button>
                )}
                <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg ${uploading ? 'opacity-60' : 'hover:bg-white cursor-pointer'}`}>
                  <Upload className="w-3.5 h-3.5" /> {uploading ? 'Envoi…' : 'Joindre une pièce'}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadAttachment(file);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg">
                  <Printer className="w-3.5 h-3.5" /> Imprimer / PDF
                </button>
                <button type="button" onClick={() => setViewing(null)} className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-white">
                  Fermer
                </button>
              </div>
            </div>

            <div className="p-8 space-y-5 text-xs">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                <div>
                  <div className="text-base font-bold uppercase tracking-tight">Journal de chantier</div>
                  <div className="text-slate-600 mt-1">{viewing.project_title}</div>
                  <div className="text-slate-500">{viewing.project_number} · Client : {viewing.client_name}</div>
                  {viewing.project_address && <div className="text-slate-500">{viewing.project_address}</div>}
                </div>
                <div className="text-right space-y-1">
                  <div className="font-mono font-bold text-sm">{viewing.report_number}</div>
                  <div>{formatDateFr(viewing.report_date)}</div>
                  <StatusText status={viewing.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border border-slate-200 rounded-lg p-2.5">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Météo</div>
                  <div className="font-medium mt-1">{WEATHER_LABELS[viewing.weather] || '—'}</div>
                </div>
                <div className="border border-slate-200 rounded-lg p-2.5">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Température</div>
                  <div className="font-medium mt-1">{viewing.temperature_c === null || viewing.temperature_c === undefined ? '—' : `${formatNum(viewing.temperature_c, 1)} °C`}</div>
                </div>
                <div className="border border-slate-200 rounded-lg p-2.5">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Phase</div>
                  <div className="font-medium mt-1">{viewing.phase_name || '—'}</div>
                </div>
                <div className="border border-slate-200 rounded-lg p-2.5">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Tâche</div>
                  <div className="font-medium mt-1">{viewing.task_title || '—'}</div>
                </div>
              </div>

              {viewing.site_condition && (
                <div>
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">État du chantier</div>
                  <p className="mt-1 whitespace-pre-wrap">{viewing.site_condition}</p>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Travaux réalisés</div>
                <p className="mt-1 whitespace-pre-wrap border border-slate-200 rounded-lg p-3 bg-slate-50">{viewing.work_done}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(viewing.observations || viewing.incidents) && (
                  <>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500 font-semibold">Observations</div>
                      <p className="mt-1 whitespace-pre-wrap">{viewing.observations || '—'}</p>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500 font-semibold">Incidents</div>
                      <p className="mt-1 whitespace-pre-wrap">{viewing.incidents || '—'}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5">Main-d’œuvre ({formatNum(viewing.total_hours, 1)} h)</div>
                  <table className="w-full border-collapse border border-slate-300">
                    <thead><tr className="bg-slate-100"><th className="p-1.5 border border-slate-300 text-left">Salarié</th><th className="p-1.5 border border-slate-300 text-right w-16">Heures</th></tr></thead>
                    <tbody>
                      {(viewing.workforce || []).length === 0 ? (
                        <tr><td colSpan={2} className="p-1.5 border border-slate-300 text-slate-500">Aucun salarié déclaré.</td></tr>
                      ) : viewing.workforce.map((row: any) => (
                        <tr key={row.id}>
                          <td className="p-1.5 border border-slate-300">{row.worker_name}</td>
                          <td className="p-1.5 border border-slate-300 text-right tabular-nums">{formatNum(row.hours_worked, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5">Engins ({formatNum(viewing.total_equipment_hours, 1)} h)</div>
                  <table className="w-full border-collapse border border-slate-300">
                    <thead><tr className="bg-slate-100"><th className="p-1.5 border border-slate-300 text-left">Engin</th><th className="p-1.5 border border-slate-300 text-right w-16">Heures</th></tr></thead>
                    <tbody>
                      {(viewing.equipment || []).length === 0 ? (
                        <tr><td colSpan={2} className="p-1.5 border border-slate-300 text-slate-500">Aucun engin déclaré.</td></tr>
                      ) : viewing.equipment.map((row: any) => (
                        <tr key={row.id}>
                          <td className="p-1.5 border border-slate-300">{row.vehicle_name}</td>
                          <td className="p-1.5 border border-slate-300 text-right tabular-nums">{formatNum(row.hours_used, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5">Matériaux consommés</div>
                  <table className="w-full border-collapse border border-slate-300">
                    <thead><tr className="bg-slate-100"><th className="p-1.5 border border-slate-300 text-left">Matériau</th><th className="p-1.5 border border-slate-300 text-right w-20">Qté</th></tr></thead>
                    <tbody>
                      {(viewing.materials || []).length === 0 ? (
                        <tr><td colSpan={2} className="p-1.5 border border-slate-300 text-slate-500">Aucun matériau déclaré.</td></tr>
                      ) : viewing.materials.map((row: any) => (
                        <tr key={row.id}>
                          <td className="p-1.5 border border-slate-300">{row.material_name}</td>
                          <td className="p-1.5 border border-slate-300 text-right tabular-nums">{formatNum(row.quantity, 2)} {row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {(viewing.attachments || []).length > 0 && (
                <div className="no-print">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5">Pièces jointes</div>
                  <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    {viewing.attachments.map((doc: any) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 p-2">
                        <span className="truncate">{doc.title} <span className="text-slate-400">({doc.file_name})</span></span>
                        <button
                          type="button"
                          onClick={() => downloadWithAuth(`/documents/${doc.id}/download`, doc.file_name)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-slate-300 rounded-md"
                        >
                          <Download className="w-3 h-3" /> Télécharger
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 text-[11px]">
                <div>
                  <div className="font-semibold">Établi par</div>
                  <div className="mt-1">{viewing.created_by_name || '—'}</div>
                </div>
                <div>
                  <div className="font-semibold">Soumis par</div>
                  <div className="mt-1">{viewing.submitted_by_name || '—'}{viewing.submitted_at ? ` — ${formatDateFr(viewing.submitted_at)}` : ''}</div>
                </div>
                <div>
                  <div className="font-semibold">Contrôlé par</div>
                  <div className="mt-1">{viewing.reviewed_by_name || '—'}{viewing.reviewed_at ? ` — ${formatDateFr(viewing.reviewed_at)}` : ''}</div>
                </div>
              </div>
              {viewing.status === 'rejected' && viewing.rejection_reason && (
                <div className="p-3 border border-red-200 bg-red-50 rounded-lg text-red-800">
                  <span className="font-semibold">Motif du refus : </span>{viewing.rejection_reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer le brouillon" maxWidth="max-w-md">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Supprimer définitivement le rapport {deleteTarget?.report_number} du {deleteTarget ? formatDateFr(deleteTarget.report_date) : ''} ? Cette action est réservée aux brouillons et sera tracée dans le journal d’audit.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg">Annuler</button>
          <button type="button" onClick={deleteReport} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg">Supprimer</button>
        </div>
      </Modal>

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Refuser le rapport" maxWidth="max-w-md">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          Motif du refus *
          <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setRejectTarget(null)} className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg">Annuler</button>
          <button type="button" onClick={rejectReport} disabled={!rejectReason.trim()} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-60">Refuser</button>
        </div>
      </Modal>
    </div>
  );
}
