import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, CreditCard, FilePlus2, Plus, Printer, RotateCcw } from 'lucide-react';
import { apiFetch, formatDA, formatDateFr, hasPerm } from '../lib/api';
import { CommercialPrintModal, Modal, PageHeader, PaymentReceiptPrintModal, StatusText } from '../components/ui';

const TYPE_LABELS: Record<string, string> = {
  devis: 'Devis',
  proforma: 'Proforma',
  bon_livraison: 'Bon de livraison',
  facture: 'Facture',
  avoir: 'Facture d’avoir',
};

export default function InvoicesPage({ permissions }: { permissions: string[] }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [filterType, setFilterType] = useState('all');
  const [printDoc, setPrintDoc] = useState<any | null>(null);
  const [printPayment, setPrintPayment] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [payDoc, setPayDoc] = useState<any | null>(null);
  const [dupWarning, setDupWarning] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    doc_type: 'devis',
    client_id: '',
    project_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    discount_percent: 0,
    issue_immediately: false,
    notes: '',
    lines: [{ description: '', unit: 'Forfait', quantity: 1, unit_price: 0, tva_rate: 19 }],
  });

  const [payForm, setPayForm] = useState({
    amount: 0,
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'Espèces',
    reference: '',
    notes: '',
  });

  const canWrite = hasPerm(permissions, 'invoices:write');
  const canApprove = hasPerm(permissions, 'invoices:approve');

  async function load() {
    try {
      const [d, p, c, pr, comp] = await Promise.all([
        apiFetch('/commercial-documents'),
        apiFetch('/payments'),
        apiFetch('/clients'),
        apiFetch('/projects'),
        apiFetch('/settings'),
      ]);
      setDocs(d);
      setPayments(p);
      setClients(c);
      setProjects(pr);
      setCompany(comp);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/commercial-documents', { method: 'POST', body: JSON.stringify(form) });
      setCreateOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function convertToInvoice(id: number) {
    try {
      await apiFetch(`/commercial-documents/${id}/convert-to-invoice`, { method: 'POST' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function createCreditNote(doc: any) {
    try {
      await apiFetch(`/commercial-documents/${doc.id}/credit-note`, {
        method: 'POST',
        body: JSON.stringify({ reason: `Avoir émis sur ${doc.doc_number}` }),
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function submitPayment(confirmDuplicate = false) {
    if (!payDoc) return;
    setError('');
    setDupWarning('');
    try {
      await apiFetch(`/commercial-documents/${payDoc.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ ...payForm, confirm_duplicate: confirmDuplicate }),
      });
      setPayDoc(null);
      await load();
    } catch (err: any) {
      if (err.status === 409 && err.data?.duplicate_warning) {
        setDupWarning(err.message);
      } else {
        setError(err.message);
      }
    }
  }

  async function reversePayment(paymentId: number) {
    try {
      await apiFetch(`/payments/${paymentId}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Erreur de saisie / chèque rejeté' }),
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const visibleDocs = docs.filter((d) => filterType === 'all' || d.doc_type === filterType);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Devis, Factures & Règlements"
        subtitle="Chaîne commerciale complète : Devis → Facture immuable → Avoir → Reçus de paiement"
        actions={
          canWrite && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" /> Nouvelle pièce commerciale
            </button>
          )
        }
      />

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="flex flex-wrap gap-1.5 text-xs">
        {[
          ['all', 'Toutes les pièces'],
          ['devis', 'Devis'],
          ['proforma', 'Proformas'],
          ['bon_livraison', 'Bons de livraison'],
          ['facture', 'Factures'],
          ['avoir', 'Avoirs'],
        ].map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilterType(k)}
            className={`px-3 py-1.5 rounded-lg border font-medium ${
              filterType === k
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3 text-left font-medium">N° Pièce</th>
                <th className="p-3 text-left font-medium">Client / Chantier</th>
                <th className="p-3 text-left font-medium">Date</th>
                <th className="p-3 text-right font-medium">Total HT</th>
                <th className="p-3 text-right font-medium">Total TTC</th>
                <th className="p-3 text-right font-medium">Encaissé</th>
                <th className="p-3 text-left font-medium">Statut</th>
                <th className="p-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleDocs.map((d) => {
                const remaining = Math.max(0, d.total_ttc - d.amount_paid);
                return (
                  <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">{d.doc_number}</div>
                      <div className="text-[11px] text-slate-500">{TYPE_LABELS[d.doc_type] || d.doc_type}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-900 dark:text-white">{d.client_name}</div>
                      <div className="text-[11px] text-slate-500">{d.project_title || 'Sans chantier'}</div>
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      <div>{formatDateFr(d.issue_date)}</div>
                      {d.due_date && <div className="text-slate-500">Éch. {formatDateFr(d.due_date)}</div>}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">{formatDA(d.total_ht)}</td>
                    <td className="p-3 text-right font-mono tabular-nums font-semibold">{formatDA(d.total_ttc)}</td>
                    <td className="p-3 text-right font-mono tabular-nums">
                      <div className="text-emerald-700 dark:text-emerald-400">{formatDA(d.amount_paid)}</div>
                      {d.doc_type === 'facture' && remaining > 0 && (
                        <div className="text-[11px] text-red-600">Reste {formatDA(remaining)}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <StatusText status={d.status} />
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setPrintDoc(d)}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Printer className="w-3 h-3" /> PDF
                      </button>
                      {canWrite && (d.doc_type === 'devis' || d.doc_type === 'proforma') && (
                        <button
                          type="button"
                          onClick={() => convertToInvoice(d.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-700 text-white rounded"
                        >
                          <ArrowRightLeft className="w-3 h-3" /> Facturer
                        </button>
                      )}
                      {canWrite && d.doc_type === 'facture' && remaining > 0 && d.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayDoc(d);
                            setDupWarning('');
                            setPayForm({ ...payForm, amount: remaining });
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-700 text-white rounded"
                        >
                          <CreditCard className="w-3 h-3" /> Encaisser
                        </button>
                      )}
                      {canApprove && d.doc_type === 'facture' && d.status !== 'draft' && (
                        <button
                          type="button"
                          onClick={() => createCreditNote(d)}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-red-300 text-red-700 rounded"
                        >
                          <FilePlus2 className="w-3 h-3" /> Avoir
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

      {/* Recent Payments & Reversals */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Journal des règlements &amp; contre-passations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="p-3 text-left">Reçu</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Tiers / Pièce</th>
                <th className="p-3 text-left">Mode</th>
                <th className="p-3 text-right">Montant</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 font-mono font-semibold">{p.receipt_number}</td>
                  <td className="p-3 font-mono">{formatDateFr(p.payment_date)}</td>
                  <td className="p-3">
                    {p.client_name || p.supplier_name} {p.doc_number ? `(${p.doc_number})` : ''}
                  </td>
                  <td className="p-3">{p.payment_method} {p.reference ? `· ${p.reference}` : ''}</td>
                  <td className={`p-3 text-right font-mono tabular-nums font-bold ${p.amount < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {formatDA(p.amount)}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap space-x-2">
                    <button type="button" onClick={() => setPrintPayment(p)} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                      <Printer className="w-3 h-3" /> Reçu PDF
                    </button>
                    {canApprove && !p.is_reversal && p.amount > 0 && (
                      <button
                        type="button"
                        onClick={() => reversePayment(p.id)}
                        className="inline-flex items-center gap-1 text-red-700 hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" /> Contre-passer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Commercial Doc Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Créer un document commercial" maxWidth="max-w-3xl">
        <form onSubmit={handleCreateDoc} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium mb-1">Type de document</label>
              <select
                value={form.doc_type}
                onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="devis">Devis</option>
                <option value="proforma">Facture Proforma</option>
                <option value="bon_livraison">Bon de livraison</option>
                <option value="facture">Facture directe</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Client *</label>
              <select
                required
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="">Sélectionner...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Chantier lié</label>
              <select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="">Aucun chantier</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Lignes de prestations / travaux</span>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    lines: [...form.lines, { description: '', unit: 'm²', quantity: 1, unit_price: 0, tva_rate: 19 }],
                  })
                }
                className="text-blue-700 font-medium"
              >
                + Ajouter une ligne
              </button>
            </div>
            {form.lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  required
                  placeholder="Désignation"
                  value={l.description}
                  onChange={(e) => {
                    const copy = [...form.lines];
                    copy[idx].description = e.target.value;
                    setForm({ ...form, lines: copy });
                  }}
                  className="col-span-5 px-2.5 py-1.5 border rounded bg-white dark:bg-slate-950"
                />
                <input
                  type="text"
                  placeholder="Unité"
                  value={l.unit}
                  onChange={(e) => {
                    const copy = [...form.lines];
                    copy[idx].unit = e.target.value;
                    setForm({ ...form, lines: copy });
                  }}
                  className="col-span-2 px-2 py-1.5 border rounded bg-white dark:bg-slate-950"
                />
                <input
                  type="number"
                  step="0.01"
                  value={l.quantity}
                  onChange={(e) => {
                    const copy = [...form.lines];
                    copy[idx].quantity = Number(e.target.value);
                    setForm({ ...form, lines: copy });
                  }}
                  className="col-span-2 px-2 py-1.5 border rounded bg-white dark:bg-slate-950 font-mono"
                />
                <input
                  type="number"
                  placeholder="P.U HT"
                  value={l.unit_price}
                  onChange={(e) => {
                    const copy = [...form.lines];
                    copy[idx].unit_price = Number(e.target.value);
                    setForm({ ...form, lines: copy });
                  }}
                  className="col-span-2 px-2 py-1.5 border rounded bg-white dark:bg-slate-950 font-mono"
                />
                <select
                  value={l.tva_rate}
                  onChange={(e) => {
                    const copy = [...form.lines];
                    copy[idx].tva_rate = Number(e.target.value);
                    setForm({ ...form, lines: copy });
                  }}
                  className="col-span-1 px-1 py-1.5 border rounded bg-white dark:bg-slate-950 font-mono"
                >
                  <option value={19}>19%</option>
                  <option value={9}>9%</option>
                  <option value={0}>0%</option>
                </select>
              </div>
            ))}
          </div>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.issue_immediately}
              onChange={(e) => setForm({ ...form, issue_immediately: e.target.checked })}
            />
            Émettre et verrouiller immédiatement le document
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg font-medium">Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal open={!!payDoc} onClose={() => setPayDoc(null)} title={payDoc ? `Encaisser — ${payDoc.doc_number}` : ''} maxWidth="max-w-md">
        {payDoc && (
          <div className="space-y-3 text-xs">
            <div>
              Solde restant dû : <span className="font-mono font-bold text-red-700">{formatDA(payDoc.total_ttc - payDoc.amount_paid)}</span>
            </div>
            <div>
              <label className="block font-medium mb-1">Montant encaissé (DA)</label>
              <input
                type="number"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={payForm.payment_date}
                  onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Mode de paiement</label>
                <select
                  value={payForm.payment_method}
                  onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Virement">Virement</option>
                  <option value="Chèque">Chèque</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-medium mb-1">Référence chèque / virement</label>
              <input
                type="text"
                value={payForm.reference}
                onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>

            {dupWarning && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 space-y-2">
                <div>{dupWarning}</div>
                <button
                  type="button"
                  onClick={() => submitPayment(true)}
                  className="px-3 py-1.5 bg-amber-700 text-white rounded font-medium"
                >
                  Confirmer malgré le doublon
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPayDoc(null)} className="px-3 py-2 border rounded-lg">Annuler</button>
              <button type="button" onClick={() => submitPayment(false)} className="px-4 py-2 text-white bg-emerald-700 rounded-lg font-medium">
                Valider l’encaissement
              </button>
            </div>
          </div>
        )}
      </Modal>

      <CommercialPrintModal doc={printDoc} company={company} onClose={() => setPrintDoc(null)} />
      <PaymentReceiptPrintModal payment={printPayment} company={company} onClose={() => setPrintPayment(null)} />
    </div>
  );
}
