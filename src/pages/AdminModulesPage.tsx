import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FolderUp, HardDrive, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
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
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('projects');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const canWrite = hasPerm(permissions, 'documents:write');

  async function load() {
    try {
      setDocs(await apiFetch('/documents'));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setError('');
    const fd = new FormData();
    fd.append('title', title);
    fd.append('category', category);
    fd.append('file', file);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setTitle('');
      setFile(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Centre de documents local" subtitle="Stockage organisé sur le poste local (contrats, plans, cartes grises, factures scannées)" />
      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      {canWrite && (
        <form onSubmit={uploadDoc} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-end gap-3 text-xs">
          <div className="flex-1 min-w-[200px]">
            <label className="block font-medium mb-1">Intitulé du document *</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" placeholder="ex. Attestation assurance 2026" />
          </div>
          <div>
            <label className="block font-medium mb-1">Dossier</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
              <option value="projects">Chantiers / Plans</option>
              <option value="contracts">Contrats</option>
              <option value="invoices">Factures</option>
              <option value="vehicles">Véhicules</option>
              <option value="payroll">Paie / RH</option>
              <option value="general">Général</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Fichier *</label>
            <input type="file" required onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs" />
          </div>
          <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 text-white bg-blue-700 rounded-lg font-medium">
            <FolderUp className="w-3.5 h-3.5" /> Archiver localement
          </button>
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="p-3 text-left">Document</th>
              <th className="p-3 text-left">Dossier</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="p-3">
                  <div className="font-semibold">{d.title}</div>
                  <div className="font-mono text-[11px] text-slate-500">{d.file_name}</div>
                </td>
                <td className="p-3">{d.category}</td>
                <td className="p-3 font-mono">{formatDateFr(d.doc_date)}</td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => downloadWithAuth(`/documents/${d.id}/download`, d.file_name)}
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" /> Télécharger
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    apiFetch('/reports/summary').then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-6 text-xs text-slate-500">Génération des rapports...</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rapports de gestion & Rentabilité"
        subtitle="Analyse consolidée par chantier, coût de main-d’œuvre et coûts du parc véhicules"
        actions={
          <button
            type="button"
            onClick={() => downloadWithAuth('/reports/export/xlsx', 'rapport_complet_gestionpro_dz.xlsx')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Exporter classeur Excel (.xlsx)
          </button>
        }
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">
          Rentabilité réelle par chantier
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="p-3 text-left">Chantier</th>
              <th className="p-3 text-left">Statut</th>
              <th className="p-3 text-right">Facturé HT</th>
              <th className="p-3 text-right">Coût réel total</th>
              <th className="p-3 text-right">Bénéfice net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.projectProfits.map((p: any) => (
              <tr key={p.project_number}>
                <td className="p-3"><span className="font-mono font-semibold mr-2">{p.project_number}</span>{p.title}</td>
                <td className="p-3"><StatusText status={p.status} /></td>
                <td className="p-3 text-right font-mono tabular-nums">{formatDA(p.invoiced_ht)}</td>
                <td className="p-3 text-right font-mono tabular-nums">{formatDA(p.total_actual_cost)}</td>
                <td className={`p-3 text-right font-mono tabular-nums font-bold ${p.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatDA(p.net_profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

  async function handleRestore(file: File) {
    setError('');
    setStatus('');
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
              <th className="p-3 text-right">Télécharger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {backups.map((b) => (
              <tr key={b.id}>
                <td className="p-3 font-mono font-semibold">{b.file_name}</td>
                <td className="p-3">{b.backup_type}</td>
                <td className="p-3 text-right font-mono tabular-nums">{Math.round(b.size_bytes / 1024)} Ko</td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" /> Vérifiée
                  </span>
                </td>
                <td className="p-3 text-slate-500">{b.created_by} · {b.created_at}</td>
                <td className="p-3 text-right">
                  <button type="button" onClick={() => downloadWithAuth(`/backups/${b.id}/download`, b.file_name)} className="text-blue-700 hover:underline">
                    Télécharger
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
