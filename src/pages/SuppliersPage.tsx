import React, { useEffect, useState } from 'react';
import { CreditCard, PackageCheck, Pencil, Plus, Archive, RotateCcw } from 'lucide-react';
import { apiFetch, formatDA, formatDateFr, hasPerm } from '../lib/api';
import { Modal, PageHeader, StatusText } from '../components/ui';

export default function SuppliersPage({ permissions }: { permissions: string[] }) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [supOpen, setSupOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [poOpen, setPoOpen] = useState(false);
  const [payPo, setPayPo] = useState<any | null>(null);
  const [payAmt, setPayAmt] = useState(0);
  const [payMethod, setPayMethod] = useState('Virement');
  const [error, setError] = useState('');

  const [supForm, setSupForm] = useState({ name: '', contact_name: '', phone: '', address: '', nif: '', payment_terms: '30 jours', status: 'active' });
  const [poForm, setPoForm] = useState({
    supplier_id: '',
    project_id: '',
    supplier_invoice_no: '',
    receive_immediately: false,
    lines: [{ material_id: '', description: '', quantity: 10, unit_price: 0, tva_rate: 19 }],
  });

  const canWrite = hasPerm(permissions, 'suppliers:write');
  const canPay = hasPerm(permissions, 'suppliers:pay');

  async function load() {
    try {
      const [s, pu, m, pr] = await Promise.all([
        apiFetch('/suppliers'),
        apiFetch('/purchases'),
        apiFetch('/materials'),
        apiFetch('/projects'),
      ]);
      setSuppliers(s);
      setPurchases(pu);
      setMaterials(m);
      setProjects(pr);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNewSupplier() {
    setEditingSupplier(null);
    setSupForm({ name: '', contact_name: '', phone: '', address: '', nif: '', payment_terms: '30 jours', status: 'active' });
    setSupOpen(true);
  }

  function openEditSupplier(supplier: any) {
    setEditingSupplier(supplier);
    setSupForm({ name: supplier.name || '', contact_name: supplier.contact_name || '', phone: supplier.phone || '', address: supplier.address || '', nif: supplier.nif || '', payment_terms: supplier.payment_terms || '30 jours', status: supplier.status || 'active' });
    setSupOpen(true);
  }

  async function saveSupplier(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(editingSupplier ? `/suppliers/${editingSupplier.id}` : '/suppliers', { method: editingSupplier ? 'PUT' : 'POST', body: JSON.stringify(supForm) });
      setSupOpen(false);
      setEditingSupplier(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleSupplierStatus(supplier: any) {
    const next = supplier.status === 'inactive' ? 'active' : 'inactive';
    const action = next === 'inactive' ? 'archiver' : 'réactiver';
    if (!window.confirm(`Voulez-vous ${action} le fournisseur « ${supplier.name} » ? Les commandes et paiements historiques seront conservés.`)) return;
    try {
      await apiFetch(`/suppliers/${supplier.id}`, { method: 'PUT', body: JSON.stringify({ status: next }) });
      await load();
    } catch (err: any) { setError(err.message); }
  }

  async function savePurchase(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/purchases', { method: 'POST', body: JSON.stringify(poForm) });
      setPoOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function cancelPo(purchase: any) {
    if (!window.confirm(`Annuler le bon ${purchase.po_number} ? Cette action est réservée aux commandes non réceptionnées et non réglées.`)) return;
    try {
      await apiFetch(`/purchases/${purchase.id}/cancel`, { method: 'POST' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function receivePo(id: number) {
    try {
      await apiFetch(`/purchases/${id}/receive`, { method: 'POST' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payPo) return;
    try {
      await apiFetch(`/purchases/${payPo.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: payAmt, payment_method: payMethod }),
      });
      setPayPo(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fournisseurs & Achats"
        subtitle="Bons de commande, réception directe en stock et suivi des dettes fournisseurs"
        actions={
          canWrite && (
            <>
              <button type="button" onClick={openNewSupplier} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> Nouveau fournisseur
              </button>
              <button type="button" onClick={() => setPoOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> Nouveau bon de commande
              </button>
            </>
          )
        }
      />

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {suppliers.map((s) => (
          <div key={s.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs">
            <div className="flex items-start justify-between gap-2"><div className="font-bold text-slate-900 dark:text-white">{s.name}</div>{canWrite && <div className="flex items-center gap-1"><button type="button" onClick={() => openEditSupplier(s)} title="Modifier le fournisseur" aria-label={`Modifier ${s.name}`} className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="w-3 h-3" /><span>Modifier</span></button><button type="button" onClick={() => toggleSupplierStatus(s)} title={s.status === 'inactive' ? 'Réactiver' : 'Archiver'} className="p-1.5 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{s.status === 'inactive' ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}</button></div>}</div>
            <div className="text-slate-500 mt-0.5">{s.contact_name} · {s.phone}</div>
            <div className="font-mono text-[11px] text-slate-500 mt-1">NIF : {s.nif || '—'}</div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-slate-500">Solde dû</span>
              <span className={`font-mono tabular-nums font-bold ${s.balance_due > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {formatDA(s.balance_due)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Commandes &amp; Factures fournisseurs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="p-3 text-left">N° BC</th>
                <th className="p-3 text-left">Fournisseur</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-right">Total TTC</th>
                <th className="p-3 text-right">Payé</th>
                <th className="p-3 text-left">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchases.map((p) => {
                const rem = Math.max(0, p.total_ttc - p.amount_paid);
                return (
                  <tr key={p.id}>
                    <td className="p-3 font-mono font-semibold">{p.po_number}</td>
                    <td className="p-3">
                      <div className="font-medium">{p.supplier_name}</div>
                      <div className="text-[11px] text-slate-500">{p.supplier_invoice_no || 'Sans N° facture frn.'}</div>
                    </td>
                    <td className="p-3 font-mono">{formatDateFr(p.order_date)}</td>
                    <td className="p-3 text-right font-mono tabular-nums font-semibold">{formatDA(p.total_ttc)}</td>
                    <td className="p-3 text-right font-mono tabular-nums text-emerald-700">{formatDA(p.amount_paid)}</td>
                    <td className="p-3"><StatusText status={p.status} /></td>
                    <td className="p-3 text-right whitespace-nowrap space-x-2">
                      {canWrite && ['ordered','requested'].includes(p.status) && Number(p.amount_paid || 0) === 0 && (
                        <button type="button" onClick={() => cancelPo(p)} className="inline-flex items-center gap-1 px-2.5 py-1 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded" title="Annuler la commande">
                          Annuler
                        </button>
                      )}
                      {canWrite && (p.status === 'ordered' || p.status === 'requested') && (
                        <button type="button" onClick={() => receivePo(p.id)} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-700 text-white rounded">
                          <PackageCheck className="w-3 h-3" /> Réceptionner
                        </button>
                      )}
                      {canPay && rem > 0 && p.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayPo(p);
                            setPayAmt(rem);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 text-white rounded"
                        >
                          <CreditCard className="w-3 h-3" /> Régler
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={supOpen} onClose={() => { setSupOpen(false); setEditingSupplier(null); }} title={editingSupplier ? `Modifier ${editingSupplier.name}` : "Nouveau fournisseur"}>
        <form onSubmit={saveSupplier} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Raison sociale *</label>
              <input type="text" required value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block font-medium mb-1">Contact</label>
              <input type="text" value={supForm.contact_name} onChange={(e) => setSupForm({ ...supForm, contact_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block font-medium mb-1">Téléphone</label>
              <input type="text" value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block font-medium mb-1">NIF</label>
              <input type="text" value={supForm.nif} onChange={(e) => setSupForm({ ...supForm, nif: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
          </div>
          {editingSupplier && <div><label className="block font-medium mb-1">Statut du fournisseur</label><select value={supForm.status} onChange={e => setSupForm({ ...supForm, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option value="active">Actif</option><option value="inactive">Archivé</option></select></div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setSupOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Enregistrer</button>
          </div>
        </form>
      </Modal>

      <Modal open={poOpen} onClose={() => setPoOpen(false)} title="Créer un bon de commande fournisseur" maxWidth="max-w-2xl">
        <form onSubmit={savePurchase} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Fournisseur *</label>
              <select required value={poForm.supplier_id} onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="">Sélectionner...</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Chantier destinataire (optionnel)</label>
              <select value={poForm.project_id} onChange={(e) => setPoForm({ ...poForm, project_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="">Stock dépôt général</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>)}
              </select>
            </div>
          </div>
          {poForm.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <select
                value={l.material_id}
                onChange={(e) => {
                  const mat = materials.find((m) => String(m.id) === e.target.value);
                  const copy = [...poForm.lines];
                  copy[i].material_id = e.target.value;
                  if (mat) {
                    copy[i].description = mat.name;
                    copy[i].unit_price = mat.purchase_price;
                  }
                  setPoForm({ ...poForm, lines: copy });
                }}
                className="col-span-6 px-2 py-1.5 border rounded bg-white dark:bg-slate-950"
              >
                <option value="">Article libre ou matériau...</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input type="number" value={l.quantity} onChange={(e) => { const c = [...poForm.lines]; c[i].quantity = Number(e.target.value); setPoForm({ ...poForm, lines: c }); }} className="col-span-2 px-2 py-1.5 border rounded font-mono" />
              <input type="number" value={l.unit_price} onChange={(e) => { const c = [...poForm.lines]; c[i].unit_price = Number(e.target.value); setPoForm({ ...poForm, lines: c }); }} className="col-span-4 px-2 py-1.5 border rounded font-mono" placeholder="P.U HT" />
            </div>
          ))}
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={poForm.receive_immediately} onChange={(e) => setPoForm({ ...poForm, receive_immediately: e.target.checked })} />
            Réceptionner immédiatement en stock
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPoOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Créer la commande</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!payPo} onClose={() => setPayPo(null)} title={payPo ? `Régler fournisseur — ${payPo.po_number}` : ''} maxWidth="max-w-md">
        {payPo && (
          <form onSubmit={submitPayment} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium mb-1">Montant (DA)</label>
              <input type="number" value={payAmt} onChange={(e) => setPayAmt(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-medium mb-1">Mode de paiement</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="Virement">Virement bancaire</option>
                <option value="Chèque">Chèque</option>
                <option value="Espèces">Espèces</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPayPo(null)} className="px-3 py-2 border rounded-lg">Annuler</button>
              <button type="submit" className="px-4 py-2 text-white bg-emerald-700 rounded-lg">Enregistrer règlement</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
