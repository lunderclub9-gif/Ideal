import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Plus, X } from 'lucide-react';
import { apiFetch, formatDA, formatDateFr, hasPerm } from '../lib/api';
import { Modal, PageHeader, StatusText } from '../components/ui';

export default function ProjectsPage({ permissions }: { permissions: string[] }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [tab, setTab] = useState<'overview' | 'tasks' | 'avenants' | 'contracts' | 'costs'>('overview');
  const [createOpen, setCreateOpen] = useState(false);
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
  const [newTask, setNewTask] = useState({ title: '', phase_id: '', assigned_worker_id: '', due_date: '', status: 'planned', delay_reason: '' });
  const [newAvenant, setNewAvenant] = useState({ title: '', description: '', additional_price: 0, additional_cost: 0 });

  const canWrite = hasPerm(permissions, 'projects:write');
  const canApprove = hasPerm(permissions, 'projects:approve');

  async function loadList() {
    try {
      const [p, c, w] = await Promise.all([apiFetch('/projects'), apiFetch('/clients'), apiFetch('/workers')]);
      setProjects(p);
      setClients(c);
      setWorkers(w);
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
      setNewTask({ title: '', phase_id: '', assigned_worker_id: '', due_date: '', status: 'planned', delay_reason: '' });
      await openDetail(selected.project.id);
    } catch (err: any) {
      setError(err.message);
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
              <h3 className="font-semibold text-sm">Tâches &amp; suivi des retards</h3>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setTaskOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-white bg-blue-700 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter tâche
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {selected.tasks.map((t: any) => (
                <div key={t.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{t.title}</div>
                    <div className="text-[11px] text-slate-500">
                      Responsable : {t.worker_name || 'Non assigné'} · Échéance : {formatDateFr(t.due_date)}
                    </div>
                    {t.delay_reason && (
                      <div className="text-[11px] text-red-700 dark:text-red-400 mt-1">
                        Motif du retard : {t.delay_reason}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusText status={t.status} />
                    {canWrite && (
                      <select
                        value={t.status}
                        onChange={(e) => updateTaskStatus(t, e.target.value)}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950"
                      >
                        <option value="planned">Planifié</option>
                        <option value="in_progress">En cours</option>
                        <option value="delayed">En retard</option>
                        <option value="completed">Terminé</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
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
                      <div className="flex items-center gap-4">
                        <span className="font-mono tabular-nums">
                          {formatDA(m.received_amount)} / {formatDA(m.expected_amount)}
                        </span>
                        <StatusText status={m.status} />
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
            <div>
              <label className="block font-medium mb-1">Date d’échéance</label>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
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
                <option>Plomberie &amp; Sanitaire</option>
                <option>Carrelage &amp; Revêtement</option>
                <option>Peinture &amp; Décoration</option>
                <option>Travaux généraux BTP</option>
                <option>Transport &amp; Terrassement</option>
              </select>
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
    </div>
  );
}
