import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  FolderOpen,
  Fuel,
  Hammer,
  HardDrive,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Receipt,
  Scale,
  Settings,
  Search,
  ShieldAlert,
  ShoppingCart,
  Sun,
  Truck,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import {
  apiFetch,
  AuthUser,
  clearSession,
  getSavedPermissions,
  getSavedUser,
  getToken,
  hasPerm,
  ROLE_LABELS,
  saveSession,
} from './lib/api';
import LoginPage from './pages/LoginPage';
import UpdaterPanel from './components/UpdaterPanel';
import SetupPage from './pages/SetupPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ProjectsPage from './pages/ProjectsPage';
import ServicesPage from './pages/ServicesPage';
import InvoicesPage from './pages/InvoicesPage';
import AttendancePage from './pages/AttendancePage';
import PayrollPage from './pages/PayrollPage';
import MaterialsPage from './pages/MaterialsPage';
import SuppliersPage from './pages/SuppliersPage';
import FleetPage from './pages/FleetPage';
import TreasuryPage from './pages/TreasuryPage';
import DebtsPage from './pages/DebtsPage';
import {
  BackupPage,
  DocumentsPage,
  ReportsPage,
  SettingsPage,
  TaxesPage,
} from './pages/AdminModulesPage';

interface NavEntry {
  id: string;
  label: string;
  group: string;
  permission: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavEntry[] = [
  { id: 'dashboard', label: 'Tableau de bord', group: 'Pilotage', permission: 'dashboard:view', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', group: 'Chantiers & Commercial', permission: 'clients:read', icon: Users },
  { id: 'projects', label: 'Chantiers', group: 'Chantiers & Commercial', permission: 'projects:read', icon: Building2 },
  { id: 'services', label: 'Types de travaux', group: 'Chantiers & Commercial', permission: 'settings:read', icon: Hammer },
  { id: 'invoices', label: 'Devis & Factures', group: 'Chantiers & Commercial', permission: 'invoices:read', icon: FileSpreadsheet },
  { id: 'attendance', label: 'Pointage', group: 'Équipes & Paie', permission: 'attendance:read', icon: ClipboardCheck },
  { id: 'payroll', label: 'Personnel & Paie', group: 'Équipes & Paie', permission: 'payroll:read', icon: Wallet },
  { id: 'materials', label: 'Matériaux & Stock', group: 'Stock, Achats & Parc', permission: 'materials:read', icon: Package },
  { id: 'suppliers', label: 'Fournisseurs & Achats', group: 'Stock, Achats & Parc', permission: 'suppliers:read', icon: ShoppingCart },
  { id: 'vehicles', label: 'Véhicules & Engins', group: 'Stock, Achats & Parc', permission: 'vehicles:read', icon: Truck },
  { id: 'maintenance', label: 'Maintenance & Réparations', group: 'Stock, Achats & Parc', permission: 'vehicles:read', icon: Wrench },
  { id: 'fuel', label: 'Carburant', group: 'Stock, Achats & Parc', permission: 'vehicles:read', icon: Fuel },
  { id: 'tools', label: 'Outillage & Sorties', group: 'Stock, Achats & Parc', permission: 'materials:read', icon: Hammer },
  { id: 'treasury', label: 'Trésorerie', group: 'Finances & Administration', permission: 'treasury:read', icon: Landmark },
  { id: 'debts', label: 'Dettes & Créances', group: 'Finances & Administration', permission: 'treasury:read', icon: CreditCard },
  { id: 'expenses', label: 'Dépenses', group: 'Finances & Administration', permission: 'expenses:read', icon: Receipt },
  { id: 'taxes', label: 'Comptabilité & Impôts', group: 'Finances & Administration', permission: 'taxes:read', icon: Scale },
  { id: 'documents', label: 'Centre de documents', group: 'Finances & Administration', permission: 'documents:read', icon: FolderOpen },
  { id: 'reports', label: 'Rapports', group: 'Finances & Administration', permission: 'reports:read', icon: BarChart3 },
  { id: 'settings', label: 'Paramètres', group: 'Finances & Administration', permission: 'settings:read', icon: Settings },
  { id: 'backup', label: 'Sauvegarde & Restauration', group: 'Finances & Administration', permission: 'backup:manage', icon: HardDrive },
];

function getInitialRoute(): string {
  const hash = window.location.hash.replace('#', '').trim();
  return NAV_ITEMS.some((i) => i.id === hash) ? hash : 'dashboard';
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(getSavedUser());
  const [permissions, setPermissions] = useState<string[]>(getSavedPermissions());
  const [route, setRoute] = useState<string>(getInitialRoute);
  const [dark, setDark] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  useEffect(() => {
    apiFetch<{ setupRequired: boolean }>('/auth/setup-status')
      .then((result) => setSetupRequired(result.setupRequired))
      .catch(() => setSetupRequired(false));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '').trim();
      if (h && NAV_ITEMS.some((i) => i.id === h)) setRoute(h);
    };
    const onUnauth = () => {
      clearSession();
      setUser(null);
      setPermissions([]);
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('gestionpro-unauthorized', onUnauth);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('gestionpro-unauthorized', onUnauth);
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiFetch<{ user: AuthUser; permissions: string[] }>('/auth/me')
      .then((res) => {
        saveSession(token, res.user, res.permissions);
        setUser(res.user);
        setPermissions(res.permissions);
      })
      .catch(() => {
        clearSession();
        setUser(null);
        setPermissions([]);
      });
  }, []);

  useEffect(() => {
    const active = NAV_ITEMS.find((item) => item.id === route);
    if (active) setCollapsedGroups((current) => current.filter((group) => group !== active.group));
  }, [route]);

  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === '1') navigate('dashboard');
      else if (e.key === '2' && hasPerm(permissions, 'projects:read')) navigate('projects');
      else if (e.key === '3' && hasPerm(permissions, 'attendance:read')) navigate('attendance');
      else if (e.key === '4' && hasPerm(permissions, 'invoices:read')) navigate('invoices');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user, permissions]);

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleLogout();
      }, 30 * 60 * 1000);
    };
    reset();
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [user]);

  function navigate(id: string) {
    setRoute(id);
    window.location.hash = id;
    setMobileMenu(false);
  }

  async function handleLogout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    clearSession();
    setUser(null);
    setPermissions([]);
  }

  if (setupRequired === null) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Préparation de GestionPro DZ…</div>;
  }

  if (setupRequired) {
    return <SetupPage onSuccess={() => { setSetupRequired(false); setUser(getSavedUser()); setPermissions(getSavedPermissions()); }} />;
  }

  if (!user) {
    return (
      <LoginPage
        onSuccess={() => {
          setUser(getSavedUser());
          setPermissions(getSavedPermissions());
          navigate('dashboard');
        }}
      />
    );
  }

  const visibleNav = NAV_ITEMS.filter((item) => hasPerm(permissions, item.permission));
  const normalizedNavSearch = navSearch.trim().toLocaleLowerCase('fr');
  const filteredNav = visibleNav.filter((item) => !normalizedNavSearch || `${item.label} ${item.group}`.toLocaleLowerCase('fr').includes(normalizedNavSearch));
  const groups = Array.from(new Set(filteredNav.map((i) => i.group)));
  const currentNav = NAV_ITEMS.find((i) => i.id === route);
  const authorized = currentNav ? hasPerm(permissions, currentNav.permission) : true;

  function renderModule() {
    if (!authorized) {
      return (
        <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center max-w-lg mx-auto mt-10">
          <ShieldAlert className="w-10 h-10 text-red-600 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Accès refusé (403)</h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Votre rôle ({ROLE_LABELS[user!.role]}) ne dispose pas des autorisations requises pour accéder à ce module.
          </p>
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg"
          >
            Retour au tableau de bord
          </button>
        </div>
      );
    }

    switch (route) {
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case 'clients':
        return <ClientsPage permissions={permissions} />;
      case 'projects':
        return <ProjectsPage permissions={permissions} />;
      case 'services':
        return <ServicesPage permissions={permissions} />;
      case 'invoices':
        return <InvoicesPage permissions={permissions} />;
      case 'attendance':
        return <AttendancePage permissions={permissions} />;
      case 'payroll':
        return <PayrollPage permissions={permissions} />;
      case 'materials':
        return <MaterialsPage permissions={permissions} />;
      case 'suppliers':
        return <SuppliersPage permissions={permissions} />;
      case 'vehicles':
        return <FleetPage initialSection="vehicles" permissions={permissions} />;
      case 'maintenance':
        return <FleetPage initialSection="maintenance" permissions={permissions} />;
      case 'fuel':
        return <FleetPage initialSection="fuel" permissions={permissions} />;
      case 'tools':
        return <FleetPage initialSection="tools" permissions={permissions} />;
      case 'treasury':
        return <TreasuryPage initialTab="treasury" permissions={permissions} />;
      case 'debts':
        return <DebtsPage />;
      case 'expenses':
        return <TreasuryPage initialTab="expenses" permissions={permissions} />;
      case 'taxes':
        return <TaxesPage permissions={permissions} />;
      case 'documents':
        return <DocumentsPage permissions={permissions} />;
      case 'reports':
        return <ReportsPage permissions={permissions} />;
      case 'settings':
        return <SettingsPage permissions={permissions} />;
      case 'backup':
        return <BackupPage />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  }

  return (
    <div className="min-h-screen flex bg-[#f3f7f6] dark:bg-[#101b1b] text-slate-900 dark:text-slate-100">
      {mobileMenu && <button type="button" aria-label="Fermer le menu" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden no-print" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform lg:translate-x-0 no-print ${
          mobileMenu ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
          <span className="text-base font-bold tracking-tight font-display text-slate-900 dark:text-white whitespace-nowrap">
            GestionPro DZ
          </span>
          <button
            type="button"
            onClick={() => setMobileMenu(false)}
            className="lg:hidden p-1 text-slate-500"
            aria-label="Fermer menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 pt-3">
          <label className="relative block">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input value={navSearch} onChange={(e) => setNavSearch(e.target.value)} placeholder="Rechercher un module…" aria-label="Rechercher un module" className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          </label>
          <p className="mt-2 px-1 text-[10px] text-slate-400">{filteredNav.length} modules disponibles</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {groups.length === 0 && <p className="px-3 py-6 text-xs text-slate-500 text-center">Aucun module correspondant.</p>}
          {groups.map((grp) => (
            <div key={grp}>
              <button type="button" onClick={() => setCollapsedGroups((current) => current.includes(grp) ? current.filter((name) => name !== grp) : [...current, grp])} aria-expanded={!collapsedGroups.includes(grp)} className="w-full px-3 mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                <span>{grp}</span><ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsedGroups.includes(grp) ? '-rotate-90' : ''}`} />
              </button>
              {!collapsedGroups.includes(grp) && <div className="space-y-0.5">
                {filteredNav
                  .filter((i) => i.group === grp)
                  .map((item) => {
                    const Icon = item.icon;
                    const active = route === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.id)}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-teal-700 text-white'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
              </div>}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-xs">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
          <p className="text-[11px] text-slate-500 truncate">{ROLE_LABELS[user.role]}</p>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-8 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenu(true)}
              className="lg:hidden p-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
              aria-label="Ouvrir menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              GestionPro DZ <span className="mx-1.5">/</span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">
                {currentNav?.label || 'Tableau de bord'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <UpdaterPanel canBackup={hasPerm(permissions, 'backup:manage')} />
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              aria-label="Changer le thème"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" /> Déconnexion
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">{renderModule()}</main>
      </div>
    </div>
  );
}
