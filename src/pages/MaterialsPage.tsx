import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, Pencil, Plus } from 'lucide-react';
import { apiFetch, downloadWithAuth, formatDA, formatDateFr, hasPerm } from '../lib/api';
import { Modal, PageHeader, StatusText } from '../components/ui';

export default function MaterialsPage({ permissions }: { permissions: string[] }) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [matOpen, setMatOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);
  const [movOpen, setMovOpen] = useState(false);
  const [error, setError] = useState('');

  const [matForm, setMatForm] = useState({
    name: '',
    code: '',
    category: 'Ciment & Liants',
    unit: 'Sac',
    current_quantity: 0,
    purchase_price: 0,
    min_stock_level: 10,
    storage_location: 'Dépôt principal',
  });

  const [movForm, setMovForm] = useState({
    movement_type: 'exit',
    material_id: '',
    quantity: 1,
    project_id: '',
    reference: '',
    notes: '',
    movement_date: new Date().toISOString().slice(0, 10),
  });

  const canWrite = hasPerm(permissions, 'materials:write');

  async function load() {
    try {
      const [m, mv, p] = await Promise.all([
        apiFetch('/materials'),
        apiFetch('/stock-movements'),
        apiFetch('/projects'),
      ]);
      setMaterials(m);
      setMovements(mv);
      setProjects(p);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNewMaterial() {
    setEditingMaterial(null);
    setMatForm({ name: '', code: '', category: 'Ciment & Liants', unit: 'Sac', current_quantity: 0, purchase_price: 0, min_stock_level: 10, storage_location: 'Dépôt principal' });
    setMatOpen(true);
  }

  function openEditMaterial(material: any) {
    setEditingMaterial(material);
    setMatForm({ name: material.name, code: material.code, category: material.category || 'Divers', unit: material.unit || 'U', current_quantity: material.current_quantity, purchase_price: material.purchase_price, min_stock_level: material.min_stock_level, storage_location: material.storage_location || 'Dépôt principal' });
    setMatOpen(true);
  }

  async function saveMaterial(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch(editingMaterial ? `/materials/${editingMaterial.id}` : '/materials', { method: editingMaterial ? 'PUT' : 'POST', body: JSON.stringify(matForm) });
      setMatOpen(false);
      setEditingMaterial(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveMovement(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/stock-movements', { method: 'POST', body: JSON.stringify(movForm) });
      setMovOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Matériaux & Gestion du Stock"
        subtitle="Suivi des quantités, seuils d’alerte et bons de sortie imputés directement aux chantiers"
        actions={
          <>
            <button
              type="button"
              onClick={() => downloadWithAuth('/materials/export/xlsx', 'stock_materiaux_gestionpro_dz.xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
            {canWrite && (
              <>
                <button
                  type="button"
                  onClick={() => setMovOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> Mouvement (Entrée / Sortie chantier)
                </button>
                <button
                  type="button"
                  onClick={openNewMaterial}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Nouveau matériau
                </button>
              </>
            )}
          </>
        }
      />

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Matériau</th>
                <th className="p-3 text-left">Emplacement</th>
                <th className="p-3 text-right">Stock actuel</th>
                <th className="p-3 text-right">Seuil min.</th>
                <th className="p-3 text-right">Prix achat unitaire</th>
                <th className="p-3 text-left">État</th>
                {canWrite && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {materials.map((m) => {
                const isLow = m.current_quantity <= m.min_stock_level;
                return (
                  <tr key={m.id} className={isLow ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                    <td className="p-3 font-mono font-semibold">{m.code}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{m.name}</div>
                      <div className="text-[11px] text-slate-500">{m.category}</div>
                    </td>
                    <td className="p-3">{m.storage_location}</td>
                    <td className="p-3 text-right font-mono tabular-nums font-bold">
                      {m.current_quantity} {m.unit}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-slate-500">
                      {m.min_stock_level} {m.unit}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">{formatDA(m.purchase_price)}</td>
                    <td className="p-3">
                      <StatusText status={isLow ? 'delayed' : 'available'} label={isLow ? 'Stock bas' : 'Normal'} />
                    </td>
                    {canWrite && <td className="p-3 text-right"><button type="button" onClick={() => openEditMaterial(m)} title="Modifier le matériau" aria-label={`Modifier ${m.name}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="w-3.5 h-3.5" /> Modifier</button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movements Journal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Derniers mouvements de stock</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Matériau</th>
                <th className="p-3 text-left">Chantier / Origine</th>
                <th className="p-3 text-right">Quantité</th>
                <th className="p-3 text-right">Valeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {movements.map((mv) => (
                <tr key={mv.id}>
                  <td className="p-3 font-mono">{formatDateFr(mv.movement_date)}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 font-medium ${mv.movement_type === 'entry' || mv.movement_type === 'return' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {mv.movement_type === 'entry' || mv.movement_type === 'return' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                      {mv.movement_type === 'entry' ? 'Entrée' : mv.movement_type === 'exit' ? 'Sortie chantier' : mv.movement_type === 'return' ? 'Retour chantier' : mv.movement_type}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{mv.material_name}</td>
                  <td className="p-3">{mv.project_number ? `${mv.project_number} — ${mv.project_title}` : mv.supplier_name || mv.from_location}</td>
                  <td className="p-3 text-right font-mono tabular-nums">{mv.quantity} {mv.unit}</td>
                  <td className="p-3 text-right font-mono tabular-nums font-semibold">{formatDA(mv.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={matOpen} onClose={() => { setMatOpen(false); setEditingMaterial(null); }} title={editingMaterial ? `Modifier ${editingMaterial.name}` : "Nouveau matériau en catalogue"}>
        <form onSubmit={saveMaterial} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Code article *</label>
              <input type="text" required value={matForm.code} onChange={(e) => setMatForm({ ...matForm, code: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-medium mb-1">Désignation *</label>
              <input type="text" required value={matForm.name} onChange={(e) => setMatForm({ ...matForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block font-medium mb-1">Unité</label>
              <input type="text" value={matForm.unit} onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block font-medium mb-1">Stock initial</label>
              <input type="number" value={matForm.current_quantity} onChange={(e) => setMatForm({ ...matForm, current_quantity: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-medium mb-1">Prix d’achat unitaire (DA)</label>
              <input type="number" value={matForm.purchase_price} onChange={(e) => setMatForm({ ...matForm, purchase_price: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-medium mb-1">Seuil d’alerte minimum</label>
              <input type="number" value={matForm.min_stock_level} onChange={(e) => setMatForm({ ...matForm, min_stock_level: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setMatOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Enregistrer</button>
          </div>
        </form>
      </Modal>

      <Modal open={movOpen} onClose={() => setMovOpen(false)} title="Enregistrer un mouvement de stock">
        <form onSubmit={saveMovement} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Type de mouvement</label>
              <select value={movForm.movement_type} onChange={(e) => setMovForm({ ...movForm, movement_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="exit">Sortie vers chantier (imputation coût)</option>
                <option value="return">Retour chantier vers dépôt</option>
                <option value="entry">Entrée stock dépôt</option>
                <option value="loss">Perte / Casse</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Matériau *</label>
              <select required value={movForm.material_id} onChange={(e) => setMovForm({ ...movForm, material_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="">Sélectionner...</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} (Dispo : {m.current_quantity} {m.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Quantité *</label>
              <input type="number" step="0.01" required value={movForm.quantity} onChange={(e) => setMovForm({ ...movForm, quantity: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-medium mb-1">Chantier concerné {(movForm.movement_type === 'exit' || movForm.movement_type === 'return') ? '*' : ''}</label>
              <select value={movForm.project_id} onChange={(e) => setMovForm({ ...movForm, project_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="">Sélectionner un chantier...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Bon de sortie / Référence</label>
            <input type="text" value={movForm.reference} onChange={(e) => setMovForm({ ...movForm, reference: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setMovOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-emerald-700 rounded-lg">Valider le mouvement</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
