import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search, RefreshCw, Wallet, TrendingDown, TrendingUp, Users, Truck } from 'lucide-react';
import { apiFetch, formatDA, formatDateFr } from '../lib/api';
import { PageHeader } from '../components/ui';

type DebtRow = Record<string, any>;
type DebtData = {
  as_of: string;
  summary: { receivables: number; supplier_payables: number; worker_advances: number; net_position: number };
  receivables: DebtRow[];
  payables: DebtRow[];
  worker_advances: DebtRow[];
};

export default function DebtsPage() {
  const [data, setData] = useState<DebtData | null>(null);
  const [tab, setTab] = useState<'receivables' | 'payables' | 'workers'>('receivables');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await apiFetch<DebtData>('/finance/debts'));
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les soldes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const source = tab === 'receivables' ? data.receivables : tab === 'payables' ? data.payables : data.worker_advances;
    const q = query.trim().toLocaleLowerCase();
    if (!q) return source;
    return source.filter((row) => [
      row.party_name, row.doc_number, row.reference, row.supplier_invoice_no,
      row.project_number, row.project_title, row.job_title,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(q)));
  }, [data, tab, query]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dettes & Créances"
        subtitle={data ? `Situation calculée au ${formatDateFr(data.as_of)} à partir des factures, achats, règlements et avances enregistrés.` : 'Contrôle des soldes clients, fournisseurs et avances salariés.'}
        actions={<button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser</button>}
      />

      {error && <div role="alert" className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500"><TrendingUp className="w-4 h-4 text-emerald-600" /> Créances clients</div>
              <div className="mt-2 text-xl font-bold font-mono tabular-nums">{formatDA(data.summary.receivables)}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500"><TrendingDown className="w-4 h-4 text-rose-600" /> Dettes fournisseurs</div>
              <div className="mt-2 text-xl font-bold font-mono tabular-nums">{formatDA(data.summary.supplier_payables)}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500"><Users className="w-4 h-4 text-amber-600" /> Avances salariés à récupérer</div>
              <div className="mt-2 text-xl font-bold font-mono tabular-nums">{formatDA(data.summary.worker_advances)}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500"><Wallet className="w-4 h-4" /> Position nette indicative</div>
              <div className={`mt-2 text-xl font-bold font-mono tabular-nums ${data.summary.net_position >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatDA(data.summary.net_position)}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 text-xs">
              <button type="button" onClick={() => setTab('receivables')} className={`px-3 py-2 border-b-2 ${tab === 'receivables' ? 'border-blue-700 text-blue-700 font-semibold' : 'border-transparent text-slate-500'}`}>Clients ({data.receivables.length})</button>
              <button type="button" onClick={() => setTab('payables')} className={`px-3 py-2 border-b-2 ${tab === 'payables' ? 'border-blue-700 text-blue-700 font-semibold' : 'border-transparent text-slate-500'}`}>Fournisseurs ({data.payables.length})</button>
              <button type="button" onClick={() => setTab('workers')} className={`px-3 py-2 border-b-2 ${tab === 'workers' ? 'border-blue-700 text-blue-700 font-semibold' : 'border-transparent text-slate-500'}`}>Avances salariés ({data.worker_advances.length})</button>
            </div>
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une personne ou référence..." className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[760px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  {tab === 'receivables' && <tr><th className="p-3 text-left">Facture</th><th className="p-3 text-left">Client</th><th className="p-3 text-left">Émise / Échéance</th><th className="p-3 text-right">TTC</th><th className="p-3 text-right">Réglé</th><th className="p-3 text-right">Avoirs</th><th className="p-3 text-right">Reste dû</th><th className="p-3 text-right">Retard</th></tr>}
                  {tab === 'payables' && <tr><th className="p-3 text-left">Commande</th><th className="p-3 text-left">Fournisseur</th><th className="p-3 text-left">Date</th><th className="p-3 text-right">TTC</th><th className="p-3 text-right">Réglé</th><th className="p-3 text-right">Reste dû</th><th className="p-3 text-left">Chantier</th></tr>}
                  {tab === 'workers' && <tr><th className="p-3 text-left">Salarié</th><th className="p-3 text-left">Métier</th><th className="p-3 text-right">Avances versées</th><th className="p-3 text-right">Récupérées par paie validée</th><th className="p-3 text-right">Solde à récupérer</th></tr>}
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <tr key={row.id || row.worker_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      {tab === 'receivables' && <>
                        <td className="p-3 font-mono font-semibold">{row.doc_number}</td><td className="p-3">{row.party_name}</td>
                        <td className="p-3 font-mono">{formatDateFr(row.issue_date)}<div className="text-[10px] text-slate-500">Échéance : {formatDateFr(row.due_date)}</div></td>
                        <td className="p-3 text-right font-mono">{formatDA(row.total_ttc)}</td><td className="p-3 text-right font-mono">{formatDA(row.amount_paid)}</td>
                        <td className="p-3 text-right font-mono">{formatDA(row.credits_applied)}</td><td className="p-3 text-right font-mono font-bold text-amber-700">{formatDA(row.balance_due)}</td>
                        <td className="p-3 text-right">{row.days_overdue > 0 ? <span className="text-rose-700">{row.days_overdue} j</span> : '—'}</td>
                      </>}
                      {tab === 'payables' && <>
                        <td className="p-3 font-mono font-semibold">{row.reference}<div className="text-[10px] text-slate-500">{row.supplier_invoice_no || ''}</div></td><td className="p-3">{row.party_name}</td>
                        <td className="p-3 font-mono">{formatDateFr(row.issue_date)}</td><td className="p-3 text-right font-mono">{formatDA(row.total_ttc)}</td>
                        <td className="p-3 text-right font-mono">{formatDA(row.amount_paid)}</td><td className="p-3 text-right font-mono font-bold text-rose-700">{formatDA(row.balance_due)}</td>
                        <td className="p-3">{row.project_number ? `${row.project_number} — ${row.project_title}` : '—'}</td>
                      </>}
                      {tab === 'workers' && <>
                        <td className="p-3 font-semibold">{row.party_name}</td><td className="p-3">{row.job_title}</td>
                        <td className="p-3 text-right font-mono">{formatDA(row.advances_issued)}</td><td className="p-3 text-right font-mono">{formatDA(row.advances_recovered)}</td>
                        <td className="p-3 text-right font-mono font-bold text-amber-700">{formatDA(row.balance_due)}</td>
                      </>}
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={tab === 'receivables' ? 8 : tab === 'payables' ? 7 : 5} className="p-10 text-center text-slate-500">{loading ? 'Chargement...' : 'Aucun solde restant pour cette catégorie.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Les créances sont calculées sur les factures non annulées, après règlements et avoirs liés. Les dettes fournisseurs sont calculées sur les achats non annulés. Les avances salariés sont calculées à partir des pointages et récupérations de paie dont la période est validée. Vérifiez les soldes d'ouverture historiques avant toute clôture comptable.</p>
          </div>
        </>
      )}
    </div>
  );
}
