import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch, formatDA, formatNum, hasPerm } from '../lib/api';
import { EmptyState, Modal, PageHeader, StatusText } from '../components/ui';

const UNITS = ['U', 'm', 'm²', 'm³', 'kg', 'tonne', 'jour', 'heure', 'forfait'];

const RESOURCE_LABELS: Record<string, string> = {
  material: 'Matériau',
  labour: 'Main-d’œuvre',
  equipment: 'Matériel',
  subcontract: 'Sous-traitance',
  transport: 'Transport',
};

export default function BoqPage({ permissions }: { permissions: string[] }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [boq, setBoq] = useState<{ project: any; versions: any[] } | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [versionOpen, setVersionOpen] = useState(false);
  const [versionForm, setVersionForm] = useState({ label: '', notes: '' });
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState({ code: '', title: '', sort_order: 1 });
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemForm, setItemForm] = useState<any>({ section_id: '', code: '', description: '', unit: 'U', quantity: 0, unit_price: 0 });
  const [resourceItem, setResourceItem] = useState<any | null>(null);
  const [resourceForm, setResourceForm] = useState({ resource_type: 'material', label: '', unit: '', quantity: 1, unit_cost: 0 });

  const canWrite = hasPerm(permissions, 'projects:write');
  const canApprove = hasPerm(permissions, 'projects:approve');
  const isDraft = detail?.status === 'draft';

  useEffect(() => {
    apiFetch('/projects')
      .then((rows: any[]) => {
        setProjects(rows || []);
        if (rows?.length) setProjectId(String(rows[0].id));
      })
      .catch((e: any) => setError(e.message));
  }, []);

  useEffect(() => {
    if (projectId) loadProject(projectId);
  }, [projectId]);

  async function loadProject(id: string | number) {
    try {
      setError('');
      const data = await apiFetch(`/projects/${id}/boq`);
      setBoq(data as any);
      const first = (data as any).versions?.[0];
      if (first) {
        await openVersion(first.id);
      } else {
        setDetail(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function openVersion(id: number) {
    try {
      setDetail(await apiFetch(`/boq/versions/${id}`));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function refresh(payload?: any) {
    if (!projectId) return;
    const list = await apiFetch(`/projects/${projectId}/boq`);
    setBoq(list as any);
    if (payload) setDetail(payload);
    else if (detail?.id) setDetail(await apiFetch(`/boq/versions/${detail.id}`));
  }

  async function mutate(path: string, method: string, body?: any) {
    setBusy(true);
    setError('');
    try {
      const payload = body === undefined ? await apiFetch(path, { method }) : await apiFetch(path, { method, body: JSON.stringify(body) });
      await refresh(payload);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createVersion(e: React.FormEvent) {
    e.preventDefault();
    const ok = await mutate(`/projects/${projectId}/boq/versions`, 'POST', versionForm);
    if (ok) {
      setVersionOpen(false);
      setVersionForm({ label: '', notes: '' });
    }
  }

  async function createSection(e: React.FormEvent) {
    e.preventDefault();
    const ok = await mutate(`/boq/versions/${detail.id}/sections`, 'POST', sectionForm);
    if (ok) {
      setSectionOpen(false);
      setSectionForm({ code: '', title: '', sort_order: 1 });
    }
  }

  function openNewItem(sectionId?: number) {
    setEditingItem(null);
    setItemForm({ section_id: sectionId ? String(sectionId) : '', code: '', description: '', unit: 'U', quantity: 0, unit_price: 0 });
    setItemOpen(true);
  }

  function openEditItem(item: any) {
    setEditingItem(item);
    setItemForm({
      section_id: item.section_id ? String(item.section_id) : '',
      code: item.code || '',
      description: item.description || '',
      unit: item.unit || 'U',
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
    });
    setItemOpen(true);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    const ok = editingItem
      ? await mutate(`/boq/items/${editingItem.id}`, 'PUT', itemForm)
      : await mutate(`/boq/versions/${detail.id}/items`, 'POST', itemForm);
    if (ok) setItemOpen(false);
  }

  async function addResource(e: React.FormEvent) {
    e.preventDefault();
    if (!resourceItem) return;
    const ok = await mutate(`/boq/items/${resourceItem.id}/resources`, 'POST', resourceForm);
    if (ok) {
      setResourceForm({ resource_type: 'material', label: '', unit: '', quantity: 1, unit_cost: 0 });
      const updated = await apiFetch(`/boq/versions/${detail.id}`);
      setDetail(updated);
      setResourceItem((updated as any).items.find((i: any) => i.id === resourceItem.id) || null);
    }
  }

  async function deleteResource(resource: any) {
    if (!window.confirm(`Supprimer la ressource « ${resource.label} » de l’analyse du prix ?`)) return;
    await mutate(`/boq/resources/${resource.id}`, 'DELETE');
    const updated = await apiFetch(`/boq/versions/${detail.id}`);
    setDetail(updated);
    setResourceItem((updated as any).items.find((i: any) => i.id === resourceItem?.id) || null);
  }

  async function deleteItem(item: any) {
    if (!window.confirm(`Supprimer le poste « ${item.description} » et son analyse de prix ?`)) return;
    await mutate(`/boq/items/${item.id}`, 'DELETE');
  }

  async function approveVersion() {
    if (!detail) return;
    if (!window.confirm('Approuver cette version de BOQ ? Elle deviendra la référence du chantier et ne sera plus modifiable.')) return;
    await mutate(`/boq/versions/${detail.id}/approve`, 'POST');
  }

  async function duplicateVersion() {
    if (!detail) return;
    await mutate(`/boq/versions/${detail.id}/duplicate`, 'POST');
  }

  const itemsBySection = (sectionId: number | null) =>
    (detail?.items || []).filter((i: any) => (i.section_id ?? null) === sectionId);

  function renderItemTable(items: any[]) {
    if (items.length === 0) return null;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="p-2 text-left">Code</th>
              <th className="p-2 text-left">Désignation</th>
              <th className="p-2 text-left">Unité</th>
              <th className="p-2 text-right">Quantité</th>
              <th className="p-2 text-right">P.U. vente</th>
              <th className="p-2 text-right">Total HT</th>
              <th className="p-2 text-right">Coût unitaire</th>
              {canWrite && isDraft && <th className="p-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item: any) => (
              <tr key={item.id}>
                <td className="p-2 font-mono">{item.code || '—'}</td>
                <td className="p-2 font-medium">{item.description}</td>
                <td className="p-2">{item.unit}</td>
                <td className="p-2 text-right font-mono">{formatNum(item.quantity, 2)}</td>
                <td className="p-2 text-right font-mono">{formatDA(item.unit_price, 2)}</td>
                <td className="p-2 text-right font-mono font-semibold">{formatDA(item.line_ht, 2)}</td>
                <td className="p-2 text-right font-mono">{formatDA(item.unit_cost, 2)}</td>
                {canWrite && isDraft && (
                  <td className="p-2">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button type="button" onClick={() => setResourceItem(item)} className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-lg">
                        Analyse
                      </button>
                      <button type="button" aria-label={`Modifier ${item.description}`} onClick={() => openEditItem(item)} className="p-1.5 border border-slate-300 dark:border-slate-700 rounded-lg">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" aria-label={`Supprimer ${item.description}`} onClick={() => deleteItem(item)} className="p-1.5 border border-red-200 dark:border-red-900 text-red-700 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="BOQ & Études de prix"
        subtitle="Bordereau des quantités versionné, analyse des prix et marge prévisionnelle par chantier"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Chantier"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_number} — {p.title}
                </option>
              ))}
            </select>
            {canWrite && projectId && (
              <button type="button" onClick={() => setVersionOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> Nouvelle version
              </button>
            )}
          </div>
        }
      />

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      {projects.length === 0 && <EmptyState message="Aucun chantier enregistré." hint="Créez un chantier avant d’établir un BOQ." />}

      {boq && projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-xs font-semibold text-slate-500 uppercase">Versions ({boq.versions.length})</h2>
            {boq.versions.length === 0 && (
              <div className="p-4 text-xs text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                Aucune version de BOQ pour ce chantier.
              </div>
            )}
            {boq.versions.map((v: any) => (
              <button
                key={v.id}
                type="button"
                onClick={() => openVersion(v.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  detail?.id === v.id
                    ? 'border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold">V{v.version_number}</span>
                  <StatusText status={v.status} />
                </div>
                <div className="text-xs mt-1 truncate">{v.label}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">{formatDA(v.totals?.total_ht)}</div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3 space-y-4">
            {!detail && <EmptyState message="Sélectionnez une version de BOQ." hint="Ou créez une première version pour ce chantier." />}

            {detail && (
              <>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold">
                          V{detail.version_number} — {detail.label}
                        </h2>
                        <StatusText status={detail.status} />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {detail.sections.length} section(s) · {detail.totals.item_count} poste(s)
                        {detail.created_by_name ? ` · créée par ${detail.created_by_name}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canWrite && (
                        <button type="button" disabled={busy} onClick={duplicateVersion} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg disabled:opacity-50">
                          <Copy className="w-3.5 h-3.5" /> Dupliquer en révision
                        </button>
                      )}
                      {canApprove && detail.status !== 'approved' && (
                        <button type="button" disabled={busy} onClick={approveVersion} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg disabled:opacity-50">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
                    <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <div className="text-slate-500">Total HT</div>
                      <div className="font-mono font-bold mt-1">{formatDA(detail.totals.total_ht)}</div>
                    </div>
                    <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <div className="text-slate-500">Coût estimé</div>
                      <div className="font-mono font-bold mt-1">{formatDA(detail.totals.total_cost)}</div>
                    </div>
                    <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <div className="text-slate-500">Marge prévisionnelle</div>
                      <div className={`font-mono font-bold mt-1 ${detail.totals.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatDA(detail.totals.margin)}
                      </div>
                    </div>
                    <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <div className="text-slate-500">Taux de marge</div>
                      <div className="font-mono font-bold mt-1">{detail.totals.margin_percent}%</div>
                    </div>
                  </div>

                  {detail.notes && <div className="mt-3 text-[11px] text-slate-500">{detail.notes}</div>}
                </div>

                {canWrite && isDraft && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSectionOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-blue-700 text-blue-700 rounded-lg">
                      <Plus className="w-3.5 h-3.5" /> Nouvelle section
                    </button>
                    <button type="button" onClick={() => openNewItem()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg">
                      <Plus className="w-3.5 h-3.5" /> Nouveau poste
                    </button>
                  </div>
                )}

                {detail.items.length === 0 && (
                  <EmptyState message="Aucun poste dans cette version." hint={isDraft && canWrite ? 'Ajoutez une section puis des postes, ou directement un poste sans section.' : undefined} />
                )}

                {detail.sections.map((section: any) => (
                  <div key={section.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <h3 className="text-xs font-semibold">
                        {section.code ? `${section.code} — ` : ''}
                        {section.title}
                      </h3>
                      {canWrite && isDraft && (
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => openNewItem(section.id)} className="text-[11px] text-blue-700 hover:underline">
                            Ajouter un poste
                          </button>
                          <button
                            type="button"
                            aria-label={`Supprimer la section ${section.title}`}
                            onClick={async () => {
                              if (window.confirm(`Supprimer la section « ${section.title} » ? Les postes seront conservés sans section.`)) {
                                await mutate(`/boq/sections/${section.id}`, 'DELETE');
                              }
                            }}
                            className="p-1 text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {renderItemTable(itemsBySection(section.id)) || (
                      <div className="p-4 text-[11px] text-slate-500">Aucun poste dans cette section.</div>
                    )}
                  </div>
                ))}

                {itemsBySection(null).length > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-xs font-semibold">Postes sans section</h3>
                    </div>
                    {renderItemTable(itemsBySection(null))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <Modal open={versionOpen} onClose={() => setVersionOpen(false)} title="Nouvelle version de BOQ" maxWidth="max-w-md">
        <form onSubmit={createVersion} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium mb-1">Libellé *</label>
            <input required value={versionForm.label} onChange={(e) => setVersionForm({ ...versionForm, label: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
          </div>
          <div>
            <label className="block font-medium mb-1">Notes</label>
            <textarea value={versionForm.notes} onChange={(e) => setVersionForm({ ...versionForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setVersionOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-white bg-blue-700 rounded-lg disabled:opacity-50">Créer</button>
          </div>
        </form>
      </Modal>

      <Modal open={sectionOpen} onClose={() => setSectionOpen(false)} title="Nouvelle section de BOQ" maxWidth="max-w-md">
        <form onSubmit={createSection} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Code</label>
              <input value={sectionForm.code} onChange={(e) => setSectionForm({ ...sectionForm, code: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">Ordre</label>
              <input type="number" min="1" value={sectionForm.sort_order} onChange={(e) => setSectionForm({ ...sectionForm, sort_order: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950" />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Titre *</label>
            <input required value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setSectionOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-white bg-blue-700 rounded-lg disabled:opacity-50">Créer la section</button>
          </div>
        </form>
      </Modal>

      <Modal open={itemOpen} onClose={() => setItemOpen(false)} title={editingItem ? 'Modifier le poste' : 'Nouveau poste de BOQ'}>
        <form onSubmit={saveItem} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Section</label>
              <select value={itemForm.section_id} onChange={(e) => setItemForm({ ...itemForm, section_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="">Sans section</option>
                {detail?.sections.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Code</label>
              <input value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950" />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Désignation *</label>
            <input required value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium mb-1">Unité *</label>
              <input required list="boq-units" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
              <datalist id="boq-units">
                {UNITS.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
            <div>
              <label className="block font-medium mb-1">Quantité *</label>
              <input type="number" required min="0" step="0.001" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">Prix unitaire (DA) *</label>
              <input type="number" required min="0" step="0.01" value={itemForm.unit_price} onChange={(e) => setItemForm({ ...itemForm, unit_price: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Le coût unitaire est calculé à partir de l’analyse du prix (matériaux, main-d’œuvre, matériel, sous-traitance, transport).
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setItemOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-white bg-blue-700 rounded-lg disabled:opacity-50">
              {editingItem ? 'Enregistrer' : 'Ajouter le poste'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resourceItem} onClose={() => setResourceItem(null)} title={resourceItem ? `Analyse du prix — ${resourceItem.description}` : 'Analyse du prix'}>
        {resourceItem && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-slate-500">Coût unitaire calculé</div>
                <div className="font-mono font-bold mt-1">{formatDA(resourceItem.unit_cost, 2)}</div>
              </div>
              <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-slate-500">Prix de vente</div>
                <div className="font-mono font-bold mt-1">{formatDA(resourceItem.unit_price, 2)}</div>
              </div>
              <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-slate-500">Marge unitaire</div>
                <div className={`font-mono font-bold mt-1 ${resourceItem.unit_price - resourceItem.unit_cost >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatDA(resourceItem.unit_price - resourceItem.unit_cost, 2)}
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {(resourceItem.resources || []).map((r: any) => (
                <div key={r.id} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[11px] text-slate-500">
                      {RESOURCE_LABELS[r.resource_type] || r.resource_type}
                      {r.unit ? ` · ${r.unit}` : ''} · {formatNum(r.quantity, 3)} × {formatDA(r.unit_cost, 2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{formatDA(Number(r.quantity) * Number(r.unit_cost), 2)}</span>
                    {canWrite && isDraft && (
                      <button type="button" aria-label={`Supprimer ${r.label}`} onClick={() => deleteResource(r)} className="p-1 text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(resourceItem.resources || []).length === 0 && (
                <div className="p-4 text-center text-slate-500">Aucune ressource : le coût unitaire est de 0 DA.</div>
              )}
            </div>

            {canWrite && isDraft && (
              <form onSubmit={addResource} className="grid grid-cols-12 gap-2 items-end border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="col-span-3">
                  <label className="block text-[11px] text-slate-500 mb-1">Type</label>
                  <select value={resourceForm.resource_type} onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })} className="w-full px-2 py-1.5 border rounded-lg bg-white dark:bg-slate-950">
                    {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] text-slate-500 mb-1">Libellé *</label>
                  <input required value={resourceForm.label} onChange={(e) => setResourceForm({ ...resourceForm, label: e.target.value })} className="w-full px-2 py-1.5 border rounded-lg bg-white dark:bg-slate-950" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-500 mb-1">Quantité</label>
                  <input type="number" min="0" step="0.001" value={resourceForm.quantity} onChange={(e) => setResourceForm({ ...resourceForm, quantity: Number(e.target.value) })} className="w-full px-2 py-1.5 border rounded-lg font-mono bg-white dark:bg-slate-950" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-500 mb-1">Coût unitaire</label>
                  <input type="number" min="0" step="0.01" value={resourceForm.unit_cost} onChange={(e) => setResourceForm({ ...resourceForm, unit_cost: Number(e.target.value) })} className="w-full px-2 py-1.5 border rounded-lg font-mono bg-white dark:bg-slate-950" />
                </div>
                <div className="col-span-2">
                  <button type="submit" disabled={busy} className="w-full px-2 py-2 text-white bg-blue-700 rounded-lg disabled:opacity-50">Ajouter</button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
