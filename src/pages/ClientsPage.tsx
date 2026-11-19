import React, { useEffect, useState } from 'react';
import { Download, Eye, Plus, Search, UserCheck, Trash2, Archive, RotateCcw } from 'lucide-react';
import { apiFetch, downloadWithAuth, formatDA, formatDateFr, hasPerm } from '../lib/api';
import { EmptyState, Modal, PageHeader, StatusText } from '../components/ui';

export default function ClientsPage({ permissions }: { permissions: string[] }) {
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    client_type: 'company',
    name: '',
    phone: '',
    email: '',
    address: '',
    nif: '',
    nis: '',
    rc: '',
    ai: '',
    payment_terms: 'Virement',
    credit_limit: 0,
    notes: '',
    status: 'active',
  });

  const canWrite = hasPerm(permissions, 'clients:write');
  const canDelete = hasPerm(permissions, 'clients:delete');

  async function load() {
    try {
      setClients(await apiFetch('/clients'));
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      client_type: 'company',
      name: '',
      phone: '',
      email: '',
      address: '',
      nif: '',
      nis: '',
      rc: '',
      ai: '',
      payment_terms: 'Virement',
      credit_limit: 0,
      notes: '',
      status: 'active',
    });
    setModalOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c);
    setForm({
      client_type: c.client_type,
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      nif: c.nif || '',
      nis: c.nis || '',
      rc: c.rc || '',
      ai: c.ai || '',
      payment_terms: c.payment_terms || 'Virement',
      credit_limit: c.credit_limit || 0,
      notes: c.notes || '',
      status: c.status,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await apiFetch(`/clients/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await apiFetch('/clients', { method: 'POST', body: JSON.stringify(form) });
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleClientStatus(client: any) {
    const next = client.status === 'inactive' ? 'active' : 'inactive';
    const action = next === 'inactive' ? 'archiver' : 'réactiver';
    if (!window.confirm(`Voulez-vous ${action} le client « ${client.name} » ? Son historique et ses chantiers seront conservés.`)) return;
    try {
      await apiFetch(`/clients/${client.id}`, { method: 'PUT', body: JSON.stringify({ status: next }) });
      await load();
    } catch (err: any) { setError(err.message); }
  }

  async function deleteClient(client: any) {
    const confirmed = window.confirm(`Supprimer le client « ${client.name} » ? Cette action est réservée aux clients sans chantier associé. Pour les autres, utilisez le statut Inactif.`);
    if (!confirmed) return;
    setError('');
    try {
      await apiFetch(`/clients/${client.id}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function openProfile(id: number) {
    try {
      setProfile(await apiFetch(`/clients/${id}`));
    } catch (err: any) {
      setError(err.message);
    }
  }

  const filtered = clients.filter((c) => {
    if (typeFilter !== 'all' && c.client_type !== typeFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.nif || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients & Maîtres d’ouvrage"
        subtitle="Répertoire commercial et identifiants fiscaux algériens (NIF, NIS, RC, AI)"
        actions={
          <>
            <button
              type="button"
              onClick={() => downloadWithAuth('/clients/export/xlsx', 'clients_gestionpro_dz.xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Nouveau client
              </button>
            )}
          </>
        }
      />

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone ou NIF..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
        >
          <option value="all">Tous les types</option>
          <option value="company">Entreprises / Promoteurs</option>
          <option value="individual">Particuliers</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Aucun client trouvé pour ces critères." />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-3 text-left font-medium">Client</th>
                  <th className="p-3 text-left font-medium">Contact</th>
                  <th className="p-3 text-left font-medium">Identifiants fiscaux</th>
                  <th className="p-3 text-right font-medium">Chantiers</th>
                  <th className="p-3 text-right font-medium">Solde dû</th>
                  <th className="p-3 text-left font-medium">Statut</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {c.client_type === 'company' ? 'Entreprise' : 'Particulier'} · {c.address}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono">{c.phone || '—'}</div>
                      <div className="text-[11px] text-slate-500">{c.email || '—'}</div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {c.nif ? <div>NIF: {c.nif}</div> : <span>Particulier sans NIF</span>}
                      {c.rc && <div>RC: {c.rc}</div>}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">{c.project_count || 0}</td>
                    <td
                      className={`p-3 text-right font-mono tabular-nums font-semibold ${
                        c.balance_due > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {formatDA(c.balance_due)}
                    </td>
                    <td className="p-3">
                      <StatusText status={c.status} />
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => openProfile(c.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Eye className="w-3 h-3" /> Profil 360°
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="px-2.5 py-1 text-xs text-blue-700 dark:text-blue-400 hover:underline"
                        >
                          Modifier
                        </button>
                      )}
                      {canWrite && (
                        <button type="button" onClick={() => toggleClientStatus(c)} title={c.status === 'inactive' ? 'Réactiver le client' : 'Archiver le client'} aria-label={c.status === 'inactive' ? `Réactiver ${c.name}` : `Archiver ${c.name}`} className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                          {c.status === 'inactive' ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                          {c.status === 'inactive' ? 'Réactiver' : 'Archiver'}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteClient(c)}
                          title="Supprimer le client (si aucun chantier n’y est lié)"
                          aria-label={`Supprimer ${c.name}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                        >
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Modifier ${editing.name}` : 'Nouveau client'}
      >
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Type de client</label>
              <select
                value={form.client_type}
                onChange={(e) => setForm({ ...form, client_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="company">Entreprise / Promoteur / Public</option>
                <option value="individual">Particulier</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Raison sociale / Nom complet *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Téléphone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Adresse</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">NIF (Numéro d’Identification Fiscale)</label>
              <input
                type="text"
                value={form.nif}
                onChange={(e) => setForm({ ...form, nif: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">NIS</label>
              <input
                type="text"
                value={form.nis}
                onChange={(e) => setForm({ ...form, nis: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Registre de Commerce (RC)</label>
              <input
                type="text"
                value={form.rc}
                onChange={(e) => setForm({ ...form, rc: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Article d’Imposition (AI)</label>
              <input
                type="text"
                value={form.ai}
                onChange={(e) => setForm({ ...form, ai: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Mode de règlement habituel</label>
              <select
                value={form.payment_terms}
                onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="Virement">Virement bancaire</option>
                <option value="Chèque">Chèque</option>
                <option value="Espèces">Espèces</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="blocked">Bloqué</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-2 border rounded-lg">
              Annuler
            </button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg font-medium">
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Client 360° Profile Modal */}
      <Modal
        open={!!profile}
        onClose={() => setProfile(null)}
        title={profile ? `Profil client 360° — ${profile.client.name}` : ''}
        maxWidth="max-w-4xl"
      >
        {profile && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <div className="text-slate-500">Total facturé TTC</div>
                <div className="text-base font-bold font-mono tabular-nums mt-1">{formatDA(profile.totals.totalInvoiced)}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <div className="text-slate-500">Encaissements reçus</div>
                <div className="text-base font-bold font-mono tabular-nums text-emerald-700 mt-1">{formatDA(profile.totals.totalPaid)}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <div className="text-slate-500">Reste à encaisser</div>
                <div className="text-base font-bold font-mono tabular-nums text-amber-700 mt-1">{formatDA(profile.totals.balanceDue)}</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" /> Chantiers associés ({profile.projects.length})
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                {profile.projects.map((p: any) => (
                  <div key={p.id} className="p-2.5 flex justify-between items-center">
                    <div>
                      <span className="font-mono font-semibold mr-2">{p.project_number}</span>
                      <span>{p.title}</span>
                    </div>
                    <StatusText status={p.status} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Historique des pièces commerciales ({profile.documents.length})</h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                {profile.documents.map((d: any) => (
                  <div key={d.id} className="p-2.5 flex justify-between items-center">
                    <div>
                      <span className="font-mono font-semibold mr-2">{d.doc_number}</span>
                      <span className="text-slate-500">{formatDateFr(d.issue_date)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono tabular-nums font-medium">{formatDA(d.total_ttc)}</span>
                      <StatusText status={d.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
