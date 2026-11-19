import React, { useEffect, useState } from 'react';
import { Calculator, CheckCircle2, Download, Lock, Plus, Printer, Pencil, Search, UserRound } from 'lucide-react';
import { apiFetch, downloadWithAuth, formatDA, hasPerm } from '../lib/api';
import { Modal, PageHeader, PayslipPrintModal, StatusText } from '../components/ui';

export default function PayrollPage({ permissions }: { permissions: string[] }) {
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<any | null>(null);
  const [slips, setSlips] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [tab, setTab] = useState<'payroll' | 'workers'>('payroll');
  const [calcMonth, setCalcMonth] = useState(11);
  const [calcYear, setCalcYear] = useState(2026);
  const [printSlip, setPrintSlip] = useState<any | null>(null);
  const [workerModal, setWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any | null>(null);
  const [workerQuery, setWorkerQuery] = useState('');
  const [workerStatusFilter, setWorkerStatusFilter] = useState('all');
  const [savingWorker, setSavingWorker] = useState(false);
  const [editSlip, setEditSlip] = useState<any | null>(null);
  const [error, setError] = useState('');

  const emptyWorkerForm = {
    full_name: '',
    job_title: '',
    wage_type: 'daily',
    daily_wage: 0,
    hourly_rate: 0,
    monthly_salary: 0,
    work_schedule: '08:00 - 16:30',
    cnas_number: '',
    phone: '',
    address: '',
    hire_date: new Date().toISOString().slice(0, 10),
    status: 'active',
    notes: '',
  };
  const [wForm, setWForm] = useState<any>(emptyWorkerForm);

  const canWrite = hasPerm(permissions, 'payroll:write');
  const canApprove = hasPerm(permissions, 'payroll:approve');

  async function load() {
    try {
      const [per, w, comp] = await Promise.all([
        apiFetch('/payroll/periods'),
        apiFetch('/workers'),
        apiFetch('/settings'),
      ]);
      setPeriods(per);
      setWorkers(w);
      setCompany(comp);
      if (per.length > 0 && !selectedPeriod) {
        await openPeriod(per[0].id);
      } else if (selectedPeriod) {
        await openPeriod(selectedPeriod.id);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function openPeriod(id: number) {
    const res = await apiFetch(`/payroll/periods/${id}`);
    setSelectedPeriod(res.period);
    setSlips(res.payslips);
  }

  useEffect(() => {
    load();
  }, []);

  async function calculatePayroll() {
    setError('');
    try {
      const res = await apiFetch('/payroll/calculate', {
        method: 'POST',
        body: JSON.stringify({ month: calcMonth, year: calcYear }),
      });
      const per = await apiFetch('/payroll/periods');
      setPeriods(per);
      await openPeriod(res.periodId);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function approvePayroll(id: number) {
    setError('');
    try {
      await apiFetch(`/payroll/periods/${id}/approve`, { method: 'POST' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveSlipEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSlip) return;
    try {
      await apiFetch(`/payroll/payslips/${editSlip.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          bonus_amount: Number(editSlip.bonus_amount),
          penalties_deducted: Number(editSlip.penalties_deducted),
          other_deductions: Number(editSlip.other_deductions),
        }),
      });
      setEditSlip(null);
      await openPeriod(selectedPeriod.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function openNewWorker() {
    setEditingWorker(null);
    setWForm({ ...emptyWorkerForm });
    setError('');
    setWorkerModal(true);
  }

  function openEditWorker(worker: any) {
    setEditingWorker(worker);
    setWForm({
      ...emptyWorkerForm,
      ...worker,
      daily_wage: Number(worker.daily_wage || 0),
      hourly_rate: Number(worker.hourly_rate || 0),
      monthly_salary: Number(worker.monthly_salary || 0),
    });
    setError('');
    setWorkerModal(true);
  }

  async function saveWorker(e: React.FormEvent) {
    e.preventDefault();
    if (savingWorker) return;
    setSavingWorker(true);
    setError('');
    try {
      const payload = {
        ...wForm,
        full_name: String(wForm.full_name || '').trim(),
        job_title: String(wForm.job_title || '').trim(),
        daily_wage: Number(wForm.daily_wage || 0),
        hourly_rate: Number(wForm.hourly_rate || 0),
        monthly_salary: Number(wForm.monthly_salary || 0),
      };
      await apiFetch(editingWorker ? `/workers/${editingWorker.id}` : '/workers', {
        method: editingWorker ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setWorkerModal(false);
      setEditingWorker(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingWorker(false);
    }
  }

  const visibleWorkers = workers.filter((worker) => {
    const term = workerQuery.trim().toLocaleLowerCase();
    const matchesText = !term || [worker.full_name, worker.job_title, worker.phone, worker.cnas_number]
      .some((value) => String(value || '').toLocaleLowerCase().includes(term));
    return matchesText && (workerStatusFilter === 'all' || worker.status === workerStatusFilter);
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Personnel & Paie (CNAS / IRG Algérie)"
        subtitle="Calcul mensuel automatique basé sur les pointages validés, cotisations CNAS (9% / 26%) et barème IRG"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'payroll' && selectedPeriod && (
              <button
                type="button"
                onClick={() =>
                  downloadWithAuth(
                    `/payroll/periods/${selectedPeriod.id}/export/xlsx`,
                    `paie_${selectedPeriod.month}_${selectedPeriod.year}.xlsx`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" /> Export CNAS / IRG Excel
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={openNewWorker}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Nouvel ouvrier
              </button>
            )}
          </div>
        }
      />

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => setTab('payroll')}
          className={`px-4 py-2 font-medium border-b-2 ${
            tab === 'payroll' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'
          }`}
        >
          Traitement de la paie mensuelle
        </button>
        <button
          type="button"
          onClick={() => setTab('workers')}
          className={`px-4 py-2 font-medium border-b-2 ${
            tab === 'workers' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'
          }`}
        >
          Effectif &amp; salaires ({workers.length})
        </button>
      </div>

      {tab === 'payroll' && (
        <div className="space-y-4">
          {canWrite && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Calculer / Recalculer un mois :</span>
                <select
                  value={calcMonth}
                  onChange={(e) => setCalcMonth(Number(e.target.value))}
                  className="px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-950"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>Mois {String(m).padStart(2, '0')}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={calcYear}
                  onChange={(e) => setCalcYear(Number(e.target.value))}
                  className="w-24 px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-950 font-mono"
                />
                <button
                  type="button"
                  onClick={calculatePayroll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg font-medium"
                >
                  <Calculator className="w-3.5 h-3.5" /> Calculer depuis pointages validés
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {periods.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openPeriod(p.id)}
                    className={`px-3 py-1.5 rounded-lg border font-mono ${
                      selectedPeriod?.id === p.id
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-blue-700'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {String(p.month).padStart(2, '0')}/{p.year}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPeriod && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold">
                    État de paie — {String(selectedPeriod.month).padStart(2, '0')}/{selectedPeriod.year}
                  </h2>
                  <StatusText status={selectedPeriod.status} />
                </div>
                {selectedPeriod.status === 'draft' && canApprove ? (
                  <button
                    type="button"
                    onClick={() => approvePayroll(selectedPeriod.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Valider &amp; Verrouiller la paie
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Lock className="w-3.5 h-3.5" /> Période verrouillée
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60">
                    <tr>
                      <th className="p-3 text-left">Salarié</th>
                      <th className="p-3 text-right">Jours</th>
                      <th className="p-3 text-right">Brut</th>
                      <th className="p-3 text-right">CNAS Sal. (9%)</th>
                      <th className="p-3 text-right">IRG</th>
                      <th className="p-3 text-right">Avances</th>
                      <th className="p-3 text-right">Net à payer</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {slips.map((s) => (
                      <tr key={s.id}>
                        <td className="p-3">
                          <div className="font-semibold">{s.full_name}</div>
                          <div className="text-[11px] text-slate-500">{s.job_title}</div>
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums">{s.worked_days} j</td>
                        <td className="p-3 text-right font-mono tabular-nums">{formatDA(s.gross_salary)}</td>
                        <td className="p-3 text-right font-mono tabular-nums text-slate-600">{formatDA(s.cnas_employee)}</td>
                        <td className="p-3 text-right font-mono tabular-nums text-slate-600">{formatDA(s.irg_amount)}</td>
                        <td className="p-3 text-right font-mono tabular-nums text-amber-700">{formatDA(s.advances_deducted)}</td>
                        <td className="p-3 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                          {formatDA(s.net_pay)}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => setPrintSlip(s)}
                            className="inline-flex items-center gap-1 px-2 py-1 border rounded hover:bg-slate-50"
                          >
                            <Printer className="w-3 h-3" /> Bulletin
                          </button>
                          {!s.locked && canWrite && (
                            <button
                              type="button"
                              onClick={() => setEditSlip({ ...s })}
                              className="text-blue-700 hover:underline"
                            >
                              Primes / Retenues
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'workers' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input value={workerQuery} onChange={(e) => setWorkerQuery(e.target.value)} placeholder="Rechercher nom, métier, téléphone, CNAS..." className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-900" />
            </div>
            <select value={workerStatusFilter} onChange={(e) => setWorkerStatusFilter(e.target.value)} className="px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-900">
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="suspended">Suspendus</option>
              <option value="on_leave">En congé</option>
              <option value="terminated">Sortis</option>
            </select>
            {canWrite && <button type="button" onClick={openNewWorker} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-blue-700 rounded-lg"><Plus className="w-3.5 h-3.5" /> Ajouter un salarié</button>}
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="p-3 text-left">Salarié / métier</th>
                    <th className="p-3 text-left">Contact / CNAS</th>
                    <th className="p-3 text-left">Embauche</th>
                    <th className="p-3 text-right">Rémunération</th>
                    <th className="p-3 text-left">Statut</th>
                    {canWrite && <th className="p-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleWorkers.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="p-3">
                        <div className="font-semibold">{w.full_name}</div>
                        <div className="text-[11px] text-slate-500">{w.job_title}</div>
                      </td>
                      <td className="p-3">
                        <div>{w.phone || '—'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">CNAS: {w.cnas_number || '—'}</div>
                      </td>
                      <td className="p-3 font-mono">{w.hire_date || '—'}</td>
                      <td className="p-3 text-right font-mono tabular-nums">
                        {w.wage_type === 'monthly' ? `${formatDA(w.monthly_salary)} / mois` : w.wage_type === 'hourly' ? `${formatDA(w.hourly_rate)} / heure` : `${formatDA(w.daily_wage)} / jour`}
                      </td>
                      <td className="p-3"><StatusText status={w.status} /></td>
                      {canWrite && <td className="p-3 text-right"><button type="button" onClick={() => openEditWorker(w)} className="inline-flex items-center gap-1 px-2 py-1.5 text-blue-700 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5" /> Modifier</button></td>}
                    </tr>
                  ))}
                  {visibleWorkers.length === 0 && <tr><td colSpan={canWrite ? 6 : 5} className="p-8 text-center text-slate-500">Aucun salarié correspondant.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Les salariés sortis ou suspendus sont conservés pour préserver les pointages et bulletins historiques. Utilisez le statut au lieu de supprimer un dossier.</p>
        </div>
      )}

      <Modal open={!!editSlip} onClose={() => setEditSlip(null)} title={editSlip ? `Ajuster bulletin — ${editSlip.full_name}` : ''} maxWidth="max-w-md">
        {editSlip && (
          <form onSubmit={saveSlipEdit} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium mb-1">Primes &amp; indemnités (DA)</label>
              <input
                type="number"
                value={editSlip.bonus_amount}
                onChange={(e) => setEditSlip({ ...editSlip, bonus_amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Pénalités / retards (DA)</label>
              <input
                type="number"
                value={editSlip.penalties_deducted}
                onChange={(e) => setEditSlip({ ...editSlip, penalties_deducted: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditSlip(null)} className="px-3 py-2 border rounded-lg">Annuler</button>
              <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Recalculer</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={workerModal} onClose={() => setWorkerModal(false)} title={editingWorker ? `Modifier le dossier — ${editingWorker.full_name}` : "Ajouter un ouvrier / salarié"} maxWidth="max-w-2xl">
        <form onSubmit={saveWorker} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-medium mb-1">Nom complet *
              <input required maxLength={120} value={wForm.full_name} onChange={(e) => setWForm({ ...wForm, full_name: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </label>
            <label className="block font-medium mb-1">Poste / Métier *
              <input required maxLength={100} value={wForm.job_title} onChange={(e) => setWForm({ ...wForm, job_title: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </label>
            <label className="block font-medium mb-1">Type de rémunération
              <select value={wForm.wage_type} onChange={(e) => setWForm({ ...wForm, wage_type: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="daily">Journalier</option><option value="monthly">Mensuel</option><option value="hourly">Horaire</option><option value="piecework">À la tâche</option>
              </select>
            </label>
            <label className="block font-medium mb-1">Date d'embauche
              <input type="date" value={wForm.hire_date || ''} onChange={(e) => setWForm({ ...wForm, hire_date: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </label>
            <label className="block font-medium mb-1">Salaire journalier (DA)
              <input type="number" min="0" step="0.01" value={wForm.daily_wage} onChange={(e) => setWForm({ ...wForm, daily_wage: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono" />
            </label>
            <label className="block font-medium mb-1">Salaire horaire (DA)
              <input type="number" min="0" step="0.01" value={wForm.hourly_rate} onChange={(e) => setWForm({ ...wForm, hourly_rate: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono" />
            </label>
            <label className="block font-medium mb-1">Salaire mensuel (DA)
              <input type="number" min="0" step="0.01" value={wForm.monthly_salary} onChange={(e) => setWForm({ ...wForm, monthly_salary: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono" />
            </label>
            <label className="block font-medium mb-1">N° Sécurité Sociale CNAS
              <input value={wForm.cnas_number} onChange={(e) => setWForm({ ...wForm, cnas_number: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono" />
            </label>
            <label className="block font-medium mb-1">Téléphone
              <input type="tel" value={wForm.phone} onChange={(e) => setWForm({ ...wForm, phone: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </label>
            <label className="block font-medium mb-1">Horaires habituels
              <input value={wForm.work_schedule || ''} onChange={(e) => setWForm({ ...wForm, work_schedule: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </label>
            <label className="block font-medium mb-1">Statut
              <select value={wForm.status} onChange={(e) => setWForm({ ...wForm, status: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="active">Actif</option><option value="suspended">Suspendu</option><option value="on_leave">En congé</option><option value="terminated">Sorti de l'entreprise</option>
              </select>
            </label>
            <label className="block font-medium mb-1 sm:col-span-2">Adresse
              <input value={wForm.address} onChange={(e) => setWForm({ ...wForm, address: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </label>
            <label className="block font-medium mb-1 sm:col-span-2">Notes du dossier
              <textarea rows={3} value={wForm.notes} onChange={(e) => setWForm({ ...wForm, notes: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setWorkerModal(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" disabled={savingWorker} className="px-4 py-2 text-white bg-blue-700 rounded-lg disabled:opacity-50">{savingWorker ? "Enregistrement..." : "Enregistrer le dossier"}</button>
          </div>
        </form>
      </Modal>

      <PayslipPrintModal slip={printSlip} period={selectedPeriod} company={company} onClose={() => setPrintSlip(null)} />
    </div>
  );
}
