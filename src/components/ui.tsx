import React, { useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MinusCircle,
  Printer,
  X,
} from 'lucide-react';
import { formatDA, formatDateFr } from '../lib/api';

const STATUS_MAP: Record<string, { label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'neutral' }> = {
  active: { label: 'Actif', tone: 'green' },
  inactive: { label: 'Inactif', tone: 'neutral' },
  blocked: { label: 'Bloqué', tone: 'red' },
  draft: { label: 'Brouillon', tone: 'neutral' },
  waiting_approval: { label: 'En attente', tone: 'amber' },
  in_progress: { label: 'En cours', tone: 'blue' },
  suspended: { label: 'Suspendu', tone: 'amber' },
  completed: { label: 'Terminé', tone: 'green' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
  planned: { label: 'Planifié', tone: 'neutral' },
  delayed: { label: 'En retard', tone: 'red' },
  pending: { label: 'En attente', tone: 'amber' },
  approved: { label: 'Validé', tone: 'green' },
  rejected: { label: 'Refusé', tone: 'red' },
  issued: { label: 'Émise', tone: 'blue' },
  accepted: { label: 'Accepté', tone: 'green' },
  partial: { label: 'Partiel', tone: 'amber' },
  partial_paid: { label: 'Partiellement payé', tone: 'amber' },
  paid: { label: 'Payée', tone: 'green' },
  overdue: { label: 'En retard', tone: 'red' },
  present: { label: 'Présent', tone: 'green' },
  half_day: { label: 'Demi-journée (0,5 j)', tone: 'amber' },
  absent: { label: 'Absent', tone: 'red' },
  paid_leave: { label: 'Congé payé', tone: 'blue' },
  unpaid_leave: { label: 'Congé sans solde', tone: 'neutral' },
  sick_leave: { label: 'Maladie', tone: 'amber' },
  available: { label: 'Disponible', tone: 'green' },
  on_project: { label: 'Sur chantier', tone: 'blue' },
  under_maintenance: { label: 'En maintenance', tone: 'amber' },
  broken_down: { label: 'En panne', tone: 'red' },
  assigned: { label: 'Affecté', tone: 'blue' },
  under_repair: { label: 'En réparation', tone: 'amber' },
  lost: { label: 'Perdu', tone: 'red' },
  waiting: { label: 'En attente', tone: 'amber' },
  ordered: { label: 'Commandé', tone: 'blue' },
  received: { label: 'Réceptionné', tone: 'green' },
  on_leave: { label: 'En congé', tone: 'blue' },
  terminated: { label: 'Sorti', tone: 'neutral' },
};

export function StatusText({ status, label }: { status: string; label?: string }) {
  const meta = STATUS_MAP[status] || { label: status, tone: 'neutral' as const };
  const text = label || meta.label;
  const cls = {
    green: 'text-emerald-700 dark:text-emerald-400',
    blue: 'text-blue-700 dark:text-blue-400',
    amber: 'text-amber-700 dark:text-amber-400',
    red: 'text-red-700 dark:text-red-400',
    neutral: 'text-slate-600 dark:text-slate-400',
  }[meta.tone];

  const Icon = {
    green: CheckCircle2,
    blue: Clock,
    amber: AlertTriangle,
    red: AlertCircle,
    neutral: MinusCircle,
  }[meta.tone];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${cls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
      <div>
        <h1 className="text-xl font-bold tracking-tight font-display text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function EmptyState({ message, hint, action }: { message: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div role="status" className="py-12 px-4 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
      <div className="font-medium text-slate-700 dark:text-slate-200">{message}</div>
      {hint && <div className="mt-1.5 text-[11px] text-slate-500">{hint}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  maxWidth = 'max-w-2xl',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px] no-print" role="presentation">
      <div
        role="dialog" aria-modal="true" aria-label={title} className={`w-full ${maxWidth} max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden`}
      >
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-md">
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg ${
            danger ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-700 hover:bg-blue-800'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

const DOC_TYPE_TITLES: Record<string, string> = {
  devis: 'DEVIS ESTIMATIF',
  proforma: 'FACTURE PROFORMA',
  bon_livraison: 'BON DE LIVRAISON',
  facture: 'FACTURE',
  avoir: 'FACTURE D’AVOIR',
};

export function CommercialPrintModal({
  doc,
  company,
  onClose,
}: {
  doc: any | null;
  company: any | null;
  onClose: () => void;
}) {
  if (!doc) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden print-area">
        <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between no-print">
          <span className="text-xs font-semibold text-slate-700">Aperçu avant impression A4 — {doc.doc_number}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer / Enregistrer PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-white"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6 text-xs">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div className="space-y-1">
              {company?.logo_data && <img src={company.logo_data} alt="Logo de l’entreprise" className="max-h-16 max-w-40 object-contain mb-2" />}
              <div className="text-lg font-bold tracking-tight uppercase">{company?.name || 'Mon entreprise'} ({company?.legal_form || 'Entreprise'})</div>
              <div className="text-slate-600">{company?.header_note}</div>
              <div>{company?.address}</div>
              <div>Tél : {company?.phone} · Email : {company?.email}</div>
              <div className="pt-1 font-mono text-[11px] text-slate-700">
                NIF : {company?.nif || '—'} · NIS : {company?.nis || '—'} · RC : {company?.rc || '—'} · AI : {company?.ai || '—'}
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-base font-bold text-blue-800">{DOC_TYPE_TITLES[doc.doc_type] || 'DOCUMENT'}</div>
              <div className="font-mono font-bold text-sm">{doc.doc_number}</div>
              <div>Date : {formatDateFr(doc.issue_date)}</div>
              {doc.due_date && <div>Échéance : {formatDateFr(doc.due_date)}</div>}
            </div>
          </div>

          {/* Client Box */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-500">Client / Maître d’ouvrage</div>
              <div className="font-bold text-sm mt-1">{doc.client_name}</div>
              {doc.client_address && <div className="text-slate-600">{doc.client_address}</div>}
              {doc.client_phone && <div className="text-slate-600">Tél : {doc.client_phone}</div>}
            </div>
            <div className="text-right font-mono text-[11px] space-y-0.5 text-slate-700">
              {doc.client_nif && <div>NIF : {doc.client_nif}</div>}
              {doc.client_nis && <div>NIS : {doc.client_nis}</div>}
              {doc.client_rc && <div>RC : {doc.client_rc}</div>}
              {doc.client_ai && <div>AI : {doc.client_ai}</div>}
              {doc.project_title && <div className="font-sans text-xs font-medium text-slate-800 pt-1">Chantier : {doc.project_title}</div>}
            </div>
          </div>

          {/* Lines Table */}
          <table className="w-full border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="p-2 border border-slate-300">Désignation des prestations / travaux</th>
                <th className="p-2 border border-slate-300 text-center w-16">Unité</th>
                <th className="p-2 border border-slate-300 text-right w-20">Qté</th>
                <th className="p-2 border border-slate-300 text-right w-28">P.U. HT</th>
                <th className="p-2 border border-slate-300 text-right w-16">TVA</th>
                <th className="p-2 border border-slate-300 text-right w-32">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {(doc.lines || []).map((l: any, idx: number) => (
                <tr key={idx}>
                  <td className="p-2 border border-slate-300">{l.description}</td>
                  <td className="p-2 border border-slate-300 text-center">{l.unit}</td>
                  <td className="p-2 border border-slate-300 text-right font-mono tabular-nums">{l.quantity}</td>
                  <td className="p-2 border border-slate-300 text-right font-mono tabular-nums">{formatDA(l.unit_price, 2)}</td>
                  <td className="p-2 border border-slate-300 text-right font-mono tabular-nums">{l.tva_rate}%</td>
                  <td className="p-2 border border-slate-300 text-right font-mono tabular-nums font-medium">{formatDA(l.line_ht, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & Amount in words */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-2">
            <div className="flex-1 space-y-2">
              <div className="font-semibold">Arrêté le présent document à la somme de :</div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded font-medium italic">
                {doc.amount_in_words}
              </div>
              {doc.notes && <div className="text-slate-600">Observations : {doc.notes}</div>}
            </div>
            <div className="w-72 border border-slate-300 rounded overflow-hidden">
              <div className="flex justify-between p-2 border-b border-slate-200">
                <span>Total HT</span>
                <span className="font-mono tabular-nums font-medium">{formatDA(doc.total_ht, 2)}</span>
              </div>
              <div className="flex justify-between p-2 border-b border-slate-200">
                <span>Total TVA</span>
                <span className="font-mono tabular-nums">{formatDA(doc.total_tva, 2)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-900 text-white font-bold text-sm">
                <span>TOTAL TTC</span>
                <span className="font-mono tabular-nums">{formatDA(doc.total_ttc, 2)}</span>
              </div>
            </div>
          </div>

          <div className="pt-8 flex justify-between items-end border-t border-slate-200">
            <div className="text-[11px] text-slate-500 max-w-md">{company?.footer_note}</div>
            <div className="text-center w-56">
              {company?.stamp_data && <img src={company.stamp_data} alt="Cachet de l’entreprise" className="max-h-20 max-w-40 object-contain mx-auto mb-2" />}
              <div className="font-semibold mb-12">Cachet & Signature</div>
              <div className="border-t border-slate-400 pt-1 text-[11px] text-slate-500">La Direction</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PaymentReceiptPrintModal({
  payment,
  company,
  onClose,
}: {
  payment: any | null;
  company: any | null;
  onClose: () => void;
}) {
  if (!payment) return null;
  const isInflow = payment.direction === 'inflow' || Boolean(payment.client_id);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden print-area">
        <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between no-print">
          <span className="text-xs font-semibold">Aperçu du reçu — {payment.receipt_number}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg"><Printer className="w-3.5 h-3.5" /> Imprimer / PDF</button>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg">Fermer</button>
          </div>
        </div>
        <div className="p-8 space-y-6 text-xs">
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div className="space-y-1">
              {company?.logo_data && <img src={company.logo_data} alt="Logo de l’entreprise" className="max-h-16 max-w-40 object-contain mb-2" />}
              <div className="text-lg font-bold uppercase">{company?.name || 'Mon entreprise'}</div>
              <div>{company?.address}</div><div>Tél : {company?.phone} · {company?.email}</div>
              <div className="font-mono text-[11px]">NIF : {company?.nif || '—'} · RC : {company?.rc || '—'}</div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-base font-bold text-blue-800">REÇU DE {isInflow ? 'PAIEMENT' : 'RÈGLEMENT'}</div>
              <div className="font-mono text-sm font-bold">{payment.receipt_number}</div>
              <div>Date : {formatDateFr(payment.payment_date)}</div>
              {payment.is_reversal ? <div className="font-bold text-red-700">CONTRE-PASSATION</div> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div><div className="text-[11px] uppercase text-slate-500">{isInflow ? 'Reçu de' : 'Versé à'}</div><div className="font-bold text-sm mt-1">{payment.client_name || payment.supplier_name || 'Tiers non renseigné'}</div></div>
            <div className="text-right"><div className="text-[11px] uppercase text-slate-500">Pièce liée</div><div className="font-mono font-semibold mt-1">{payment.doc_number || payment.purchase_number || '—'}</div></div>
          </div>
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <div className="flex justify-between p-3 border-b border-slate-200"><span>Mode de paiement</span><strong>{payment.payment_method}</strong></div>
            <div className="flex justify-between p-3 border-b border-slate-200"><span>Référence</span><span className="font-mono">{payment.reference || '—'}</span></div>
            <div className="flex justify-between p-4 bg-slate-900 text-white text-sm font-bold"><span>Montant {isInflow ? 'reçu' : 'versé'}</span><span className="font-mono">{formatDA(Math.abs(Number(payment.amount || 0)), 2)}</span></div>
          </div>
          {payment.notes && <div><strong>Observations :</strong> {payment.notes}</div>}
          <div className="pt-8 flex justify-between items-end border-t border-slate-200">
            <div className="text-[11px] text-slate-500">{company?.footer_note}</div>
            <div className="text-center w-56">
              {company?.stamp_data && <img src={company.stamp_data} alt="Cachet de l’entreprise" className="max-h-20 max-w-40 object-contain mx-auto mb-2" />}
              <div className="font-semibold mb-12">Cachet & Signature</div>
              <div className="border-t border-slate-400 pt-1 text-[11px] text-slate-500">La Direction</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PayslipPrintModal({
  slip,
  period,
  company,
  onClose,
}: {
  slip: any | null;
  period: any | null;
  company: any | null;
  onClose: () => void;
}) {
  if (!slip || !period) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden print-area">
        <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between no-print">
          <span className="text-xs font-semibold">Bulletin de paie — {slip.full_name}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer PDF
            </button>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg">
              Fermer
            </button>
          </div>
        </div>
        <div className="p-8 space-y-5 text-xs">
          <div className="flex justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <div className="font-bold text-base">{company?.name || 'Bâti-Tichy & Services'}</div>
              <div>{company?.address}</div>
              <div className="font-mono text-[11px]">NIF : {company?.nif} · RC : {company?.rc}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-base text-blue-800">BULLETIN DE PAIE</div>
              <div className="font-mono font-semibold">Période : {String(period.month).padStart(2, '0')}/{period.year}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded p-3">
            <div>
              <div><span className="text-slate-500">Salarié :</span> <strong>{slip.full_name}</strong></div>
              <div><span className="text-slate-500">Poste :</span> {slip.job_title}</div>
            </div>
            <div className="text-right">
              <div><span className="text-slate-500">N° CNAS :</span> <span className="font-mono">{slip.cnas_number || '—'}</span></div>
              <div><span className="text-slate-500">Jours travaillés :</span> <span className="font-mono">{slip.worked_days} j</span></div>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2 border border-slate-300 text-left">Rubrique</th>
                <th className="p-2 border border-slate-300 text-right">Gains (DA)</th>
                <th className="p-2 border border-slate-300 text-right">Retenues (DA)</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              <tr>
                <td className="p-2 border border-slate-300 font-sans">Salaire de base ({slip.worked_days} jours)</td>
                <td className="p-2 border border-slate-300 text-right">{formatDA(slip.base_gross)}</td>
                <td className="p-2 border border-slate-300 text-right">—</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-sans">Heures supplémentaires ({slip.overtime_hours} h)</td>
                <td className="p-2 border border-slate-300 text-right">{formatDA(slip.overtime_pay)}</td>
                <td className="p-2 border border-slate-300 text-right">—</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-sans">Primes & indemnités</td>
                <td className="p-2 border border-slate-300 text-right">{formatDA(slip.bonus_amount + slip.piecework_amount)}</td>
                <td className="p-2 border border-slate-300 text-right">—</td>
              </tr>
              <tr className="bg-slate-50 font-semibold">
                <td className="p-2 border border-slate-300 font-sans">Salaire Brut Imposable</td>
                <td className="p-2 border border-slate-300 text-right">{formatDA(slip.gross_salary)}</td>
                <td className="p-2 border border-slate-300 text-right">—</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-sans">Retenue CNAS Part Salarié (9%)</td>
                <td className="p-2 border border-slate-300 text-right">—</td>
                <td className="p-2 border border-slate-300 text-right">{formatDA(slip.cnas_employee)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-sans">IRG Salaires (Barème Algérie)</td>
                <td className="p-2 border border-slate-300 text-right">—</td>
                <td className="p-2 border border-slate-300 text-right">{formatDA(slip.irg_amount)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-sans">Avances & acomptes déduits</td>
                <td className="p-2 border border-slate-300 text-right">—</td>
                <td className="p-2 border border-slate-300 text-right">{formatDA(slip.advances_deducted)}</td>
              </tr>
              {(slip.penalties_deducted > 0 || slip.other_deductions > 0) && (
                <tr>
                  <td className="p-2 border border-slate-300 font-sans">Autres retenues / pénalités</td>
                  <td className="p-2 border border-slate-300 text-right">—</td>
                  <td className="p-2 border border-slate-300 text-right">{formatDA(slip.penalties_deducted + slip.other_deductions)}</td>
                </tr>
              )}
              <tr className="bg-slate-900 text-white font-bold text-sm">
                <td className="p-2.5 border border-slate-900 font-sans">NET À PAYER</td>
                <td colSpan={2} className="p-2.5 border border-slate-900 text-right">{formatDA(slip.net_pay)}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-between text-[11px] text-slate-600 pt-2">
            <div>Charge patronale CNAS (26% — info employeur) : <span className="font-mono">{formatDA(slip.cnas_employer)}</span></div>
            <div className="text-right">Signature salarié &amp; cachet entreprise</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  subtext,
  tone = 'default',
  onClick,
  compact = false,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  tone?: 'default' | 'green' | 'amber' | 'red' | 'blue';
  onClick?: () => void;
  compact?: boolean;
}) {
  const cls = {
    default: 'text-slate-900 dark:text-white',
    green: 'text-emerald-700 dark:text-emerald-400',
    amber: 'text-amber-700 dark:text-amber-400',
    red: 'text-red-700 dark:text-red-400',
    blue: 'text-blue-700 dark:text-blue-400',
  }[tone];

  const className = `text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl ${compact ? 'p-3' : 'p-4'} ${onClick ? 'hover:border-blue-400 dark:hover:border-blue-600 transition-colors' : ''}`;
  const content = (
    <>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{label}</div>
      <div className={`mt-1.5 text-lg font-bold font-mono tabular-nums tracking-tight ${cls}`}>{value}</div>
      {subtext && <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtext}</div>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
