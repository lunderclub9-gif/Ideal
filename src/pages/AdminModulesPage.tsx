import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FolderUp, HardDrive, Printer, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import { apiFetch, downloadWithAuth, formatDA, formatDateFr, getToken, hasPerm } from '../lib/api';
import { PageHeader, StatusText } from '../components/ui';

export function TaxesPage({ permissions }: { permissions: string[] }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const canWrite = hasPerm(permissions, 'taxes:write');

  async function load() {
    try {
      setData(await apiFetch('/taxes/summary'));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function updateRate(id: number, rate: number) {
    try {
      await apiFetch(`/taxes/rules/${id}`, { method: 'PUT', body: JSON.stringify({ rate }) });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!data) return <div className="p-6 text-xs text-slate-500">Chargement fiscalité algérienne...</div>;
  const ind = data.indicators;

  return (
    <div className="space-y-5">
      <PageHeader title="Comptabilité & Impôts (Algérie)" subtitle="Synthèse TVA collectée / déductible, CNAS, IRG Salaires, TAP et IBS configurables" />
      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-slate-500">TVA Collectée (Ventes)</div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1">{formatDA(ind.tva_collectee)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-slate-500">TVA Déductible (Achats)</div>
          <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-1">{formatDA(ind.tva_deductible)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-slate-500">TVA Nette à payer (G50)</div>
          <div className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-1">{formatDA(ind.tva_a_payer)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-slate-500">CNAS + IRG Paie cumulés</div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1">{formatDA(ind.cnas_total + ind.irg_salaires)}</div>
          <div className="text-[11px] text-slate-500">CNAS {formatDA(ind.cnas_total)} · IRG {formatDA(ind.irg_salaires)}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">
          Paramètres fiscaux &amp; cotisations configurables
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Libellé</th>
              <th className="p-3 text-right">Taux (%)</th>
              <th className="p-3 text-left">Effet</th>
              <th className="p-3 text-left">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.rules.map((r: any) => (
              <tr key={r.id}>
                <td className="p-3 font-mono font-semibold">{r.code}</td>
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 text-right font-mono">
                  {canWrite && r.code !== 'IRG_BAREME' ? (
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={r.rate}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== r.rate) updateRate(r.id, v);
                      }}
                      className="w-20 px-2 py-1 border rounded text-right bg-white dark:bg-slate-950"
                    />
                  ) : (
                    `${r.rate}%`
                  )}
                </td>
                <td className="p-3 font-mono">{formatDateFr(r.effective_date)}</td>
                <td className="p-3 text-slate-500">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DocumentsPage({ permissions }: { permissions: string[] }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('projects');
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [relatedType, setRelatedType] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const canWrite = hasPerm(permissions, 'documents:write');
  const canArchive = hasPerm(permissions, 'documents:delete');

  async function load() {
    try {
      const [d, c, p, s, w] = await Promise.all([
        apiFetch('/documents'), apiFetch('/clients').catch(() => []), apiFetch('/projects').catch(() => []),
        apiFetch('/suppliers').catch(() => []), apiFetch('/workers').catch(() => []),
      ]);
      setDocs(d); setClients(c); setProjects(p); setSuppliers(s); setWorkers(w);
    } catch (e: any) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  const relatedOptions = relatedType === 'client' ? clients
    : relatedType === 'project' ? projects
    : relatedType === 'supplier' ? suppliers
    : relatedType === 'worker' ? workers : [];
  const editingRelatedOptions = editing?.related_type === 'client' ? clients
    : editing?.related_type === 'project' ? projects
    : editing?.related_type === 'supplier' ? suppliers
    : editing?.related_type === 'worker' ? workers : [];
  const relatedLabel = (item: any) => item.name || item.title || item.full_name || item.project_number || String(item.id);
  const getRelatedName = (doc: any) => {
    const source = doc.related_type === 'client' ? clients : doc.related_type === 'project' ? projects : doc.related_type === 'supplier' ? suppliers : workers;
    const item = source.find((entry: any) => Number(entry.id) === Number(doc.related_id));
    return item ? relatedLabel(item) : (doc.related_type ? `${doc.related_type} #${doc.related_id}` : 'Non associé');
  };
  const visibleDocs = docs.filter((d) => {
    const q = search.trim().toLowerCase();
    return !q || [d.title, d.file_name, d.category, d.notes, d.related_type].some((v) => String(v || '').toLowerCase().includes(q));
  });

  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setError(''); setMessage('');
    const fd = new FormData();
    fd.append('title', title.trim()); fd.append('category', category);
    fd.append('doc_date', docDate); fd.append('related_type', relatedType);
    fd.append('related_id', relatedId); fd.append('notes', notes); fd.append('file', file);
    try {
      const res = await fetch('/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Échec du dépôt du document.');
      setTitle(''); setFile(null); setNotes(''); setRelatedType(''); setRelatedId('');
      setDocDate(new Date().toISOString().slice(0, 10));
      setMessage('Document archivé et associé avec succès.'); await load();
    } catch (err: any) { setError(err.message); }
  }

  async function saveMetadata(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await apiFetch(`/documents/${editing.id}`, { method: 'PUT', body: JSON.stringify(editing) });
      setEditing(null); setMessage('Informations du document mises à jour.'); await load();
    } catch (err: any) { setError(err.message); }
  }

  async function archiveDoc(id: number) {
    if (!window.confirm('Archiver ce document ? Le fichier restera conservé sur le disque.')) return;
    try {
      await apiFetch(`/documents/${id}`, { method: 'DELETE' });
      setMessage('Document archivé sans supprimer le fichier.'); await load();
    } catch (err: any) { setError(err.message); }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Centre de documents & pièces jointes" subtitle="Classement local, liaison aux clients, chantiers, fournisseurs et salariés, avec historique conservé" actions={<button type="button" onClick={() => downloadWithAuth('/documents/export/xlsx', 'registre_documents_gestionpro.xlsx')} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg"><FileSpreadsheet className="w-3.5 h-3.5" /> Exporter le registre</button>} />
      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}
      {message && <div className="p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">{message}</div>}

      {canWrite && (
        <form onSubmit={uploadDoc} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 text-xs">
          <div className="font-semibold text-sm">Ajouter une pièce jointe</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><label className="block font-medium mb-1">Intitulé *</label><input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" placeholder="Contrat, plan, facture fournisseur..." /></div>
            <div><label className="block font-medium mb-1">Catégorie</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option value="projects">Chantiers / Plans</option><option value="contracts">Contrats</option><option value="invoices">Factures</option><option value="vehicles">Véhicules</option><option value="payroll">Paie / RH</option><option value="suppliers">Fournisseurs / Achats</option><option value="clients">Clients</option><option value="general">Général</option></select></div>
            <div><label className="block font-medium mb-1">Date du document</label><input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
            <div><label className="block font-medium mb-1">Lier à une fiche</label><select value={relatedType} onChange={(e) => { setRelatedType(e.target.value); setRelatedId(''); }} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option value="">Aucun lien</option><option value="client">Client</option><option value="project">Chantier</option><option value="supplier">Fournisseur</option><option value="worker">Salarié</option></select></div>
            {relatedType && <div><label className="block font-medium mb-1">Fiche associée</label><select required value={relatedId} onChange={(e) => setRelatedId(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option value="">Sélectionner...</option>{relatedOptions.map((item: any) => <option key={item.id} value={item.id}>{relatedLabel(item)}</option>)}</select></div>}
            <div><label className="block font-medium mb-1">Fichier (max. 50 Mo)</label><input type="file" required onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-xs" /></div>
            <div className="sm:col-span-2"><label className="block font-medium mb-1">Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" placeholder="Description ou référence complémentaire" /></div>
          </div>
          <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 text-white bg-blue-700 rounded-lg font-medium"><FolderUp className="w-3.5 h-3.5" /> Archiver localement</button>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par titre, fichier, catégorie ou note..." className="w-full sm:max-w-md px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-900" />
        <span className="text-xs text-slate-500">{visibleDocs.length} document(s)</span>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className="p-3 text-left">Document</th><th className="p-3 text-left">Catégorie / Liaison</th><th className="p-3 text-left">Date</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleDocs.map((d) => <tr key={d.id}>
              <td className="p-3"><div className="font-semibold">{d.title}</div><div className="font-mono text-[11px] text-slate-500">{d.file_name} · {(Number(d.file_size || 0) / 1024).toFixed(1)} Ko</div>{d.notes && <div className="text-[11px] text-slate-500 mt-1">{d.notes}</div>}</td>
              <td className="p-3"><div>{d.category}</div><div className="text-[11px] text-slate-500">{getRelatedName(d)}</div></td>
              <td className="p-3 font-mono">{formatDateFr(d.doc_date)}</td>
              <td className="p-3 text-right whitespace-nowrap space-x-3">
                <button type="button" onClick={() => downloadWithAuth(`/documents/${d.id}/download`, d.file_name)} className="inline-flex items-center gap-1 text-blue-700 hover:underline"><Download className="w-3.5 h-3.5" /> Télécharger</button>
                {canWrite && <button type="button" onClick={() => setEditing({ id: d.id, title: d.title, category: d.category, doc_date: d.doc_date, related_type: d.related_type || '', related_id: d.related_id || '', notes: d.notes || '' })} className="inline-flex items-center gap-1 text-slate-600 hover:underline"><FileSpreadsheet className="w-3.5 h-3.5" /> Modifier</button>}
                {canArchive && <button type="button" onClick={() => archiveDoc(d.id)} className="text-red-700 hover:underline">Archiver</button>}
              </td>
            </tr>)}
            {visibleDocs.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">Aucun document correspondant.</td></tr>}
          </tbody>
        </table></div>
      </div>

      {editing && <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"><form onSubmit={saveMetadata} className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl p-5 space-y-3 text-xs"><div className="flex justify-between items-center"><h2 className="font-semibold text-sm">Modifier les informations</h2><button type="button" onClick={() => setEditing(null)} className="text-slate-500">Fermer</button></div>
        <label className="block">Intitulé<input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></label>
        <div className="grid grid-cols-2 gap-3"><label>Catégorie<select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option value="projects">Chantiers</option><option value="contracts">Contrats</option><option value="invoices">Factures</option><option value="vehicles">Véhicules</option><option value="payroll">Paie</option><option value="suppliers">Fournisseurs</option><option value="clients">Clients</option><option value="general">Général</option></select></label><label>Date<input type="date" value={editing.doc_date} onChange={(e) => setEditing({ ...editing, doc_date: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></label></div>
        <div className="grid grid-cols-2 gap-3"><label>Type de fiche<select value={editing.related_type} onChange={(e) => setEditing({ ...editing, related_type: e.target.value, related_id: '' })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option value="">Aucun lien</option><option value="client">Client</option><option value="project">Chantier</option><option value="supplier">Fournisseur</option><option value="worker">Salarié</option></select></label>{editing.related_type && <label>Fiche<select required value={editing.related_id} onChange={(e) => setEditing({ ...editing, related_id: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option value="">Sélectionner...</option>{editingRelatedOptions.map((item: any) => <option key={item.id} value={item.id}>{relatedLabel(item)}</option>)}</select></label>}</div>
        <label className="block">Notes<textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} maxLength={1000} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="px-3 py-2 border rounded-lg">Annuler</button><button className="px-4 py-2 bg-blue-700 text-white rounded-lg">Enregistrer</button></div>
      </form></div>}
    </div>
  );
}

export function ReportsPage({ permissions }: { permissions: string[] }) {
  const canExport = hasPerm(permissions, 'reports:export');
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    apiFetch('/reports/summary').then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6 text-xs text-slate-500">Génération des rapports...</div>;

  return (
    <div className="space-y-5 print-area print-container">
      <PageHeader
        title="Rapports de gestion & Rentabilité"
        subtitle="Synthèse des chantiers, de la main-d’œuvre, du parc, des factures et des règlements"
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg">
              <Printer className="w-3.5 h-3.5" /> Imprimer / PDF
            </button>
            {canExport && <button type="button" onClick={() => downloadWithAuth('/reports/export/xlsx', 'rapport_complet_gestionpro_dz.xlsx')} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Classeur Excel complet
            </button>}
          </div>
        }
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden print-sheet">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">Rentabilité réelle par chantier</div>
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className="p-3 text-left">Chantier</th><th className="p-3 text-left">Statut</th><th className="p-3 text-right">Facturé HT</th><th className="p-3 text-right">Coût réel total</th><th className="p-3 text-right">Bénéfice net</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.projectProfits.map((p: any) => <tr key={p.project_number}>
              <td className="p-3"><span className="font-mono font-semibold mr-2">{p.project_number}</span>{p.title}</td><td className="p-3"><StatusText status={p.status} /></td>
              <td className="p-3 text-right font-mono tabular-nums">{formatDA(p.invoiced_ht)}</td><td className="p-3 text-right font-mono tabular-nums">{formatDA(p.total_actual_cost)}</td>
              <td className={`p-3 text-right font-mono tabular-nums font-bold ${p.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatDA(p.net_profit)}</td>
            </tr>)}
          </tbody>
        </table></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden print-sheet">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">Activité de la main-d’œuvre</div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className="p-3 text-left">Salarié</th><th className="p-3 text-left">Poste</th><th className="p-3 text-right">Jours approuvés</th><th className="p-3 text-right">Avances</th></tr></thead><tbody>
            {(data.workerCosts || []).map((w: any, i: number) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-medium">{w.full_name}</td><td className="p-3">{w.job_title}</td><td className="p-3 text-right font-mono">{Number(w.total_days || 0).toFixed(2)}</td><td className="p-3 text-right font-mono">{formatDA(w.total_advances)}</td></tr>)}
          </tbody></table></div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden print-sheet">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">Coûts du parc véhicules</div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className="p-3 text-left">Véhicule</th><th className="p-3 text-left">Immatriculation</th><th className="p-3 text-right">Carburant</th><th className="p-3 text-right">Réparations</th></tr></thead><tbody>
            {(data.fleetCosts || []).map((v: any, i: number) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-medium">{v.name}</td><td className="p-3 font-mono">{v.registration || '—'}</td><td className="p-3 text-right font-mono">{formatDA(v.fuel_cost)}</td><td className="p-3 text-right font-mono">{formatDA(v.repair_cost)}</td></tr>)}
          </tbody></table></div>
        </div>
      </div>
      <div className="text-[11px] text-slate-500">Document interne de gestion — les montants sont calculés à partir des mouvements et pièces enregistrés dans GestionPro DZ.</div>
    </div>
  );}

export function SettingsPage({ permissions }: { permissions: string[] }) {
  const [company, setCompany] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [tab, setTab] = useState<'company' | 'users' | 'import' | 'audit'>('company');
  const [importTarget, setImportTarget] = useState('clients');
  const [preview, setPreview] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const canWrite = hasPerm(permissions, 'settings:write');

  async function load() {
    const [s, u, l] = await Promise.all([
      apiFetch('/settings'),
      apiFetch('/users'),
      hasPerm(permissions, 'audit:read') ? apiFetch('/audit-logs') : Promise.resolve([]),
    ]);
    setCompany(s);
    setUsers(u);
    setLogs(l);
  }
  useEffect(() => {
    load();
  }, []);

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(company) });
    setMsg('Paramètres de l’entreprise enregistrés.');
  }

  async function previewFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    setPreview(await res.json());
  }

  async function commitImport() {
    if (!preview) return;
    const res = await apiFetch('/import/commit', {
      method: 'POST',
      body: JSON.stringify({ target: importTarget, rows: preview.rows }),
    });
    setMsg(`${res.imported} ligne(s) importée(s). ${res.errors.length} erreur(s).`);
    setPreview(null);
  }

  if (!company) return <div className="p-6 text-xs">Chargement...</div>;

  return (
    <div className="space-y-5">
      <PageHeader title="Paramètres, Utilisateurs, Import Excel & Audit" subtitle="Configuration de la société algérienne, droits d’accès et traçabilité immuable" />
      {msg && <div className="p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">{msg}</div>}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 text-xs">
        {[
          ['company', 'Entreprise & Fiscalité'],
          ['users', 'Utilisateurs & Rôles'],
          ['import', 'Importation Excel / CSV'],
          ['audit', 'Journal d’audit'],
        ].map(([k, lbl]) => (
          <button key={k} type="button" onClick={() => setTab(k as any)} className={`px-4 py-2 font-medium border-b-2 ${tab === k ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <form onSubmit={saveCompany} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 text-xs max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Raison sociale</label>
              <input type="text" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">Forme juridique</label>
              <input type="text" value={company.legal_form} onChange={(e) => setCompany({ ...company, legal_form: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">NIF</label>
              <input type="text" value={company.nif} onChange={(e) => setCompany({ ...company, nif: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">NIS</label>
              <input type="text" value={company.nis} onChange={(e) => setCompany({ ...company, nis: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">RC</label>
              <input type="text" value={company.rc} onChange={(e) => setCompany({ ...company, rc: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">Article d’imposition (AI)</label>
              <input type="text" value={company.ai} onChange={(e) => setCompany({ ...company, ai: e.target.value })} className="w-full px-3 py-2 border rounded-lg font-mono bg-white dark:bg-slate-950" />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Adresse complète</label>
              <input type="text" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">Téléphone</label>
              <input type="tel" value={company.phone || ''} onChange={(e) => setCompany({ ...company, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">E-mail</label>
              <input type="email" value={company.email || ''} onChange={(e) => setCompany({ ...company, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </div>
            <div>
              <label className="block font-medium mb-1">Logo de l’entreprise (PNG, JPG, WebP — 1,5 Mo max.)</label>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1.5 * 1024 * 1024) { setMsg('Le logo dépasse 1,5 Mo.'); return; }
                const reader = new FileReader();
                reader.onload = () => setCompany({ ...company, logo_data: String(reader.result || '') });
                reader.readAsDataURL(file);
              }} className="w-full text-xs" />
              {company.logo_data && <div className="mt-2 flex items-center gap-3"><img src={company.logo_data} alt="Aperçu du logo" className="max-h-12 max-w-32 object-contain" /><button type="button" onClick={() => setCompany({ ...company, logo_data: '' })} className="text-red-700">Retirer</button></div>}
            </div>
            <div>
              <label className="block font-medium mb-1">Cachet de l’entreprise (PNG, JPG, WebP — 1,5 Mo max.)</label>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1.5 * 1024 * 1024) { setMsg('Le cachet dépasse 1,5 Mo.'); return; }
                const reader = new FileReader();
                reader.onload = () => setCompany({ ...company, stamp_data: String(reader.result || '') });
                reader.readAsDataURL(file);
              }} className="w-full text-xs" />
              {company.stamp_data && <div className="mt-2 flex items-center gap-3"><img src={company.stamp_data} alt="Aperçu du cachet" className="max-h-12 max-w-32 object-contain" /><button type="button" onClick={() => setCompany({ ...company, stamp_data: '' })} className="text-red-700">Retirer</button></div>}
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Mention d’en-tête des documents</label>
              <input type="text" maxLength={250} value={company.header_note || ''} onChange={(e) => setCompany({ ...company, header_note: e.target.value })} placeholder="Informations complémentaires à afficher sur les documents" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Mention de pied de page</label>
              <input type="text" maxLength={250} value={company.footer_note || ''} onChange={(e) => setCompany({ ...company, footer_note: e.target.value })} placeholder="Conditions ou message de fin de document" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" />
            </div>
          </div>
          {canWrite && (
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg font-medium">
              Enregistrer les informations légales
            </button>
          )}
        </form>
      )}

      {tab === 'users' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="p-3 text-left">Nom</th>
                <th className="p-3 text-left">Identifiant</th>
                <th className="p-3 text-left">Rôle</th>
                <th className="p-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="p-3 font-semibold">{u.name}</td>
                  <td className="p-3 font-mono">{u.username}</td>
                  <td className="p-3 font-mono">{u.role}</td>
                  <td className="p-3"><StatusText status={u.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'import' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <select value={importTarget} onChange={(e) => setImportTarget(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
              <option value="clients">Importer Clients</option>
              <option value="materials">Importer Matériaux</option>
              <option value="suppliers">Importer Fournisseurs</option>
              <option value="workers">Importer Ouvriers</option>
            </select>
            <input type="file" accept=".xlsx,.csv" onChange={(e) => e.target.files?.[0] && previewFile(e.target.files[0])} />
          </div>
          {preview && (
            <div className="space-y-3">
              <div>{preview.totalRows} ligne(s) détectée(s) · Colonnes : {preview.headers.join(', ')}</div>
              <button type="button" onClick={commitImport} className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-medium">
                Confirmer l’importation
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="p-3 text-left">Horodatage</th>
                <th className="p-3 text-left">Utilisateur</th>
                <th className="p-3 text-left">Action</th>
                <th className="p-3 text-left">Entité</th>
                <th className="p-3 text-left">Détail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="p-3 font-mono text-[11px]">{l.created_at}</td>
                  <td className="p-3 font-medium">{l.user_name}</td>
                  <td className="p-3 font-mono font-semibold">{l.action}</td>
                  <td className="p-3 font-mono">{l.entity} #{l.entity_id}</td>
                  <td className="p-3 text-slate-600">{l.new_value || l.old_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function BackupPage() {
  const [backups, setBackups] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      setBackups(await apiFetch('/backups'));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function createBackup(type: 'manual_local' | 'usb_export') {
    setError('');
    setStatus('');
    try {
      const entry = await apiFetch('/backups/create', { method: 'POST', body: JSON.stringify({ backup_type: type }) });
      await load();
      setStatus(`Archive vérifiée créée : ${entry.file_name}`);
      if (type === 'usb_export') {
        downloadWithAuth(`/backups/${entry.id}/download`, entry.file_name);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function verifyBackup(id: number) {
    setError('');
    setStatus('');
    try {
      const result = await apiFetch(`/backups/${id}/verify`, { method: 'POST' });
      await load();
      setStatus(`Vérification réussie : base SQLite intègre, ${result.documentCount} document(s) contrôlé(s).`);
    } catch (e: any) {
      setError(e.message);
      await load();
    }
  }

  async function handleRestore(file: File) {
    setError('');
    setStatus('');
    if (file.size > 50 * 1024 * 1024) {
      setError('L’archive dépasse la limite de 50 Mo.');
      return;
    }
    if (!window.confirm(`ATTENTION : restaurer « ${file.name} » remplacera la base de données et le dossier Documents actuels. Une sauvegarde de sécurité sera créée automatiquement. Continuer ?`)) return;
    const fd = new FormData();
    fd.append('archive', file);
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus(`Restauration terminée avec succès. Une copie de sécurité préalable a été créée (${data.safetyBackup.file_name}).`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sauvegarde & Restauration (Clé USB / Poste local)"
        subtitle="Snapshot SQLite cohérent (VACUUM INTO) + signature SHA-256 + dossier Documents complet en archive .zip"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => createBackup('manual_local')} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg">
              <HardDrive className="w-3.5 h-3.5" /> Sauvegarde locale
            </button>
            <button type="button" onClick={() => createBackup('usb_export')} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg">
              <Download className="w-3.5 h-3.5" /> Exporter sur clé USB (.zip)
            </button>
          </div>
        }
      />

      {status && <div className="p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">{status}</div>}
      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div>
          <div className="font-semibold text-sm flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-blue-600" /> Restaurer depuis une archive ZIP
          </div>
          <p className="text-slate-500 mt-1">
            Vérifie l’intégrité SQLite et crée automatiquement une sauvegarde de sécurité avant tout remplacement.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 font-medium">
          <Upload className="w-3.5 h-3.5" /> Choisir une archive (.zip)
          <input type="file" accept=".zip" className="hidden" onChange={(e) => e.target.files?.[0] && handleRestore(e.target.files[0])} />
        </label>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">
          Historique des sauvegardes locales
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="p-3 text-left">Archive ZIP</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-right">Taille</th>
              <th className="p-3 text-left">Intégrité</th>
              <th className="p-3 text-left">Créée par / Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {backups.map((b) => (
              <tr key={b.id}>
                <td className="p-3 font-mono font-semibold">{b.file_name}</td>
                <td className="p-3">{b.backup_type}</td>
                <td className="p-3 text-right font-mono tabular-nums">{Math.round(b.size_bytes / 1024)} Ko</td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 font-medium ${b.verified ? 'text-emerald-700' : 'text-red-700'}`}>
                    <ShieldCheck className="w-3.5 h-3.5" /> {b.verified ? 'Vérifiée' : 'À vérifier'}
                  </span>
                </td>
                <td className="p-3 text-slate-500">{b.created_by} · {b.created_at}</td>
                <td className="p-3 text-right whitespace-nowrap space-x-3">
                  <button type="button" onClick={() => verifyBackup(b.id)} className="text-emerald-700 hover:underline">Vérifier</button>
                  <button type="button" onClick={() => downloadWithAuth(`/backups/${b.id}/download`, b.file_name)} className="text-blue-700 hover:underline">Télécharger</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
