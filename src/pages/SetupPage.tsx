import React, { useState } from 'react';
import { Building2, ShieldCheck } from 'lucide-react';
import { apiFetch, saveSession } from '../lib/api';

export default function SetupPage({ onSuccess }: { onSuccess: () => void }) {
  const [companyName, setCompanyName] = useState('');
  const [legalForm, setLegalForm] = useState('SARL');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<{ token: string; user: any; permissions: string[] }>('/auth/setup', {
        method: 'POST',
        body: JSON.stringify({ companyName, legalForm, fullName, username, password }),
      });
      saveSession(result.token, result.user, result.permissions);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'La configuration initiale a échoué.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-7 sm:p-9 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center"><Building2 className="w-6 h-6" /></div>
            <div><div className="font-bold text-xl">IDEAL</div><div className="text-xs text-slate-300">Configuration initiale</div></div>
          </div>
          <h1 className="mt-7 text-2xl font-semibold">Bienvenue dans votre espace de gestion</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Renseignez les informations de votre entreprise et créez votre compte propriétaire. Aucune donnée fictive ne sera ajoutée.</p>
        </div>
        <form onSubmit={submit} className="p-7 sm:p-9 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Nom de l’entreprise *</label>
            <input required value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" placeholder="Nom réel de votre entreprise" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Forme juridique</label>
            <select value={legalForm} onChange={e => setLegalForm(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm">
              <option>SARL</option><option>EURL</option><option>SPA</option><option>SNC</option><option>Entreprise individuelle</option><option>Autre</option>
            </select>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-sm font-semibold mb-3">Compte propriétaire / administrateur</div>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium mb-1.5">Nom complet *</label><input required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" placeholder="Votre nom complet" /></div>
              <div><label className="block text-xs font-medium mb-1.5">Identifiant *</label><input required minLength={3} maxLength={32} pattern="[A-Za-z0-9._\-]+" value={username} onChange={e => setUsername(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" placeholder="Ex. gestionnaire" autoComplete="username" /></div>
              <div><label className="block text-xs font-medium mb-1.5">Mot de passe *</label><input required minLength={10} type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" placeholder="10 caractères minimum" autoComplete="new-password" /></div>
              <div><label className="block text-xs font-medium mb-1.5">Confirmer le mot de passe *</label><input required minLength={10} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" placeholder="Répétez le mot de passe" autoComplete="new-password" /></div>
            </div>
          </div>
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300">{error}</div>}
          <div className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" /><span>Le mot de passe est haché avant son enregistrement. La configuration ne peut être exécutée qu’une seule fois.</span></div>
          <button disabled={loading} type="submit" className="w-full rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold py-3">{loading ? 'Configuration en cours…' : 'Créer mon espace et continuer'}</button>
        </form>
      </div>
    </div>
  );
}
