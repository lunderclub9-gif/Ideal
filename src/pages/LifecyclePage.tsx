import React, { useEffect, useState } from 'react';
import { apiFetch, formatDateFr } from '../lib/api';
import { EmptyState, KpiCard, PageHeader } from '../components/ui';

export default function LifecyclePage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    Promise.all([
      apiFetch('/clients').catch(() => []),
      apiFetch('/projects').catch(() => []),
      apiFetch('/vehicles').catch(() => []),
      apiFetch('/workers').catch(() => []),
      apiFetch('/materials').catch(() => []),
      apiFetch('/suppliers').catch(() => []),
      apiFetch('/commercial-documents').catch(() => []),
    ]).then(([clients, projects, vehicles, workers, materials, suppliers, docs]) => {
      setData({ clients, projects, vehicles, workers, materials, suppliers, docs });
    }).catch((e) => setError(e.message));
  };

  useEffect(load, []);

  if (error) return <div className="p-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>;
  if (!data) return <div className="p-8 text-xs text-slate-500">Chargement du cycle de vie…</div>;

  const now = new Date();
  const isRecent = (r: any) => {
    if (!r.deletion_eligible_until) return false;
    const d = new Date(r.deletion_eligible_until.replace(' ', 'T') + 'Z');
    return d.getTime() >= now.getTime();
  };
  const isArchived = (r: any) => r.lifecycle_status === 'archived';
  const isReviewDue = (r: any) => isArchived(r) && r.retention_review_due_at && new Date(r.retention_review_due_at.replace(' ', 'T') + 'Z').getTime() <= now.getTime() && r.retention_status !== 'reviewed';

  const labelOf = (type: string, r: any) => {
    if (type === 'Client') return r.name;
    if (type === 'Chantier') return `${r.project_number} — ${r.title}`;
    if (type === 'Véhicule') return r.name || r.plate_number;
    if (type === 'Employé') return r.full_name;
    if (type === 'Matériau') return r.name;
    if (type === 'Fournisseur') return r.name;
    if (type === 'Pièce') return `${r.doc_type} ${r.doc_number}`;
    return r.id;
  };

  const all = [
    ...data.clients.map((x: any) => ({ ...x, _type: 'Client', _table: 'clients', _label: labelOf('Client', x) })),
    ...data.projects.map((x: any) => ({ ...x, _type: 'Chantier', _table: 'projects', _label: labelOf('Chantier', x) })),
    ...data.vehicles.map((x: any) => ({ ...x, _type: 'Véhicule', _table: 'vehicles', _label: labelOf('Véhicule', x) })),
    ...data.workers.map((x: any) => ({ ...x, _type: 'Employé', _table: 'workers', _label: labelOf('Employé', x) })),
    ...data.materials.map((x: any) => ({ ...x, _type: 'Matériau', _table: 'materials', _label: labelOf('Matériau', x) })),
    ...data.suppliers.map((x: any) => ({ ...x, _type: 'Fournisseur', _table: 'suppliers', _label: labelOf('Fournisseur', x) })),
    ...data.docs.map((x: any) => ({ ...x, _type: 'Pièce', _table: 'commercial_documents', _label: labelOf('Pièce', x) })),
  ];

  const recent = all.filter(isRecent);
  const archived = all.filter(isArchived);
  const reviewDue = all.filter(isReviewDue);

  const markReview = async (r: any) => {
    setBusy(r.id);
    try {
      await apiFetch('/lifecycle/review', { method: 'POST', body: JSON.stringify({ table: r._table, id: r.id }) });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion du cycle de vie" subtitle="Suivi des enregistrements nouveaux, protégés, archivés et revue annuelle" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Enregistrements" value={all.length} />
        <KpiCard label="Période 7 jours" value={recent.length} tone="amber" />
        <KpiCard label="Archivés" value={archived.length} tone="blue" />
        <KpiCard label="Revue due" value={reviewDue.length} tone="red" />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Revue annuelle due (1 an)</h2>
        </div>
        {reviewDue.length === 0 ? <EmptyState message="Aucune revue annuelle due." /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reviewDue.map((r: any) => (
              <div key={`${r._type}-${r.id}`} className="px-5 py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold">{r._type}</span> — {r._label}
                  <span className="ml-2 text-slate-500 font-mono">due le {formatDateFr(r.retention_review_due_at)}</span>
                </div>
                <button disabled={busy === r.id} onClick={() => markReview(r)} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs disabled:opacity-50">
                  Marquer revu
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Enregistrements dans la période de 7 jours</h2>
        </div>
        {recent.length === 0 ? <EmptyState message="Aucun enregistrement récent." /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((r: any) => (
              <div key={`${r._type}-${r.id}`} className="px-5 py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold">{r._type}</span> — {r._label}
                </div>
                <div className="text-amber-700 font-mono">Supprimable jusqu’au {formatDateFr(r.deletion_eligible_until)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Enregistrements archivés</h2>
        </div>
        {archived.length === 0 ? <EmptyState message="Aucun enregistrement archivé." /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {archived.map((r: any) => (
              <div key={`${r._type}-${r.id}`} className="px-5 py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold">{r._type}</span> — {r._label}
                </div>
                <div className="text-slate-500 font-mono">Archivé le {formatDateFr(r.archived_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        Les données protégées ou réglementées (pièces émises, données comptables) ne sont jamais supprimées automatiquement.
        Les suppressions bloquées sont expliquées par leurs dépendances ou leur statut protégé.
      </div>
    </div>
  );
}