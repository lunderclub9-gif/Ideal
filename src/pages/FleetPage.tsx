import React, { useEffect, useState } from 'react';
import { AlertTriangle, Fuel, Hammer, Plus, Truck, Wrench } from 'lucide-react';
import { apiFetch, formatDA, formatDateFr, hasPerm } from '../lib/api';
import { Modal, PageHeader, StatusText } from '../components/ui';

export default function FleetPage({
  initialSection = 'vehicles',
  permissions,
}: {
  initialSection?: 'vehicles' | 'maintenance' | 'fuel' | 'tools';
  permissions: string[];
}) {
  const [section, setSection] = useState<'vehicles' | 'maintenance' | 'fuel' | 'tools'>(initialSection);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [vehicleModal, setVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    asset_type: 'vehicle', name: '', brand: '', registration: '',
    driver_worker_id: '', current_mileage: 0, current_engine_hours: 0,
    usage_rate_per_day: 0, status: 'available', current_project_id: '',
    insurance_expiry: '', inspection_expiry: '', notes: '',
  });
  const [fuelModal, setFuelModal] = useState(false);
  const [editingFuel, setEditingFuel] = useState<any | null>(null);
  const [repairModal, setRepairModal] = useState(false);
  const [checkoutTool, setCheckoutTool] = useState<any | null>(null);
  const [error, setError] = useState('');

  const [fuelForm, setFuelForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    vehicle_id: '',
    driver_worker_id: '',
    liters: 50,
    price_per_liter: 29.01,
    odometer_before: 0,
    odometer_after: 0,
    project_id: '',
    fuel_station: 'Naftal',
    trip_purpose: '',
  });
  const [repForm, setRepForm] = useState({
    vehicle_id: '',
    problem_category: 'engine',
    description: '',
    priority: 'normal',
    workshop: '',
    parts_cost: 0,
    labor_cost: 0,
    project_id: '',
  });
  const [coForm, setCoForm] = useState({ worker_id: '', project_id: '', expected_return_date: '' });

  const canVehicles = hasPerm(permissions, 'vehicles:write');
  const canFuel = hasPerm(permissions, 'fuel:write');
  const canRepairs = hasPerm(permissions, 'repairs:write');
  const canMaterials = hasPerm(permissions, 'materials:write');

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  async function load() {
    try {
      const [v, ro, mr, fe, t, w, p] = await Promise.all([
        apiFetch('/vehicles'),
        apiFetch('/repair-orders'),
        apiFetch('/maintenance-rules'),
        apiFetch('/fuel-entries'),
        apiFetch('/tools'),
        apiFetch('/workers'),
        apiFetch('/projects'),
      ]);
      setVehicles(v);
      setRepairs(ro);
      setRules(mr);
      setFuel(fe);
      setTools(t);
      setWorkers(w);
      setProjects(p);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNewVehicle() {
    setEditingVehicle(null);
    setVehicleForm({ asset_type: 'vehicle', name: '', brand: '', registration: '', driver_worker_id: '', current_mileage: 0, current_engine_hours: 0, usage_rate_per_day: 0, status: 'available', current_project_id: '', insurance_expiry: '', inspection_expiry: '', notes: '' });
    setVehicleModal(true);
  }

  function openEditVehicle(vehicle: any) {
    setEditingVehicle(vehicle);
    setVehicleForm({
      asset_type: vehicle.asset_type || 'vehicle', name: vehicle.name || '', brand: vehicle.brand || '',
      registration: vehicle.registration || '', driver_worker_id: vehicle.driver_worker_id ? String(vehicle.driver_worker_id) : '',
      current_mileage: Number(vehicle.current_mileage || 0), current_engine_hours: Number(vehicle.current_engine_hours || 0),
      usage_rate_per_day: Number(vehicle.usage_rate_per_day || 0), status: vehicle.status || 'available',
      current_project_id: vehicle.current_project_id ? String(vehicle.current_project_id) : '',
      insurance_expiry: vehicle.insurance_expiry || '', inspection_expiry: vehicle.inspection_expiry || '', notes: vehicle.notes || '',
    });
    setVehicleModal(true);
  }

  async function saveVehicle(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = { ...vehicleForm, driver_worker_id: vehicleForm.driver_worker_id || null, current_project_id: vehicleForm.current_project_id || null };
      await apiFetch(editingVehicle ? `/vehicles/${editingVehicle.id}` : '/vehicles', {
        method: editingVehicle ? 'PUT' : 'POST', body: JSON.stringify(payload),
      });
      setVehicleModal(false);
      setEditingVehicle(null);
      await load();
    } catch (err: any) { setError(err.message); }
  }

  function openNewFuel() {
    setEditingFuel(null);
    setFuelForm({ date: new Date().toISOString().slice(0, 10), vehicle_id: '', driver_worker_id: '', liters: 50, price_per_liter: 29.01, odometer_before: 0, odometer_after: 0, project_id: '', fuel_station: 'Naftal', trip_purpose: '' });
    setFuelModal(true);
  }

  function openEditFuel(entry: any) {
    setEditingFuel(entry);
    setFuelForm({
      date: entry.date || new Date().toISOString().slice(0, 10),
      vehicle_id: String(entry.vehicle_id),
      driver_worker_id: entry.driver_worker_id ? String(entry.driver_worker_id) : '',
      liters: Number(entry.liters || 0),
      price_per_liter: Number(entry.price_per_liter || 0),
      odometer_before: Number(entry.odometer_before || 0),
      odometer_after: Number(entry.odometer_after || 0),
      project_id: entry.project_id ? String(entry.project_id) : '',
      fuel_station: entry.fuel_station || 'Naftal',
      trip_purpose: entry.trip_purpose || '',
    });
    setFuelModal(true);
  }

  async function saveFuel(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(editingFuel ? `/fuel-entries/${editingFuel.id}` : '/fuel-entries', { method: editingFuel ? 'PUT' : 'POST', body: JSON.stringify(fuelForm) });
      setFuelModal(false);
      setEditingFuel(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveRepair(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/repair-orders', { method: 'POST', body: JSON.stringify(repForm) });
      setRepairModal(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function generateRuleOrder(ruleId: number) {
    try {
      await apiFetch(`/maintenance-rules/${ruleId}/create-order`, { method: 'POST' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function completeRepair(id: number) {
    try {
      await apiFetch(`/repair-orders/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'completed' }) });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function submitCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!checkoutTool) return;
    try {
      await apiFetch('/tools/checkout', {
        method: 'POST',
        body: JSON.stringify({ tool_id: checkoutTool.id, ...coForm }),
      });
      setCheckoutTool(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function returnTool(toolId: number) {
    try {
      await apiFetch('/tools/return', { method: 'POST', body: JSON.stringify({ tool_id: toolId, condition_in: 'good' }) });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parc Véhicules, Engins, Carburant & Outillage"
        subtitle="Suivi kilométrique, maintenance préventive, ordres de réparation, L/100km et affectation d’outillage"
        actions={
          <div className="flex flex-wrap gap-2">
            {section === 'vehicles' && canVehicles && <button type="button" onClick={openNewVehicle} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg"><Plus className="w-3.5 h-3.5" /> Ajouter un véhicule</button>}
            {canFuel && (
              <button type="button" onClick={openNewFuel} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg">
                <Fuel className="w-3.5 h-3.5" /> Saisir plein carburant
              </button>
            )}
            {canRepairs && (
              <button type="button" onClick={() => setRepairModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg">
                <Wrench className="w-3.5 h-3.5" /> Signaler panne / OR
              </button>
            )}
          </div>
        }
      />

      {error && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 text-xs">
        {[
          ['vehicles', 'Véhicules & Engins', Truck],
          ['maintenance', 'Maintenance & Réparations', Wrench],
          ['fuel', 'Carburant & Consommation', Fuel],
          ['tools', 'Outillage portatif', Hammer],
        ].map(([k, lbl, Icon]: any) => (
          <button
            key={k}
            type="button"
            onClick={() => setSection(k)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 font-medium border-b-2 ${
              section === k ? 'border-blue-700 text-blue-700 dark:text-blue-400' : 'border-transparent text-slate-500'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {lbl}
          </button>
        ))}
      </div>

      {section === 'vehicles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {vehicles.map((v) => (
            <div key={v.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="font-mono text-[11px] font-semibold text-blue-700">{v.registration}</span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{v.name}</h3>
                  <div className="text-slate-500">Chauffeur : {v.driver_name || 'Non affecté'} · {v.project_title || 'Au dépôt'}</div>
                </div>
                <StatusText status={v.status} />
              </div>
              {canVehicles && <div className="mt-3 flex justify-end"><button type="button" onClick={() => openEditVehicle(v)} className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">Modifier le véhicule</button></div>}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 font-mono tabular-nums">
                <div>
                  <div className="font-sans text-slate-500">Compteur</div>
                  <div className="font-semibold">{v.current_mileage > 0 ? `${v.current_mileage} km` : `${v.current_engine_hours} h`}</div>
                </div>
                <div>
                  <div className="font-sans text-slate-500">Carburant</div>
                  <div className="font-semibold">{formatDA(v.total_fuel_cost)}</div>
                </div>
                <div className="text-right">
                  <div className="font-sans text-slate-500">Réparations</div>
                  <div className="font-semibold text-amber-700">{formatDA(v.total_repair_cost)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {section === 'maintenance' && (
        <div className="space-y-5 text-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">
              Règles de maintenance préventive
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {rules.map((r) => (
                <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      {r.alert && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                      {r.vehicle_name} — {r.rule_name}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                      Actuel : {r.current_value} · Prochaine échéance : {r.next_due_value} ({r.trigger_type}) · Reste : {r.remaining_value}
                    </div>
                  </div>
                  {canRepairs && (
                    <button
                      type="button"
                      onClick={() => generateRuleOrder(r.id)}
                      className="px-3 py-1.5 bg-blue-700 text-white rounded-lg font-medium"
                    >
                      Créer ordre d’entretien
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">
              Ordres de réparation
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="p-3 text-left">N° OR</th>
                  <th className="p-3 text-left">Véhicule / Engin</th>
                  <th className="p-3 text-left">Intervention</th>
                  <th className="p-3 text-right">Coût total</th>
                  <th className="p-3 text-left">Statut</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {repairs.map((ro) => (
                  <tr key={ro.id}>
                    <td className="p-3 font-mono font-semibold">{ro.order_number}</td>
                    <td className="p-3">{ro.vehicle_name}</td>
                    <td className="p-3">{ro.description}</td>
                    <td className="p-3 text-right font-mono tabular-nums font-semibold">{formatDA(ro.total_cost)}</td>
                    <td className="p-3"><StatusText status={ro.status} /></td>
                    <td className="p-3 text-right">
                      {canRepairs && ro.status !== 'completed' && (
                        <button type="button" onClick={() => completeRepair(ro.id)} className="text-emerald-700 font-medium hover:underline">
                          Clôturer
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

      {section === 'fuel' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Véhicule</th>
                <th className="p-3 text-left">Chantier / Trajet</th>
                <th className="p-3 text-right">Litres</th>
                <th className="p-3 text-right">Distance</th>
                <th className="p-3 text-right">L / 100 km</th>
                <th className="p-3 text-right">Coût</th>
                {canFuel && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {fuel.map((f) => (
                <tr key={f.id}>
                  <td className="p-3 font-mono">{formatDateFr(f.date)}</td>
                  <td className="p-3 font-medium">{f.vehicle_name}</td>
                  <td className="p-3">{f.project_number ? `${f.project_number} — ${f.trip_purpose}` : f.trip_purpose || f.fuel_station}</td>
                  <td className="p-3 text-right font-mono tabular-nums">{f.liters} L</td>
                  <td className="p-3 text-right font-mono tabular-nums">{f.distance_km > 0 ? `${f.distance_km} km` : '—'}</td>
                  <td className={`p-3 text-right font-mono tabular-nums font-semibold ${f.abnormal ? 'text-red-700' : ''}`}>
                    {f.l_per_100 !== null ? `${f.l_per_100} L/100` : '—'}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums font-bold">{formatDA(f.total_cost)}</td>
                  {canFuel && <td className="p-3 text-right"><button type="button" onClick={() => openEditFuel(f)} className="inline-flex items-center gap-1 px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">Modifier</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section === 'tools' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Outil / Équipement</th>
                <th className="p-3 text-left">Détenteur / Chantier</th>
                <th className="p-3 text-left">Statut</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tools.map((t) => (
                <tr key={t.id}>
                  <td className="p-3 font-mono font-semibold">{t.code}</td>
                  <td className="p-3">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-[11px] text-slate-500">{t.category}</div>
                  </td>
                  <td className="p-3">{t.worker_name ? `${t.worker_name} (${t.project_number || 'Dépôt'})` : t.storage_location}</td>
                  <td className="p-3"><StatusText status={t.status} /></td>
                  <td className="p-3 text-right">
                    {canMaterials && t.status === 'available' && (
                      <button type="button" onClick={() => setCheckoutTool(t)} className="px-2.5 py-1 bg-blue-700 text-white rounded">
                        Sortir / Affecter
                      </button>
                    )}
                    {canMaterials && t.status === 'assigned' && (
                      <button type="button" onClick={() => returnTool(t.id)} className="px-2.5 py-1 border border-slate-300 rounded">
                        Enregistrer retour
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={vehicleModal} onClose={() => { setVehicleModal(false); setEditingVehicle(null); }} title={editingVehicle ? 'Modifier le véhicule / engin' : 'Ajouter un véhicule / engin'} maxWidth="max-w-2xl">
        <form onSubmit={saveVehicle} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block font-medium mb-1">Désignation *</label><input required value={vehicleForm.name} onChange={e => setVehicleForm({...vehicleForm,name:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
            <div><label className="block font-medium mb-1">Immatriculation / Code *</label><input required value={vehicleForm.registration} onChange={e => setVehicleForm({...vehicleForm,registration:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
            <div><label className="block font-medium mb-1">Type</label><select value={vehicleForm.asset_type} onChange={e => setVehicleForm({...vehicleForm,asset_type:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">{[['vehicle','Véhicule'],['truck','Camion'],['excavator','Pelle mécanique'],['mixer','Bétonnière'],['compressor','Compresseur'],['pump','Pompe'],['scaffolding','Échafaudage']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className="block font-medium mb-1">Marque / Modèle</label><input value={vehicleForm.brand} onChange={e => setVehicleForm({...vehicleForm,brand:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
            <div><label className="block font-medium mb-1">Kilométrage</label><input type="number" min="0" value={vehicleForm.current_mileage} onChange={e => setVehicleForm({...vehicleForm,current_mileage:Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block font-medium mb-1">Heures moteur</label><input type="number" min="0" value={vehicleForm.current_engine_hours} onChange={e => setVehicleForm({...vehicleForm,current_engine_hours:Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block font-medium mb-1">Chauffeur</label><select value={vehicleForm.driver_worker_id} onChange={e => setVehicleForm({...vehicleForm,driver_worker_id:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option value="">Non affecté</option>{workers.map(w=><option key={w.id} value={w.id}>{w.full_name}</option>)}</select></div>
            <div><label className="block font-medium mb-1">Chantier</label><select value={vehicleForm.current_project_id} onChange={e => setVehicleForm({...vehicleForm,current_project_id:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950"><option value="">Dépôt</option>{projects.map(p=><option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>)}</select></div>
            <div><label className="block font-medium mb-1">Assurance jusqu’au</label><input type="date" value={vehicleForm.insurance_expiry} onChange={e => setVehicleForm({...vehicleForm,insurance_expiry:e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block font-medium mb-1">Contrôle technique jusqu’au</label><input type="date" value={vehicleForm.inspection_expiry} onChange={e => setVehicleForm({...vehicleForm,inspection_expiry:e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block font-medium mb-1">Statut</label><select value={vehicleForm.status} onChange={e => setVehicleForm({...vehicleForm,status:e.target.value})} className="w-full px-3 py-2 border rounded-lg"><option value="available">Disponible</option><option value="on_project">Sur chantier</option><option value="under_maintenance">En maintenance</option><option value="broken_down">En panne</option></select></div>
            <div><label className="block font-medium mb-1">Coût d’utilisation / jour (DA)</label><input type="number" min="0" value={vehicleForm.usage_rate_per_day} onChange={e => setVehicleForm({...vehicleForm,usage_rate_per_day:Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
          </div>
          <div><label className="block font-medium mb-1">Notes</label><textarea value={vehicleForm.notes} onChange={e => setVehicleForm({...vehicleForm,notes:e.target.value})} rows={2} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950" /></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={()=>{setVehicleModal(false);setEditingVehicle(null);}} className="px-3 py-2 border rounded-lg">Annuler</button><button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">{editingVehicle ? 'Enregistrer les modifications' : 'Ajouter le véhicule'}</button></div>
        </form>
      </Modal>

      <Modal open={fuelModal} onClose={() => setFuelModal(false)} title={editingFuel ? "Modifier le plein de carburant" : "Enregistrer un plein de carburant"}>
        <form onSubmit={saveFuel} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Véhicule / Engin *</label>
              <select required value={fuelForm.vehicle_id} disabled={!!editingFuel} onChange={(e) => setFuelForm({ ...fuelForm, vehicle_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="">Sélectionner...</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.registration})</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Chantier imputé</label>
              <select value={fuelForm.project_id} onChange={(e) => setFuelForm({ ...fuelForm, project_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="">Frais parc général</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Litres *</label>
              <input type="number" step="0.1" required value={fuelForm.liters} onChange={(e) => setFuelForm({ ...fuelForm, liters: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-medium mb-1">Prix / Litre (DA)</label>
              <input type="number" step="0.01" value={fuelForm.price_per_liter} onChange={(e) => setFuelForm({ ...fuelForm, price_per_liter: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-medium mb-1">Km avant</label>
              <input type="number" value={fuelForm.odometer_before} onChange={(e) => setFuelForm({ ...fuelForm, odometer_before: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-medium mb-1">Km après</label>
              <input type="number" value={fuelForm.odometer_after} onChange={(e) => setFuelForm({ ...fuelForm, odometer_after: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setFuelModal(false); setEditingFuel(null); }} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">{editingFuel ? "Enregistrer les modifications" : "Enregistrer"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={repairModal} onClose={() => setRepairModal(false)} title="Nouvel ordre de réparation">
        <form onSubmit={saveRepair} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Véhicule / Engin *</label>
              <select required value={repForm.vehicle_id} onChange={(e) => setRepForm({ ...repForm, vehicle_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="">Sélectionner...</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Catégorie</label>
              <select value={repForm.problem_category} onChange={(e) => setRepForm({ ...repForm, problem_category: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
                <option value="engine">Moteur</option>
                <option value="brakes">Freinage</option>
                <option value="hydraulic">Hydraulique</option>
                <option value="electrical">Électrique</option>
                <option value="tires">Pneumatiques</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Description de la panne *</label>
            <input type="text" required value={repForm.description} onChange={(e) => setRepForm({ ...repForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Coût pièces (DA)</label>
              <input type="number" value={repForm.parts_cost} onChange={(e) => setRepForm({ ...repForm, parts_cost: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
            <div>
              <label className="block font-medium mb-1">Main-d’œuvre atelier (DA)</label>
              <input type="number" value={repForm.labor_cost} onChange={(e) => setRepForm({ ...repForm, labor_cost: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setRepairModal(false)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Créer l’OR</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!checkoutTool} onClose={() => setCheckoutTool(null)} title={checkoutTool ? `Affecter — ${checkoutTool.name}` : ''} maxWidth="max-w-md">
        <form onSubmit={submitCheckout} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium mb-1">Ouvrier responsable *</label>
            <select required value={coForm.worker_id} onChange={(e) => setCoForm({ ...coForm, worker_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
              <option value="">Sélectionner...</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Chantier</label>
            <select value={coForm.project_id} onChange={(e) => setCoForm({ ...coForm, project_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-950">
              <option value="">Aucun</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCheckoutTool(null)} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-700 rounded-lg">Confirmer sortie</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
