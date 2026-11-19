import React, { useEffect, useState } from 'react';
import { Calculator, CheckCircle2, Download, Lock, Plus, Printer } from 'lucide-react';
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
  const [editSlip, setEditSlip] = useState<any | null>(null);
  const [error, setError] = useState('');

  const [wForm, setWForm] = useState({
    full_name: '',
    job_title: 'Maçon',
    wage_type: 'daily',
    daily_wage: 3500,
    monthly_salary: 0,
    cnas_number: '',
    phone: '',
    hire_date: new Date().toISOString().slice(0, 10),
  });

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

  async function saveWorker(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/workers', { method: 'POST', body: JSON.stringify(wForm) });
      setWorkerModal(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

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
                onClick={() => setWorkerModal(true)}
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="p-3 text-left">Nom complet</th>
                <th className="p-3 text-left">Poste</th>
                <th className="p-3 text-left">N° CNAS</th>
                <th className="p-3 text-right">Taux journalier / mensuel</th>
                <th className="p-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {workers.map((w) => (
                <tr key={w.id}>
                  <td className="p-3 font-semibold">{w.full_name}</td>
                  <td className="p-3">{w.job_title}</td>
                  <td className="p-3 font-mono">{w.cnas_number || '—'}</td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {w.wage_type === 'monthly' ? `${formatDA(w.monthly_salary)} / mois` : `${formatDA(w.daily_wage)} / jour`}
                  </td>
                  <td className="p-3"><StatusText status={w.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
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

      <Modal open={workerModal} onClose={() => setWorkerModal(false)} title="Ajouter un ouvrier / salarié">
        <form onSubmit={saveWorker} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Nom complet *</label>
              <input
                type="text"
                required
                value={wForm.full_name}
                onChange={(e) => setWForm({ ...wForm, full_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Poste / Métier *</label>
              <input
                type="text"
                required
                value={wForm.job_title}
                onChange={(e) => setWForm({ ...wForm, job_title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Salaire journalier (DA)</label>
              <input
                type="number"
                value={wForm.daily_wage}
                onChange={(e) => setWForm({ ...wForm, daily_wage: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">N° Sécurité Sociale CNAS</label>
              <input
                type="text"
                value={wForm.cnas_number}
                onChange={(e) => setWForm({ ...wForm, cnas_number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setWorkerModal(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Enregistrer</button>
          </div>
        </form>
      </Modal>

      <PayslipPrintModal slip={printSlip} period={selectedPeriod} company={company} onClose={() => setPrintSlip(null)} />
    </div>
  );
}
