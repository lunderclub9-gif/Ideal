import React, { useEffect, useState } from 'react';
import { apiFetch, formatDateFr } from '../lib/api';
import { EmptyState, KpiCard, PageHeader } from '../components/ui';

type Row = {
  id: number; table: string; type: string; label: string;
  lifecycle_status: string; created_at: string | null; updated_at: string | null;
  archived_at: string | null; deletion_eligible_until: string | null;
  retention_review_due_at: string | null; retention_status: string;
};

export default function LifecyclePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const actions = new Set(['clients','projects','vehicles','workers','suppliers','materials','commercial_documents']);

  const load = async () => {
    try {
      const [r, n] = await Promise.all([
        apiFetch('/lifecycle/overview'),
        apiFetch('/notifications'),
      ]);
      setRows(r || []);
      setNotifs(n || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (table: string, id: number, action: 'archive' | 'restore') => {
    setBusy(`${table}-${id}`);
    try {
      await apiFetch(`/${table}/${id}/${action}`, { method: 'POST', body: JSON.stringify({ reason: 'Action depuis le cycle de vie' }) });
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  const markReview = async (table: string, id: number) => {
    setBusy(`review-${table}-${id}`);
    try {
      await apiFetch('/lifecycle/review', { method: 'POST', body: JSON.stringify({ table, id }) });
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  const markNotifRead = async (id: number) => {
    try { await apiFetch(`/notifications/${id}/read`, { method: 'POST' }); await load(); } catch {}
  };

  const now = new Date();
  const isRecent = (r: Row) => !!r.deletion_eligible_until && new Date(r.deletion_eligible_until.replace(' ', 'T') + 'Z').getTime() >= now.getTime();
  const isArchived = (r: Row) => r.lifecycle_status === 'archived';
  const isReviewDue = (r: Row) => isArchived(r) && !!r.retention_review_due_at && new Date(r.retention_review_due_at.replace(' ', 'T') + 'Z').getTime() <= now.getTime() && r.retention_status !== 'reviewed';

  const types = Array.from(new Set(rows.map((r) => r.type))).sort();
  const filtered = rows.filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (statusFilter && r.lifecycle_status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!r.label.toLowerCase().includes(q) && !r.type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const recent = filtered.filter(isRecent);
  const archived = filtered.filter(isArchived);
  const reviewDue = filtered.filter(isReviewDue);

  const dueNotifs = notifs.filter((n) => !n.is_read);

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion du cycle de vie" subtitle="Suivi des enregistrements, archives et revues annuelles" />

      {dueNotifs.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Notifications ({dueNotifs.length})</h2>
          {dueNotifs.map((n: any) => (
            <div key={n.id} className="flex items-center justify-between text-xs">
              <span>{n.title} — {n.body}</span>
              <button onClick={() => markNotifRead(n.id)} className="text-amber-700 underline">Marquer lu</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Enregistrements" value={rows.length} />
        <KpiCard label="Période 7 jours" value={rows.filter(isRecent).length} tone="amber" />
        <KpiCard label="Archivés" value={rows.filter(isArchived).length} tone="blue" />
        <KpiCard label="Revue due" value={rows.filter(isReviewDue).length} tone="red" />
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
          <option value="">Tous les modules</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="archived">Archivé</option>
        </select>
      </div>

      {error && <div className="p-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>}

      <Section title="Revue annuelle due (1 an)" empty="Aucune revue annuelle due.">
        {reviewDue.map((r) => (
          <RowItem key={`${r.type}-${r.id}`} r={r} busy={busy} onReview={() => markReview(r.table, r.id)} reviewLabel="Marquer revu" />
        ))}
      </Section>

      <Section title="Enregistrements dans la période de 7 jours" empty="Aucun enregistrement récent.">
        {recent.map((r) => (
          <RowItem key={`${r.type}-${r.id}`} r={r} busy={busy} onArchive={actions.has(r.table) ? () => act(r.table, r.id, 'archive') : undefined} archiveLabel="Archiver" />
        ))}
      </Section>

      <Section title="Enregistrements archivés" empty="Aucun enregistrement archivé.">
        {archived.map((r) => (
          <RowItem key={`${r.type}-${r.id}`} r={r} busy={busy} onRestore={actions.has(r.table) ? () => act(r.table, r.id, 'restore') : undefined} restoreLabel="Restaurer" onReview={isReviewDue(r) ? () => markReview(r.table, r.id) : undefined} reviewLabel="Marquer revu" />
        ))}
      </Section>

      <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        Les données protégées ou réglementées ne sont jamais supprimées automatiquement. Les suppressions bloquées sont expliquées par leurs dépendances ou leur statut.
      </div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  const has = arr.some(Boolean);
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {has ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div> : <EmptyState message={empty} />}
    </div>
  );
}

function RowItem({ r, busy, onArchive, onRestore, onReview, archiveLabel, restoreLabel, reviewLabel }: any) {
  return (
    <div className="px-5 py-3 flex items-center justify-between text-xs gap-3">
      <div className="min-w-0">
        <span className="font-semibold">{r.type}</span> — {r.label}
        {r.deletion_eligible_until && <span className="ml-2 text-amber-700 font-mono">suppr. jusqu’au {formatDateFr(r.deletion_eligible_until)}</span>}
        {r.retention_review_due_at && <span className="ml-2 text-slate-500 font-mono">revue {formatDateFr(r.retention_review_due_at)}</span>}
      </div>
      <div className="flex gap-2 shrink-0">
        {onArchive && <button disabled={busy === `${r.table}-${r.id}`} onClick={onArchive} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs disabled:opacity-50">{archiveLabel}</button>}
        {onRestore && <button disabled={busy === `${r.table}-${r.id}`} onClick={onRestore} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs disabled:opacity-50">{restoreLabel}</button>}
        {onReview && <button disabled={busy === `review-${r.table}-${r.id}`} onClick={onReview} className="px-2 py-1 rounded-lg bg-blue-600 text-white text-xs disabled:opacity-50">{reviewLabel}</button>}
      </div>
    </div>
  );
}