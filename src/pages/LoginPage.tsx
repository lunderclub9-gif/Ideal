import React, { useState } from 'react';
import { Building2, HardDrive, Lock, ShieldCheck } from 'lucide-react';
import { apiFetch, saveSession } from '../lib/api';

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      saveSession(data.token, data.user, data.permissions);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Échec de connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-8 md:p-10 bg-slate-900 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-blue-400">
              <Building2 className="w-6 h-6" />
              <span className="inline-flex items-center gap-2 font-display font-bold text-xl tracking-tight text-white"><span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 text-white text-xs font-extrabold shadow">ID</span>IDEAL</span>
            </div>
            <h1 className="mt-6 text-2xl font-display font-semibold tracking-tight leading-snug">
              Gestion BTP &amp; Services 100% locale pour l’entreprise algérienne.
            </h1>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              Suivez vos chantiers, factures en Dinar Algérien, pointages journaliers, paie CNAS/IRG, stock de matériaux et parc engins sans dépendance internet.
            </p>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Contrôle d’accès strict par rôle (RBAC) &amp; journal d’audit</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Conformité fiscale algérienne : NIF, NIS, RC, AI, TVA, CNAS, IRG</span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Base SQLite locale + sauvegarde ZIP sur clé USB</span>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-10">
          <h2 className="text-lg font-display font-semibold text-slate-900 dark:text-white">
            Connexion au poste de travail
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Entrez les identifiants de votre compte utilisateur.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nom d’utilisateur
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            {error && (
              <div className="p-3 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg"
            >
              {loading ? 'Vérification...' : 'Se connecter'}
            </button>
          </form>


        </div>
      </div>
    </div>
  );
}
