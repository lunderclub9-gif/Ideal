import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Plus, X } from 'lucide-react';
import { apiFetch, formatDA, formatDateFr, hasPerm } from '../lib/api';
import { Modal, PageHeader, StatusText } from '../components/ui';

export default function ProjectsPage({ permissions }: { permissions: string[] }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [tab, setTab] = useState<'overview' | 'tasks' | 'avenants' | 'contracts' | 'costs'>('overview');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [taskOpen, setTaskOpen] = useState(false);
  const [avenantOpen, setAvenantOpen] = useState(false);
  const [error, setError] = useState('');

  const [newProj, setNewProj] = useState({
    client_id: '',
    title: '',
    address: '',
    project_type: 'Travaux généraux BTP',
    start_date: new Date().toISOString().slice(0, 10),
    expected_end_date: '',
    expected_cost: 0,
    expected_selling_price: 0,
    include_overhead: false,
    notes: '',
  });
  const [newTask, setNewTask] = useState({ title: '', phase_id: '', assigned_worker_id: '', planned_start: '', due_date: '', status: 'planned', delay_reason: '' });
  const [newAvenant, setNewAvenant] = useState({ title: '', description: '', additional_price: 0, additional_cost: 0 });
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [newPhase, setNewPhase] = useState({ name: '', sort_order: 1, status: 'planned' });
  const [contractOpen, setContractOpen] = useState(false);
  const [newContract, setNewContract] = useState({
    reference: '',
    signing_date: new Date().toISOString().slice(0, 10),
    start_date: new Date().toISOString().slice(0, 10),
    planned_end_date: '',
    contract_amount: 0,
    retention_rate: 5,
    notes: '',
    milestones: [{ title: '', due_date: new Date().toISOString().slice(0, 10), expected_amount: 0 }],
  });
  const [milestoneDraft, setMilestoneDraft] = useState<Record<number, number>>({});
  const [milestoneBusy, setMilestoneBusy] = useState<number | null>(null);

  const canWrite = hasPerm(permissions, 'projects:write');
  const canApprove = hasPerm(permissions, 'projects:approve');

  async function loadList() {
    try {
      const [p, c, w, workTypes] = await Promise.all([apiFetch('/projects'), apiFetch('/clients'), apiFetch('/workers'), apiFetch('/services')]);
      setProjects(p);
      setClients(c);
      setWorkers(w);
      setServices(workTypes);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function openDetail(id: number) {
    try {
      setSelected(await apiFetch(`/projects/${id}`));
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  function openEditProject() {
    if (!selected) return;
    const p = selected.project;
    setEditForm({
      client_id: String(p.client_id || ''),
      title: p.title || '',
      address: p.address || '',
      project_type: p.project_type || 'Travaux généraux BTP',
      start_date: p.start_date || '',
      expected_end_date: p.expected_end_date || '',
      actual_end_date: p.actual_end_date || '',
      status: p.status || 'in_progress',
      expected_cost: Number(p.expected_cost || 0),
      expected_selling_price: Number(p.expected_selling_price || 0),
      progress_percent: Number(p.progress_percent || 0),
      include_overhead: !!p.include_overhead,
      notes: p.notes || '',
    });
    setEditOpen(true);
  }

  async function saveProject(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      await apiFetch(`/projects/${selected.project.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...editForm, client_id: Number(editForm.client_id) }),
      });
      setEditOpen(false);
      await openDetail(selected.project.id);
      await loadList();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/projects', { method: 'POST', body: JSON.stringify(newProj) });
      setCreateOpen(false);
      await loadList();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await apiFetch(`/projects/${selected.project.id}/tasks`, { method: 'POST', body: JSON.stringify(newTask) });
      setTaskOpen(false);
      setNewTask({ title: '', phase_id: '', assigned_worker_id: '', planned_start: '', due_date: '', status: 'planned', delay_reason: '' });
      await openDetail(selected.project.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddPhase(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      await apiFetch(`/projects/${selected.project.id}/phases`, {
        method: 'POST',
        body: JSON.stringify({ ...newPhase, sort_order: Number(newPhase.sort_order) || 1 }),
      });
      setPhaseOpen(false);
      setNewPhase({ name: '', sort_order: 1, status: 'planned' });
      await openDetail(selected.project.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddContract(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      await apiFetch('/contracts', {
        method: 'POST',
        body: JSON.stringify({
          ...newContract,
          client_id: Number(selected.project.client_id),
          project_id: selected.project.id,
          contract_amount: Number(newContract.contract_amount),
          retention_rate: Number(newContract.retention_rate),
          milestones: newContract.milestones.filter((m) => m.title.trim() !== ''),
        }),
      });
      setContractOpen(false);
      setNewContract({
        reference: '',
        signing_date: new Date().toISOString().slice(0, 10),
        start_date: new Date().toISOString().slice(0, 10),
        planned_end_date: '',
        contract_amount: 0,
        retention_rate: 5,
        notes: '',
        milestones: [{ title: '', due_date: new Date().toISOString().slice(0, 10), expected_amount: 0 }],
      });
      await openDetail(selected.project.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveMilestoneReceived(milestone: any) {
    const value = milestoneDraft[milestone.id];
    if (value === undefined) return;
    if (!selected) return;
    setError('');
    setMilestoneBusy(milestone.id);
    try {
      await apiFetch(`/contracts/milestones/${milestone.id}`, {
        method: 'PUT',
        body: JSON.stringify({ received_amount: Number(value) }),
      });
      setMilestoneDraft((d) => {
        const next = { ...d };
        delete next[milestone.id];
        return next;
      });
      await openDetail(selected.project.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMilestoneBusy(null);
    }
  }

  async function updateTaskStatus(task: any, status: string) {
    let delayReason = task.delay_reason;
    if (status === 'delayed' && !delayReason) {
      delayReason = 'Retard signalé sur chantier (approvisionnement / intempéries)';
    }
    try {
      await apiFetch(`/projects/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, delay_reason: delayReason }),
      });
      await openDetail(selected.project.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function updateTaskAssignee(task: any, workerId: string) {
    try {
      await apiFetch(`/projects/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ assigned_worker_id: workerId || null }),
      });
      await openDetail(selected.project.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function addTaskDependency(successorTaskId: number, predecessorTaskId: number) {
    if (!selected || !predecessorTaskId) return;
    setError('');
    try {
      await apiFetch(`/projects/${selected.project.id}/task-dependencies`, {
        method: 'POST',
        body: JSON.stringify({ predecessor_task_id: predecessorTaskId, successor_task_id: successorTaskId }),
      });
      await openDetail(selected.project.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeTaskDependency(dependencyId: number) {
    if (!selected) return;
    setError('');
    try {
      await apiFetch(`/projects/${selected.project.id}/task-dependencies/${dependencyId}`, { method: 'DELETE' });
      await openDetail(selected.project.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddAvenant(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await apiFetch(`/projects/${selected.project.id}/change-orders`, { method: 'POST', body: JSON.stringify(newAvenant) });
      setAvenantOpen(false);
      setNewAvenant({ title: '', description: '', additional_price: 0, additional_cost: 0 });
      await openDetail(selected.project.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function approveAvenant(id: number, decision: 'approved' | 'rejected') {
    try {
      await apiFetch(`/projects/change-orders/${id}/approve`, { method: 'POST', body: JSON.stringify({ decision }) });
      await openDetail(selected.project.id);
      await loadList();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleOverhead(proj: any) {
    try {
      await apiFetch(`/projects/${proj.id}`, {
        method: 'PUT',
        body: JSON.stringify({ include_overhead: !proj.include_overhead }),
      });
      await openDetail(proj.id);
      await loadList();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (selected) {
    const p = selected.project;
    const f = selected.financials;
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="p-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">{p.project_number}</span>
                <StatusText status={p.status} />
              </div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{p.title}</h1>
              <p className="text-xs text-slate-500">Client : {p.client_name} · {p.address}</p>
            </div>
          </div>
          {canWrite && (
            <button type="button" onClick={openEditProject} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg">
              Modifier le chantier
            </button>
          )}
          {canWrite && (
            <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer bg-white dark:bg-slate-900 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg">
              <input
                type="checkbox"
                checked={!!p.include_overhead}
                onChange={() => toggleOverhead(p)}
              />
              Inclure frais généraux (8%) dans coût réel
            </label>
          )}
        </div>

        {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

        {/* Financial Transparency Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-500">Marché révisé (vente)</div>
            <div className="font-mono tabular-nums text-sm font-bold mt-1">{formatDA(f.revised_contract_value)}</div>
            <div className="text-[11px] text-slate-400">dont avenants +{formatDA(f.approved_avenants_price)}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-500">Budget coût révisé</div>
            <div className="font-mono tabular-nums text-sm font-bold mt-1">{formatDA(f.revised_budget_cost)}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-500">Coût réel cumulé</div>
            <div className="font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-white mt-1">{formatDA(f.total_actual_cost)}</div>
            <div className={`text-[11px] font-mono ${f.budget_variance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              Écart : {f.budget_variance >= 0 ? '+' : ''}{formatDA(f.budget_variance)}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-500">Facturé HT</div>
            <div className="font-mono tabular-nums text-sm font-bold text-blue-700 mt-1">{formatDA(f.invoiced_ht)}</div>
            <div className="text-[11px] text-slate-400">TTC : {formatDA(f.invoiced_ttc)}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-500">Encaissé réel</div>
            <div className="font-mono tabular-nums text-sm font-bold text-emerald-700 mt-1">{formatDA(f.collected_cash)}</div>
            <div className="text-[11px] text-slate-400">Reste : {formatDA(f.remaining_to_collect)}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-500">Bénéfice net chantier</div>
            <div className={`font-mono tabular-nums text-sm font-bold mt-1 ${f.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatDA(f.net_profit)}
            </div>
            <div className="text-[11px] font-mono text-slate-400">Marge : {f.margin_percent}%</div>
          </div>
        </div>

        {/* Subtabs */}
        <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 text-xs">
          {[
            ['overview', 'Décomposition des coûts'],
            ['tasks', `Phases & Tâches (${selected.tasks.length})`],
            ['avenants', `Avenants (${selected.changeOrders.length})`],
            ['contracts', `Contrats & Jalons (${selected.contracts.length})`],
            ['costs', `Mouvements & Dépenses`],
          ].map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k as any)}
              className={`px-3.5 py-2 font-medium border-b-2 transition-colors ${
                tab === k ? 'border-blue-700 text-blue-700 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-xs">
            <h3 className="font-semibold text-sm mb-3">Calcul détaillé sans double comptage</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {[
                  ['Matériaux sortis du stock (net des retours)', f.materials_cost],
                  ['Main-d’œuvre (pointages validés uniquement)', f.labor_cost],
                  ['Carburant affecté au chantier', f.fuel_cost],
                  ['Réparations directes imputées', f.repairs_cost],
                  ['Location / usage engins internes', f.equipment_cost],
                  ['Dépenses directes chantier', f.direct_expenses_cost],
                  ['Frais généraux imputés (si activé)', f.overhead_cost],
                ].map(([label, val]: any) => (
                  <div key={label} className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">{label}</span>
                    <span className="font-mono tabular-nums font-medium">{formatDA(val)}</span>
                  </div>
                ))}
                <div className="px-4 py-3 flex justify-between bg-slate-50 dark:bg-slate-800/60 font-bold">
                  <span>Coût réel total du chantier</span>
                  <span className="font-mono tabular-nums">{formatDA(f.total_actual_cost)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="font-semibold mb-1">Informations d’exécution</div>
                  <div className="text-slate-500 space-y-1">
                    <div>Démarrage : <span className="font-mono text-slate-800 dark:text-slate-200">{formatDateFr(p.start_date)}</span></div>
                    <div>Fin prévue : <span className="font-mono text-slate-800 dark:text-slate-200">{formatDateFr(p.expected_end_date)}</span></div>
                    <div>Avancement déclaré : <span className="font-mono text-slate-800 dark:text-slate-200">{p.progress_percent}%</span></div>
                    <div>Chef de chantier : <span className="text-slate-800 dark:text-slate-200">{p.manager_name || '—'}</span></div>
                  </div>
                </div>
                {p.notes && (
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                    <div className="font-semibold mb-1">Notes chantier</div>
                    {p.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Phases, tâches &amp; suivi des retards</h3>
              {canWrite && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPhaseOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-700 text-blue-700 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nouvelle phase
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-white bg-blue-700 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter tâche
                  </button>
                </div>
              )}
            </div>
            {selected.phases.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.phases.map((ph: any) => (
                  <span key={ph.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                    {ph.name}
                    <StatusText status={ph.status} />
                  </span>
                ))}
              </div>
            )}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {selected.tasks.map((t: any) => (
                <div key={t.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{t.title}</div>
                    <div className="text-[11px] text-slate-500">
                      Responsable : {t.worker_name || 'Non assigné'} · Début : {formatDateFr(t.planned_start)} · Échéance : {formatDateFr(t.due_date)}
                    </div>
                    {(selected.taskDependencies || []).filter((d: any) => d.successor_task_id === t.id).length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                        <span>Précédée par :</span>
                        {(selected.taskDependencies || []).filter((d: any) => d.successor_task_id === t.id).map((d: any) => {
                          const predecessor = selected.tasks.find((candidate: any) => candidate.id === d.predecessor_task_id);
                          return (
                            <span key={d.id} className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                              {predecessor?.title || `Tâche #${d.predecessor_task_id}`}
                              {canWrite && <button type="button" onClick={() => removeTaskDependency(d.id)} className="text-red-600 hover:text-red-800" aria-label="Retirer la dépendance">×</button>}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {t.delay_reason && (
                      <div className="text-[11px] text-red-700 dark:text-red-400 mt-1">
                        Motif du retard : {t.delay_reason}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusText status={t.status} />
                    {canWrite && (
                      <>
                        <select
                          aria-label={`Responsable de ${t.title}`}
                          value={t.assigned_worker_id || ''}
                          onChange={(e) => updateTaskAssignee(t, e.target.value)}
                          className="max-w-[190px] px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                        >
                          <option value="">Non assigné</option>
                          {workers.filter((w) => w.status === 'active' || w.id === t.assigned_worker_id).map((w) => (
                            <option key={w.id} value={w.id}>{w.full_name}</option>
                          ))}
                        </select>
                        <select
                          aria-label={`Ajouter une tâche précédente à ${t.title}`}
                          value=""
                          onChange={(e) => { const predecessorId = Number(e.target.value); if (predecessorId) addTaskDependency(t.id, predecessorId); }}
                          className="max-w-[190px] px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                        >
                          <option value="">Ajouter une dépendance…</option>
                          {selected.tasks.filter((candidate: any) =>
                            candidate.id !== t.id &&
                            !(selected.taskDependencies || []).some((d: any) => d.predecessor_task_id === candidate.id && d.successor_task_id === t.id)
                          ).map((candidate: any) => (
                            <option key={candidate.id} value={candidate.id}>{candidate.title}</option>
                          ))}
                        </select>
                        <select
                          aria-label={`Statut de ${t.title}`}
                          value={t.status}
                          onChange={(e) => updateTaskStatus(t, e.target.value)}
                          className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                        >
                          <option value="planned">Planifié</option>
                          <option value="in_progress">En cours</option>
                          <option value="delayed">En retard</option>
                          <option value="completed">Terminé</option>
                        </select>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {selected.tasks.length === 0 && <div className="p-8 text-center text-slate-500">Aucune tâche. Ajoutez une tâche puis affectez un salarié.</div>}
            </div>
          </div>
        )}

        {tab === 'avenants' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Avenants &amp; travaux supplémentaires</h3>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setAvenantOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-white bg-blue-700 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Nouvel avenant
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {selected.changeOrders.map((co: any) => (
                <div key={co.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-mono font-semibold text-slate-900 dark:text-white">{co.reference} — {co.title}</div>
                    <div className="text-slate-500 mt-0.5">{co.description}</div>
                    <div className="mt-1 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      Prix client : +{formatDA(co.additional_price)} · Coût estimé : +{formatDA(co.additional_cost)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusText status={co.approval_status} />
                    {canApprove && co.approval_status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => approveAvenant(co.id, 'approved')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 text-white rounded"
                        >
                          <Check className="w-3 h-3" /> Valider
                        </button>
                        <button
                          type="button"
                          onClick={() => approveAvenant(co.id, 'rejected')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-700 text-white rounded"
                        >
                          <X className="w-3 h-3" /> Refuser
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'contracts' && (
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Contrats &amp; échéancier de retenue de garantie</h3>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setContractOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-white bg-blue-700 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Nouveau contrat
                </button>
              )}
            </div>
            {selected.contracts.length === 0 && (
              <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                Aucun contrat enregistré. Créez un contrat pour suivre les jalons et la retenue de garantie.
              </div>
            )}
            {selected.contracts.map((ctr: any) => (
              <div key={ctr.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <div className="flex flex-wrap justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="font-mono font-bold text-sm">{ctr.reference}</div>
                    <div className="text-slate-500">{ctr.notes}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="font-bold">Montant contrat : {formatDA(ctr.contract_amount)}</div>
                    <div className="text-amber-700">Retenue de garantie ({ctr.retention_rate}%) : {formatDA(ctr.retention_amount)}</div>
                  </div>
                </div>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {ctr.milestones.map((m: any) => (
                    <div key={m.id} className="py-2.5 flex justify-between items-center">
                      <div>
                        <div className="font-medium">{m.title}</div>
                        <div className="text-[11px] text-slate-500">Échéance : {formatDateFr(m.due_date)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono tabular-nums">
                          {formatDA(m.received_amount)} / {formatDA(m.expected_amount)}
                        </span>
                        <StatusText status={m.status} />
                        {canWrite && (
                          <span className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              aria-label={`Montant reçu pour ${m.title}`}
                              value={milestoneDraft[m.id] ?? ''}
                              placeholder="Reçu"
                              onChange={(e) => setMilestoneDraft((d) => ({ ...d, [m.id]: Number(e.target.value) }))}
                              className="w-24 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-right font-mono"
                            />
                            <button
                              type="button"
                              disabled={milestoneBusy === m.id || milestoneDraft[m.id] === undefined}
                              onClick={() => saveMilestoneReceived(m)}
                              className="px-2 py-1 bg-emerald-700 text-white rounded disabled:opacity-50"
                            >
                              Encaisser
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'costs' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <h4 className="font-semibold mb-2">Matériaux sortis sur ce chantier</h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {selected.stockMovements.map((sm: any) => (
                  <div key={sm.id} className="py-2 flex justify-between">
                    <div>
                      <div className="font-medium">{sm.material_name}</div>
                      <div className="text-[11px] text-slate-500">{formatDateFr(sm.movement_date)} · {sm.reference}</div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div>{sm.quantity} {sm.unit}</div>
                      <div className="font-semibold">{formatDA(sm.total_cost)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <h4 className="font-semibold mb-2">Dépenses directes &amp; carburant</h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {selected.expenses.map((e: any) => (
                  <div key={`exp-${e.id}`} className="py-2 flex justify-between">
                    <div>
                      <div className="font-medium">{e.description}</div>
                      <div className="text-[11px] text-slate-500">{formatDateFr(e.expense_date)} · {e.category}</div>
                    </div>
                    <div className="font-mono tabular-nums font-semibold">{formatDA(e.amount)}</div>
                  </div>
                ))}
                {selected.fuel.map((fl: any) => (
                  <div key={`fuel-${fl.id}`} className="py-2 flex justify-between">
                    <div>
                      <div className="font-medium">Carburant — {fl.vehicle_name}</div>
                      <div className="text-[11px] text-slate-500">{formatDateFr(fl.date)} · {fl.liters} L</div>
                    </div>
                    <div className="font-mono tabular-nums font-semibold">{formatDA(fl.total_cost)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <Modal open={phaseOpen} onClose={() => setPhaseOpen(false)} title="Nouvelle phase de chantier" maxWidth="max-w-md">
          <form onSubmit={handleAddPhase} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium mb-1">Nom de la phase *</label>
              <input
                type="text"
                required
                value={newPhase.name}
                onChange={(e) => setNewPhase({ ...newPhase, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Ordre d’affichage</label>
                <input
                  type="number"
                  min="1"
                  value={newPhase.sort_order}
                  onChange={(e) => setNewPhase({ ...newPhase, sort_order: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Statut</label>
                <select
                  value={newPhase.status}
                  onChange={(e) => setNewPhase({ ...newPhase, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                >
                  <option value="planned">Planifiée</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminée</option>
                  <option value="delayed">En retard</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPhaseOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
              <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Ajouter la phase</button>
            </div>
          </form>
        </Modal>

        <Modal open={contractOpen} onClose={() => setContractOpen(false)} title="Nouveau contrat chantier">
          <form onSubmit={handleAddContract} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Montant du contrat (DA) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={newContract.contract_amount}
                  onChange={(e) => setNewContract({ ...newContract, contract_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Retenue de garantie (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={newContract.retention_rate}
                  onChange={(e) => setNewContract({ ...newContract, retention_rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium mb-1">Date de signature</label>
                <input
                  type="date"
                  value={newContract.signing_date}
                  onChange={(e) => setNewContract({ ...newContract, signing_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Début</label>
                <input
                  type="date"
                  value={newContract.start_date}
                  onChange={(e) => setNewContract({ ...newContract, start_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Fin prévue</label>
                <input
                  type="date"
                  value={newContract.planned_end_date}
                  onChange={(e) => setNewContract({ ...newContract, planned_end_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium mb-1">Référence (laisser vide pour générer)</label>
              <input
                type="text"
                value={newContract.reference}
                onChange={(e) => setNewContract({ ...newContract, reference: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Jalons de paiement</span>
                <button
                  type="button"
                  onClick={() => setNewContract({ ...newContract, milestones: [...newContract.milestones, { title: '', due_date: new Date().toISOString().slice(0, 10), expected_amount: 0 }] })}
                  className="inline-flex items-center gap-1 text-blue-700"
                >
                  <Plus className="w-3 h-3" /> Ajouter un jalon
                </button>
              </div>
              {newContract.milestones.map((m, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <label className="block text-[11px] text-slate-500 mb-1">Intitulé</label>
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => {
                        const milestones = [...newContract.milestones];
                        milestones[idx] = { ...m, title: e.target.value };
                        setNewContract({ ...newContract, milestones });
                      }}
                      className="w-full px-2 py-1.5 border rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[11px] text-slate-500 mb-1">Échéance</label>
                    <input
                      type="date"
                      value={m.due_date}
                      onChange={(e) => {
                        const milestones = [...newContract.milestones];
                        milestones[idx] = { ...m, due_date: e.target.value };
                        setNewContract({ ...newContract, milestones });
                      }}
                      className="w-full px-2 py-1.5 border rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[11px] text-slate-500 mb-1">Montant (DA)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={m.expected_amount}
                      onChange={(e) => {
                        const milestones = [...newContract.milestones];
                        milestones[idx] = { ...m, expected_amount: Number(e.target.value) };
                        setNewContract({ ...newContract, milestones });
                      }}
                      className="w-full px-2 py-1.5 border rounded-lg font-mono bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      aria-label="Supprimer ce jalon"
                      disabled={newContract.milestones.length === 1}
                      onClick={() => setNewContract({ ...newContract, milestones: newContract.milestones.filter((_, i) => i !== idx) })}
                      className="p-1.5 text-red-700 disabled:opacity-30"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="block font-medium mb-1">Notes</label>
              <textarea
                value={newContract.notes}
                onChange={(e) => setNewContract({ ...newContract, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setContractOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
              <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Créer le contrat</button>
            </div>
          </form>
        </Modal>

        <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title="Nouvelle tâche chantier">
          <form onSubmit={handleAddTask} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium mb-1">Intitulé de la tâche *</label>
              <input
                type="text"
                required
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Phase</label>
                <select
                  value={newTask.phase_id}
                  onChange={(e) => setNewTask({ ...newTask, phase_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                >
                  <option value="">Aucune phase</option>
                  {selected.phases.map((ph: any) => (
                    <option key={ph.id} value={ph.id}>{ph.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Ouvrier responsable</label>
                <select
                  value={newTask.assigned_worker_id}
                  onChange={(e) => setNewTask({ ...newTask, assigned_worker_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                >
                  <option value="">Non assigné</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>{w.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Début prévu</label>
                <input
                  type="date"
                  value={newTask.planned_start}
                  onChange={(e) => setNewTask({ ...newTask, planned_start: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Date d’échéance</label>
                <input
                  type="date"
                  value={newTask.due_date}
                  min={newTask.planned_start || undefined}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setTaskOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
              <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Ajouter</button>
            </div>
          </form>
        </Modal>

        <Modal open={avenantOpen} onClose={() => setAvenantOpen(false)} title="Créer un avenant chantier">
          <form onSubmit={handleAddAvenant} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium mb-1">Intitulé de l’avenant *</label>
              <input
                type="text"
                required
                value={newAvenant.title}
                onChange={(e) => setNewAvenant({ ...newAvenant, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Description des travaux supplémentaires</label>
              <textarea
                value={newAvenant.description}
                onChange={(e) => setNewAvenant({ ...newAvenant, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Prix supplémentaire client (DA)</label>
                <input
                  type="number"
                  value={newAvenant.additional_price}
                  onChange={(e) => setNewAvenant({ ...newAvenant, additional_price: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Coût estimé supplémentaire (DA)</label>
                <input
                  type="number"
                  value={newAvenant.additional_cost}
                  onChange={(e) => setNewAvenant({ ...newAvenant, additional_cost: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setAvenantOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
              <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Soumettre à validation</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Chantiers & Travaux"
        subtitle="Suivi de rentabilité réelle, phases, retards, avenants et retenues de garantie"
        actions={
          canWrite && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" /> Nouveau chantier
            </button>
          )
        }
      />

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => {
          const f = p.financials;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openDetail(p.id)}
              className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-blue-500 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">{p.project_number}</span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{p.title}</h3>
                  <p className="text-xs text-slate-500">{p.client_name} · {p.project_type}</p>
                </div>
                <StatusText status={p.status} />
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-slate-500">Marché révisé</div>
                  <div className="font-mono tabular-nums font-semibold">{formatDA(f.revised_contract_value)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Coût réel</div>
                  <div className="font-mono tabular-nums font-semibold">{formatDA(f.total_actual_cost)}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500">Bénéfice net</div>
                  <div className={`font-mono tabular-nums font-bold ${f.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatDA(f.net_profit)}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Créer un nouveau chantier">
        <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Client *</label>
              <select
                required
                value={newProj.client_id}
                onChange={(e) => setNewProj({ ...newProj, client_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="">Sélectionner un client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Type de travaux</label>
              <select
                value={newProj.project_type}
                onChange={(e) => setNewProj({ ...newProj, project_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="">Sélectionner un type de travaux...</option>
                {services.filter((service) => service.active).map((service) => (
                  <option key={service.id} value={service.name}>{service.name} — {service.unit}</option>
                ))}
                {newProj.project_type && !services.some((service) => service.active && service.name === newProj.project_type) && (
                  <option value={newProj.project_type}>{newProj.project_type} (type historique)</option>
                )}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">La liste provient du Catalogue des types de travaux. Gérez-la depuis le menu « Types de travaux ».</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Intitulé du chantier *</label>
              <input
                type="text"
                required
                value={newProj.title}
                onChange={(e) => setNewProj({ ...newProj, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Adresse du chantier</label>
              <input
                type="text"
                value={newProj.address}
                onChange={(e) => setNewProj({ ...newProj, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Date de début</label>
              <input
                type="date"
                value={newProj.start_date}
                onChange={(e) => setNewProj({ ...newProj, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Date de fin prévue</label>
              <input
                type="date"
                value={newProj.expected_end_date}
                onChange={(e) => setNewProj({ ...newProj, expected_end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Coût prévisionnel (DA)</label>
              <input
                type="number"
                value={newProj.expected_cost}
                onChange={(e) => setNewProj({ ...newProj, expected_cost: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Prix de vente / Marché HT (DA)</label>
              <input
                type="number"
                value={newProj.expected_selling_price}
                onChange={(e) => setNewProj({ ...newProj, expected_selling_price: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg font-medium">Créer le chantier</button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Modifier le chantier" maxWidth="max-w-2xl">
        <form onSubmit={saveProject} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Client *</label>
              <select required value={editForm.client_id || ''} onChange={e => setEditForm({ ...editForm, client_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Intitulé *</label>
              <input required value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">Type de travaux</label>
              <select value={editForm.project_type || ''} onChange={e => setEditForm({ ...editForm, project_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                {services.map(service => <option key={service.id} value={service.name}>{service.name}</option>)}
                {editForm.project_type && !services.some(service => service.name === editForm.project_type) && <option value={editForm.project_type}>{editForm.project_type}</option>}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Statut</label>
              <select value={editForm.status || 'in_progress'} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="draft">Brouillon</option><option value="waiting_approval">En attente</option><option value="in_progress">En cours</option><option value="suspended">Suspendu</option><option value="completed">Terminé</option><option value="cancelled">Annulé</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Adresse</label>
              <input value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </div>
            <div><label className="block font-medium mb-1">Début</label><input type="date" value={editForm.start_date || ''} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
            <div><label className="block font-medium mb-1">Fin prévue</label><input type="date" value={editForm.expected_end_date || ''} onChange={e => setEditForm({ ...editForm, expected_end_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
            <div><label className="block font-medium mb-1">Fin réelle</label><input type="date" value={editForm.actual_end_date || ''} onChange={e => setEditForm({ ...editForm, actual_end_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
            <div><label className="block font-medium mb-1">Avancement (%)</label><input type="number" min="0" max="100" value={editForm.progress_percent ?? 0} onChange={e => setEditForm({ ...editForm, progress_percent: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
            <div><label className="block font-medium mb-1">Coût prévisionnel (DA)</label><input type="number" min="0" value={editForm.expected_cost ?? 0} onChange={e => setEditForm({ ...editForm, expected_cost: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
            <div><label className="block font-medium mb-1">Prix de vente HT (DA)</label><input type="number" min="0" value={editForm.expected_selling_price ?? 0} onChange={e => setEditForm({ ...editForm, expected_selling_price: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!editForm.include_overhead} onChange={e => setEditForm({ ...editForm, include_overhead: e.target.checked })} /> Inclure les frais généraux</label>
          <div><label className="block font-medium mb-1">Notes</label><textarea rows={3} value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button><button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Enregistrer les modifications</button></div>
        </form>
      </Modal>
    </div>
  );
}
