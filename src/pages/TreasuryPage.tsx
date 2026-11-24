import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, Lock, Plus, Pencil } from 'lucide-react';
import { apiFetch, formatDA, formatDateFr, hasPerm } from '../lib/api';
import { Modal, PageHeader } from '../components/ui';

export default function TreasuryPage({
  initialTab = 'treasury',
  permissions,
}: {
  initialTab?: 'treasury' | 'expenses';
  permissions: string[];
}) {
  const [tab, setTab] = useState<'treasury' | 'expenses'>(initialTab);
  const [treasury, setTreasury] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [txOpen, setTxOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [error, setError] = useState('');

  const [txForm, setTxForm] = useState({ tx_type: 'internal_transfer', account: 'Banque', amount: 100000, category: 'Transfert interne Banque -> Caisse', notes: '' });
  const [closeForm, setCloseForm] = useState({ closing_date: new Date().toISOString().slice(0, 10), counted_balance: 0, notes: '' });
  const [expForm, setExpForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: 'Restauration chantier',
    description: '',
    amount: 0,
    payment_method: 'Espèces',
    project_id: '',
    vehicle_id: '',
    is_overhead: false,
  });

  const canWriteTreasury = hasPerm(permissions, 'treasury:write');
  const canWriteExpenses = hasPerm(permissions, 'expenses:write');
  const canCancelExpense = canWriteExpenses && hasPerm(permissions, 'lifecycle:cancel');
  const canReverseTreasury = canWriteTreasury && hasPerm(permissions, 'lifecycle:reverse');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  async function load() {
    try {
      const [tr, ex, pr, vh] = await Promise.all([
        hasPerm(permissions, 'treasury:read') ? apiFetch('/treasury') : Promise.resolve(null),
        hasPerm(permissions, 'expenses:read') ? apiFetch('/expenses') : Promise.resolve([]),
        hasPerm(permissions, 'projects:read') ? apiFetch('/projects') : Promise.resolve([]),
        hasPerm(permissions, 'vehicles:read') ? apiFetch('/vehicles') : Promise.resolve([]),
      ]);
      setTreasury(tr);
      setExpenses(ex);
      setProjects(pr);
      setVehicles(vh);
      if (tr) setCloseForm((c) => ({ ...c, counted_balance: tr.cashBalance }));
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveTx(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/treasury/transactions', { method: 'POST', body: JSON.stringify(txForm) });
      setTxOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function submitClosing(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/treasury/cash-closings', { method: 'POST', body: JSON.stringify(closeForm) });
      setCloseOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function reconcileTx(id: number) {
    try {
      await apiFetch('/treasury/reconcile', {
        method: 'POST',
        body: JSON.stringify({ id, reconciled: true, bank_statement_ref: `REL-${Date.now().toString().slice(-4)}` }),
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function openNewExpense() {
    setEditingExpense(null);
    setExpForm({ expense_date: new Date().toISOString().slice(0, 10), category: 'Restauration chantier', description: '', amount: 0, payment_method: 'Espèces', project_id: '', vehicle_id: '', is_overhead: false });
    setExpOpen(true);
  }

  function openEditExpense(expense: any) {
    setEditingExpense(expense);
    setExpForm({
      expense_date: expense.expense_date || new Date().toISOString().slice(0, 10),
      category: expense.category || 'Divers',
      description: expense.description || '',
      amount: Number(expense.amount || 0),
      payment_method: expense.payment_method || 'Espèces',
      project_id: expense.project_id ? String(expense.project_id) : '',
      vehicle_id: expense.vehicle_id ? String(expense.vehicle_id) : '',
      is_overhead: !!expense.is_overhead,
    });
    setExpOpen(true);
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(editingExpense ? `/expenses/${editingExpense.id}` : '/expenses', { method: editingExpense ? 'PUT' : 'POST', body: JSON.stringify(expForm) });
      setExpOpen(false);
      setEditingExpense(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function cancelExpense(expense: any) {
    if (!window.confirm(`Annuler la dépense « ${expense.description} » (${formatDA(expense.amount)}) ? Le mouvement de trésorerie sera contre-passé et la dépense ne comptera plus dans les coûts.`)) return;
    setError('');
    try {
      await apiFetch(`/expenses/${expense.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Annulation depuis la liste des dépenses' }),
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function reverseTx(tx: any) {
    if (!window.confirm(`Contre-passer la transaction #${tx.id} (${formatDA(tx.amount)}) ? Une écriture inverse sera enregistrée sans supprimer l’historique.`)) return;
    setError('');
    try {
      await apiFetch(`/treasury/transactions/${tx.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Contre-passation depuis le journal de trésorerie' }),
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trésorerie, Caisse, Banque & Dépenses"
        subtitle="Les transferts internes Banque ↔ Caisse ajustent uniquement les soldes sans gonfler ni le CA ni les charges"
        actions={
          <div className="flex flex-wrap gap-2">
            {canWriteTreasury && (
              <>
                <button type="button" onClick={() => setCloseOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg">
                  <Lock className="w-3.5 h-3.5" /> Clôture de caisse
                </button>
                <button type="button" onClick={() => setTxOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Transfert / Mouvement
                </button>
              </>
            )}
            {canWriteExpenses && (
              <button type="button" onClick={openNewExpense} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> Nouvelle dépense
              </button>
            )}
          </div>
        }
      />

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 text-xs">
        <button type="button" onClick={() => setTab('treasury')} className={`px-4 py-2 font-medium border-b-2 ${tab === 'treasury' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'}`}>
          Trésorerie Caisse &amp; Banque
        </button>
        <button type="button" onClick={() => setTab('expenses')} className={`px-4 py-2 font-medium border-b-2 ${tab === 'expenses' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'}`}>
          Dépenses &amp; Frais généraux ({expenses.length})
        </button>
      </div>

      {tab === 'treasury' && treasury && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-slate-500">Solde Caisse (Espèces)</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-1">{formatDA(treasury.cashBalance)}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-slate-500">Solde Banque</div>
              <div className="text-xl font-bold font-mono tabular-nums text-blue-700 mt-1">{formatDA(treasury.bankBalance)}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-slate-500">Liquidités totales</div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">{formatDA(treasury.totalLiquid)}</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
              Journal de trésorerie &amp; rapprochement bancaire
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Compte</th>
                    <th className="p-3 text-left">Catégorie / Libellé</th>
                    <th className="p-3 text-right">Montant</th>
                    <th className="p-3 text-left">Rapprochement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {treasury.transactions.map((t: any) => (
                    <tr key={t.id}>
                      <td className="p-3 font-mono">{formatDateFr(t.tx_date)}</td>
                      <td className="p-3 font-medium">
                        {t.account}{t.to_account ? ` → ${t.to_account}` : ''}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{t.category}</div>
                        <div className="text-[11px] text-slate-500">{t.notes}</div>
                      </td>
                      <td className={`p-3 text-right font-mono tabular-nums font-bold ${
                        t.tx_type.endsWith('inflow') ? 'text-emerald-700' : t.tx_type === 'internal_transfer' ? 'text-blue-700' : 'text-red-700'
                      }`}>
                        {t.tx_type.endsWith('outflow') ? '-' : t.tx_type === 'internal_transfer' ? '⇄ ' : '+'}{formatDA(t.amount)}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {t.status === 'reversed' && (
                            <span className="text-[11px] font-medium text-amber-700">Contre-passée</span>
                          )}
                          {t.account === 'Banque' && (
                            t.bank_reconciled ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-mono text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Pointé ({t.bank_statement_ref})
                              </span>
                            ) : canWriteTreasury ? (
                              <button type="button" onClick={() => reconcileTx(t.id)} className="text-blue-700 hover:underline text-left">
                                Pointer relevé
                              </button>
                            ) : <span className="text-[11px] text-slate-500">En attente</span>
                          )}
                          {canReverseTreasury && t.status !== 'reversed' && !t.reversed_transaction_id && (
                            <button type="button" onClick={() => reverseTx(t)} className="text-amber-700 hover:underline text-left">
                              Contre-passer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Catégorie</th>
                <th className="p-3 text-left">Libellé</th>
                <th className="p-3 text-left">Imputation</th>
                <th className="p-3 text-left">Véhicule / Paiement</th>
                <th className="p-3 text-right">Montant</th>
                {canWriteExpenses && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="p-3 font-mono">{formatDateFr(e.expense_date)}</td>
                  <td className="p-3">{e.category}</td>
                  <td className="p-3 font-medium">{e.description}</td>
                  <td className="p-3">{e.project_number ? `${e.project_number} — ${e.project_title}` : 'Frais généraux'}</td>
                  <td className="p-3"><div>{e.vehicle_name || '—'}</div><div className="text-[10px] text-slate-500">{e.payment_method || 'Espèces'}</div></td>
                  <td className={`p-3 text-right font-mono tabular-nums font-bold ${e.status === 'cancelled' ? 'line-through text-slate-400' : ''}`}>{formatDA(e.amount)}</td>
                  {canWriteExpenses && (
                    <td className="p-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {e.status === 'cancelled' ? (
                          <span className="text-[11px] font-medium text-amber-700">Annulée</span>
                        ) : (
                          <>
                            <button type="button" onClick={() => openEditExpense(e)} className="inline-flex items-center gap-1 px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="w-3.5 h-3.5" /> Modifier</button>
                            {canCancelExpense && (
                              <button type="button" onClick={() => cancelExpense(e)} className="inline-flex items-center gap-1 px-2 py-1.5 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20">Annuler</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={txOpen} onClose={() => setTxOpen(false)} title="Nouveau mouvement / Transfert interne" maxWidth="max-w-md">
        <form onSubmit={saveTx} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium mb-1">Type d’opération</label>
            <select value={txForm.tx_type} onChange={(e) => setTxForm({ ...txForm, tx_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
              <option value="internal_transfer">Transfert interne Banque → Caisse</option>
              <option value="cash_inflow">Entrée caisse (apport)</option>
              <option value="bank_inflow">Entrée banque</option>
              <option value="cash_outflow">Sortie caisse</option>
              <option value="bank_outflow">Sortie banque</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Montant (DA) *</label>
            <input type="number" required value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
          </div>
          <div>
            <label className="block font-medium mb-1">Libellé / Notes</label>
            <input type="text" value={txForm.notes} onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTxOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Valider</button>
          </div>
        </form>
      </Modal>

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Clôture de caisse journalière" maxWidth="max-w-md">
        <form onSubmit={submitClosing} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium mb-1">Date de clôture</label>
            <input type="date" value={closeForm.closing_date} onChange={(e) => setCloseForm({ ...closeForm, closing_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block font-medium mb-1">Solde physique compté en caisse (DA)</label>
            <input type="number" step="0.01" value={closeForm.counted_balance} onChange={(e) => setCloseForm({ ...closeForm, counted_balance: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
          </div>
          <div>
            <label className="block font-medium mb-1">Justification (si écart)</label>
            <input type="text" value={closeForm.notes} onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCloseOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Clôturer la caisse</button>
          </div>
        </form>
      </Modal>

      <Modal open={expOpen} onClose={() => { setExpOpen(false); setEditingExpense(null); }} title={editingExpense ? "Modifier une dépense" : "Enregistrer une dépense"} maxWidth="max-w-md">
        <form onSubmit={saveExpense} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium mb-1">Date de dépense</label>
            <input type="date" required value={expForm.expense_date} onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block font-medium mb-1">Catégorie</label>
            <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
              <option>Sous-traitance</option>
              <option>Restauration chantier</option>
              <option>Transport &amp; Livraison</option>
              <option>Loyer dépôt &amp; bureau</option>
              <option>Frais administratifs</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Libellé *</label>
            <input type="text" required value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Montant (DA) *</label>
              <input type="number" required value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-medium mb-1">Chantier lié</label>
              <select value={expForm.project_id} onChange={(e) => setExpForm({ ...expForm, project_id: e.target.value, is_overhead: !e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="">Frais généraux entreprise</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_number}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Mode de paiement</label>
            <select value={expForm.payment_method} onChange={(e) => setExpForm({ ...expForm, payment_method: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option>Espèces</option><option>Virement</option><option>Chèque</option></select>
          </div>
          <div>
            <label className="block font-medium mb-1">Véhicule lié</label>
            <select value={expForm.vehicle_id || ''} onChange={(e) => setExpForm({ ...expForm, vehicle_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option value="">Aucun véhicule</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} {v.registration ? `— ${v.registration}` : ''}</option>)}</select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setExpOpen(false); setEditingExpense(null); }} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-emerald-700 rounded-lg">{editingExpense ? "Enregistrer les modifications" : "Enregistrer"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
