import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, HardDrive } from 'lucide-react';
import { apiFetch, formatDA, formatDateFr } from '../lib/api';
import { PageHeader, StatusText } from '../components/ui';

function KpiCard({
  label,
  value,
  subtext,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  tone?: 'default' | 'green' | 'amber' | 'red' | 'blue';
  onClick?: () => void;
}) {
  const cls = {
    default: 'text-slate-900 dark:text-white',
    green: 'text-emerald-700 dark:text-emerald-400',
    amber: 'text-amber-700 dark:text-amber-400',
    red: 'text-red-700 dark:text-red-400',
    blue: 'text-blue-700 dark:text-blue-400',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
    >
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{label}</div>
      <div className={`mt-1.5 text-lg font-bold font-mono tabular-nums tracking-tight ${cls}`}>{value}</div>
      {subtext && <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtext}</div>}
    </button>
  );
}

export default function DashboardPage({ onNavigate }: { onNavigate: (route: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="p-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>;
  }
  if (!data) {
    return <div className="p-8 text-xs text-slate-500">Chargement du tableau de bord...</div>;
  }

  const k = data.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord de pilotage"
        subtitle={`Situation consolidée au ${formatDateFr(data.refDate)} · Calculs déterministes en Dinar Algérien (DA)`}
      />

      {/* Row 1: Operational KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Chantiers actifs"
          value={k.activeProjects}
          subtext={`${k.lateProjects} en retard`}
          tone={k.lateProjects > 0 ? 'amber' : 'blue'}
          onClick={() => onNavigate('projects')}
        />
        <KpiCard
          label="Présents aujourd’hui"
          value={k.workersPresentToday}
          subtext={`${k.workersOnLeave} en congé`}
          tone="green"
          onClick={() => onNavigate('attendance')}
        />
        <KpiCard
          label="Alertes stock bas"
          value={k.lowStockCount}
          subtext="Matériaux sous seuil min."
          tone={k.lowStockCount > 0 ? 'amber' : 'default'}
          onClick={() => onNavigate('materials')}
        />
        <KpiCard
          label="Parc en maintenance"
          value={k.vehiclesMaintenance}
          subtext="Véhicules / engins immobilisés"
          tone={k.vehiclesMaintenance > 0 ? 'amber' : 'default'}
          onClick={() => onNavigate('maintenance')}
        />
        <KpiCard
          label="Factures impayées"
          value={k.unpaidInvoicesCount}
          subtext={`${k.pendingAttendance} pointages à valider`}
          tone={k.unpaidInvoicesCount > 0 ? 'red' : 'green'}
          onClick={() => onNavigate('invoices')}
        />
      </div>

      {/* Row 2: Financial KPIs (Admin / Comptable) */}
      {data.canSeeFinance && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Chiffre d’affaires facturé HT"
            value={formatDA(k.totalRevenueHt)}
            tone="blue"
            onClick={() => onNavigate('invoices')}
          />
          <KpiCard
            label="Coûts & achats enregistrés"
            value={formatDA(k.totalCosts)}
            onClick={() => onNavigate('expenses')}
          />
          <KpiCard
            label="Résultat net estimé"
            value={formatDA(k.netResult)}
            tone={k.netResult >= 0 ? 'green' : 'red'}
            onClick={() => onNavigate('reports')}
          />
          <KpiCard
            label="Trésorerie Caisse + Banque"
            value={formatDA((k.cashBalance || 0) + (k.bankBalance || 0))}
            subtext={`Caisse ${formatDA(k.cashBalance)} · Banque ${formatDA(k.bankBalance)}`}
            tone="green"
            onClick={() => onNavigate('treasury')}
          />
          <KpiCard
            label="Créances clients / Dettes frn."
            value={formatDA(k.receivables)}
            subtext={`Dettes fournisseurs : ${formatDA(k.payables)}`}
            tone={k.receivables > 0 ? 'amber' : 'default'}
            onClick={() => onNavigate('invoices')}
          />
        </div>
      )}

      {/* Alerts + Backup Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Alertes &amp; actions prioritaires</h2>
            <span className="text-[11px] font-mono text-slate-500">{data.alerts.length} alerte(s)</span>
          </div>
          {data.alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-700 py-4">
              <CheckCircle2 className="w-4 h-4" /> Aucune anomalie critique détectée aujourd’hui.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.alerts.map((a: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onNavigate(a.target)}
                  className="w-full py-2.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2.5 text-xs">
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        a.level === 'danger'
                          ? 'text-red-600'
                          : a.level === 'warning'
                          ? 'text-amber-600'
                          : 'text-blue-600'
                      }`}
                    />
                    <span className="text-slate-800 dark:text-slate-200 font-medium">{a.title}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
              <HardDrive className="w-4 h-4 text-blue-600" /> Sauvegarde locale sécurisée
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Dernière archive vérifiée :{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {k.lastBackupAt ? k.lastBackupAt.replace('T', ' ').slice(0, 16) : 'Aucune'}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('backup')}
            className="mt-4 w-full py-2 px-3 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left flex items-center justify-between"
          >
            <span>Exporter une copie sur clé USB (.zip)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Projects Real Cost vs Budget Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Chantiers actifs : Coût réel vs Budget révisé
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('projects')}
            className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
          >
            Voir tous les chantiers
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3 text-left font-medium">Chantier</th>
                <th className="p-3 text-left font-medium">Client</th>
                <th className="p-3 text-left font-medium">Statut</th>
                <th className="p-3 text-right font-medium">Avancement</th>
                <th className="p-3 text-right font-medium">Budget coût révisé</th>
                <th className="p-3 text-right font-medium">Coût réel cumulé</th>
                <th className="p-3 text-right font-medium">Écart budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.activeProjects.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="p-3">
                    <div className="font-semibold text-slate-900 dark:text-white">{p.title}</div>
                    <div className="font-mono text-[11px] text-slate-500">{p.project_number}</div>
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{p.client_name}</td>
                  <td className="p-3">
                    <StatusText status={p.status} />
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">{p.progress_percent}%</td>
                  <td className="p-3 text-right font-mono tabular-nums">{formatDA(p.revised_budget)}</td>
                  <td className="p-3 text-right font-mono tabular-nums font-semibold">{formatDA(p.real_cost)}</td>
                  <td
                    className={`p-3 text-right font-mono tabular-nums font-semibold ${
                      p.budget_variance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {p.budget_variance >= 0 ? '+' : ''}
                    {formatDA(p.budget_variance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom 2-column: Unpaid invoices + Low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {data.canSeeFinance && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Factures en attente de règlement</h2>
              <button type="button" onClick={() => onNavigate('invoices')} className="text-xs text-blue-700 hover:underline">
                Gérer
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.unpaidInvoices.map((inv: any) => (
                <div key={inv.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-slate-900 dark:text-white">{inv.doc_number}</div>
                    <div className="text-slate-500 truncate">{inv.client_name} · Échéance {formatDateFr(inv.due_date)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums font-bold text-red-700 dark:text-red-400">
                      {formatDA(inv.total_ttc - inv.amount_paid)}
                    </div>
                    <StatusText status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Matériaux en stock bas</h2>
            <button type="button" onClick={() => onNavigate('materials')} className="text-xs text-blue-700 hover:underline">
              Ouvrir le stock
            </button>
          </div>
          {data.lowStock.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">Tous les niveaux de stock sont conformes aux seuils minimum.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.lowStock.map((m: any) => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{m.name}</div>
                    <div className="text-slate-500 font-mono">{m.code} · {m.storage_location}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="font-bold text-amber-700 dark:text-amber-400">
                      {m.current_quantity} / {m.min_stock_level} {m.unit}
                    </div>
                    <div className="text-[11px] text-slate-500">{m.supplier_name || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
