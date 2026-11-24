import React, { useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { apiFetch, formatDA, hasPerm } from '../lib/api';
import { Modal, PageHeader, StatusText } from '../components/ui';

type WorkType = {
  id: number;
  code: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  default_price: number;
  cost_rate: number;
  tva_rate: number;
  active: number;
};

const EMPTY_FORM = {
  code: '',
  name: '',
  category: 'Général',
  description: '',
  unit: 'Forfait',
  default_price: 0,
  cost_rate: 0,
  tva_rate: 0,
  active: true,
};

export default function ServicesPage({ permissions }: { permissions: string[] }) {
  const [items, setItems] = useState<WorkType[]>([]);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editing, setEditing] = useState<WorkType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const canWrite = hasPerm(permissions, 'settings:write');

  async function load() {
    try {
      setItems(await apiFetch<WorkType[]>('/services'));
      setError('');
    } catch (e: any) {
      setError(e.message || 'Impossible de charger le catalogue.');
    }
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => items.filter((item) => {
    const matchesStatus = showArchived || !!item.active;
    const term = query.trim().toLocaleLowerCase();
    const matchesQuery = !term || [item.code, item.name, item.category, item.description]
      .some((value) => String(value || '').toLocaleLowerCase().includes(term));
    return matchesStatus && matchesQuery;
  }), [items, query, showArchived]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setModalOpen(true);
  }

  function openEdit(item: WorkType) {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      category: item.category || 'Général',
      description: item.description || '',
      unit: item.unit,
      default_price: item.default_price,
      cost_rate: item.cost_rate,
      tva_rate: item.tva_rate,
      active: !!item.active,
    });
    setError('');
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ...form,
        code: String(form.code).trim().toUpperCase(),
        name: String(form.name).trim(),
        category: String(form.category || 'Général').trim(),
        description: String(form.description || '').trim(),
        unit: String(form.unit).trim(),
      };
      await apiFetch(editing ? `/services/${editing.id}` : '/services', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      setMessage(editing ? 'Type de travaux mis à jour.' : 'Type de travaux ajouté au catalogue.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Échec de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: WorkType) {
    if (!canWrite) return;
    setError('');
    setMessage('');
    try {
      await apiFetch(`/services/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !item.active }),
      });
      setMessage(item.active ? 'Type archivé. Les anciens projets et documents ne sont pas supprimés.' : 'Type réactivé.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Impossible de modifier le statut.');
    }
  }

  const activeCount = items.filter((item) => item.active).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catalogue des types de travaux"
        subtitle="Configurez vos métiers, unités et tarifs de référence. Les types archivés restent conservés dans l’historique."
        actions={canWrite ? (
          <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg">
            <Plus className="w-3.5 h-3.5" /> Ajouter un type
          </button>
        ) : null}
      />

      {error && <div role="alert" className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}
      {message && <div role="status" className="p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">{message}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-slate-500">Types enregistrés</div>
          <div className="text-xl font-bold font-mono mt-1">{items.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-slate-500">Types actifs</div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">{activeCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 col-span-2 md:col-span-1">
          <div className="text-slate-500">Types archivés</div>
          <div className="text-xl font-bold font-mono mt-1">{items.length - activeCount}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher par code, nom ou catégorie..." className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900" />
        </div>
        <label className="inline-flex items-center gap-2 text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Afficher les types archivés
        </label>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[850px]">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3 text-left">Code / Type de travaux</th>
                <th className="p-3 text-left">Catégorie</th>
                <th className="p-3 text-left">Unité</th>
                <th className="p-3 text-right">Prix de vente indicatif</th>
                <th className="p-3 text-right">Coût indicatif</th>
                <th className="p-3 text-right">TVA</th>
                <th className="p-3 text-left">Statut</th>
                {canWrite && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="p-3">
                    <div className="font-mono text-[10px] text-slate-500">{item.code}</div>
                    <div className="font-semibold">{item.name}</div>
                    {item.description && <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>}
                  </td>
                  <td className="p-3">{item.category}</td>
                  <td className="p-3 font-mono">{item.unit}</td>
                  <td className="p-3 text-right font-mono tabular-nums">{formatDA(item.default_price)}</td>
                  <td className="p-3 text-right font-mono tabular-nums">{formatDA(item.cost_rate)}</td>
                  <td className="p-3 text-right font-mono">{item.tva_rate}%</td>
                  <td className="p-3"><StatusText status={item.active ? 'active' : 'inactive'} /></td>
                  {canWrite && (
                    <td className="p-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => openEdit(item)} title="Modifier" className="p-1.5 text-blue-700 hover:bg-blue-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => toggleActive(item)} title={item.active ? 'Archiver' : 'Réactiver'} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded">
                        {item.active ? <Archive className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={canWrite ? 8 : 7} className="p-8 text-center text-slate-500">Aucun type de travaux trouvé.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[11px] text-slate-500 leading-relaxed">
        Les prix et taux affichés sont des valeurs de référence que vous configurez. Ils ne modifient pas rétroactivement les devis, factures ou projets déjà enregistrés. Aucun type n’est supprimé physiquement : l’archivage préserve l’historique.
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier un type de travaux' : 'Nouveau type de travaux'} maxWidth="max-w-2xl">
        <form onSubmit={save} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">Code unique *
              <input required maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9_\-]{1,29}" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EPOXY" className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono" />
            </label>
            <label className="block">Nom du travail *
              <input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Revêtement époxy" className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </label>
            <label className="block">Catégorie
              <input maxLength={80} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Revêtement / Finition / Réseaux..." className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </label>
            <label className="block">Unité de mesure *
              <input required maxLength={20} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="m², m³, ML, unité, journée, forfait..." className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </label>
            <label className="block">Prix de vente indicatif (DA)
              <input type="number" min="0" step="0.01" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono" />
            </label>
            <label className="block">Coût indicatif (DA)
              <input type="number" min="0" step="0.01" value={form.cost_rate} onChange={(e) => setForm({ ...form, cost_rate: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono" />
            </label>
            <label className="block">TVA (%)
              <input type="number" min="0" max="100" step="0.01" value={form.tva_rate} onChange={(e) => setForm({ ...form, tva_rate: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono" />
            </label>
            <label className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Type actif et disponible
            </label>
          </div>
          <label className="block">Description / détails
            <textarea maxLength={1000} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" placeholder="Précisez les prestations incluses, limites et remarques..." />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-white bg-blue-700 rounded-lg disabled:opacity-50">
              <CheckCircle2 className="w-3.5 h-3.5" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
