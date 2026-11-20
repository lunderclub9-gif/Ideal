import React, { useEffect, useState } from 'react';
import { apiFetch, formatDateFr } from '../lib/api';
import { EmptyState, KpiCard, PageHeader } from '../components/ui';

export default function LifecyclePage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/clients').catch(() => []),
      apiFetch('/projects').catch(() => []),
      apiFetch('/vehicles').catch(() => []),
      apiFetch('/workers').catch(() => []),
      apiFetch('/materials').catch(() => []),
    ]).then(([clients, projects, vehicles, workers, materials]) => {
      setData({ clients, projects, vehicles, workers, materials });
    }).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>;
  if (!data) return <div className="p-8 text-xs text-slate-500">Chargement du cycle de vie…</div>;

  const now = new Date();
  const isRecent = (r: any) => {
    if (!r.deletion_eligible_until) return false;
    const d = new Date(r.deletion_eligible_until.replace(' ', 'T') + 'Z');
    return d.getTime() >= now.getTime();
  };
  const isArchived = (r: any) => r.lifecycle_status === 'archived';

  const all = [
    ...data.clients.map((x: any) => ({ ...x, _type: 'Client', _label: x.name })),
    ...data.projects.map((x: any) => ({ ...x, _type: 'Chantier', _label: `${x.project_number} — ${x.title}` })),
    ...data.vehicles.map((x: any) => ({ ...x, _type: 'Véhicule', _label: x.name || x.plate_number })),
    ...data.workers.map((x: any) => ({ ...x, _type: 'Employé', _label: x.full_name })),
    ...data.materials.map((x: any) => ({ ...x, _type: 'Matériau', _label: x.name })),
  ];

  const recent = all.filter(isRecent);
  const archived = all.filter(isArchived);

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion du cycle de vie" subtitle="Suivi des enregistrements nouveaux, protégés et archivés" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Enregistrements" value={all.length} />
        <KpiCard label="Période 7 jours" value={recent.length} tone="amber" />
        <KpiCard label="Archivés" value={archived.length} tone="blue" />
        <KpiCard label="Protégés" value={all.length - recent.length - archived.length} tone="green" />
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
    </div>
  );
}