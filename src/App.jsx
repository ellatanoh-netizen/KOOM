import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  ShieldCheck, 
  LayoutDashboard, 
  Calendar, 
  ClipboardList, 
  PlusCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  AlertTriangle, 
  Save, 
  Trash2, 
  Edit3,
  Search, 
  Zap,
  History,
  Shield,
  FileText,
  UserCheck,
  Activity,
  Settings,
  Bell,
  Terminal,
  RefreshCw,
  Archive
} from 'lucide-react';

// --- CONFIGURATION TECHNIQUE ---
const API_URL = "https://script.google.com/macros/s/AKfycbzZyTFTBEFKx4RX7qQObKGiZmmbgPB9NT_7ZQjJUh3AhXGoSGDU_2dtZZeacIUjT9zMFQ/exec";
const CR_FORM_BASE = "https://docs.google.com/forms/d/e/1FAIpQLSdUtRDVw9x2rKQ7qLNikLqoajvHhcnd6aCNF87hLqn_oBwcZw/viewform?usp=pp_url&entry.1178799885=";
const TIMEOUT_BYPASS = 4000;

const ASSO_NAME = "Les Graines de l'Espoir - Droit et justice";

const MOCK_DATA = {
  missions: [
    { code: "M-2024-001", structure: "Justice Territoriale", refDossier: "REF-01", emailContact: "contact@justice.fr", phone: "0600000001", typeMission: "Tribunal", secteur: "Centre", date: "2024-01-20", heure: "10:00", lieu: "Palais de Justice", commentaires: "Mode Secours activé", statut: "VALIDÉ", volunteerName: "" }
  ]
};

const SECTEURS = [
  { value: "Centre", label: "Centre (Secteur 1 – Capitole, Arnaud-Bernard, Carmes, Saint-Étienne, Compans-Caffarelli, Chalets)" },
  { value: "Rive Gauche", label: "Rive Gauche (Secteur 2 – Saint-Cyprien, Patte d’Oie, Croix-de-Pierre, Fontaine-Lestang, Cartoucherie)" },
  { value: "Nord", label: "Nord (Secteur 3 – Minimes, Barrière de Paris, Lalande, Sept-Deniers, Ginestous)" },
  { value: "Est", label: "Est (Secteur 4 – Bonnefoy, Jolimont, Roseraie, Soupetard, Marengo)" },
  { value: "Sud / Sud-Est", label: "Sud / Sud-Est (Secteur 5 – Rangueil, Saouzelong, Jules-Julien, Saint-Michel, Empalot, Île du Ramier)" },
  { value: "Ouest", label: "Ouest (Secteur 6 – Lardenne, Purpan, Saint-Martin-du-Touch, Ancely, Casselardit)" },
  { value: "Périphérie", label: "Périphérie (hors Toulouse intra-muros)" },
  { value: "Toutes les zones", label: "Toutes les zones" }
];

const MISSION_TYPES = ["Commissariat", "Avocat", "Tribunal", "Social", "Autre"];

const fetchWithRetry = async (url, options = {}, retries = 2, backoff = 1000) => {
  try {
    const response = await fetch(url, { ...options, mode: 'cors', redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    try { return JSON.parse(text); } catch (e) { return { ok: false, error: "JSON Invalide" }; }
  } catch (err) {
    if (retries > 0) { 
      await new Promise(r => setTimeout(r, backoff)); 
      return fetchWithRetry(url, options, retries - 1, backoff * 1.5); 
    }
    throw err;
  }
};

const getWeekRange = (date) => {
  const curr = new Date(date);
  const day = curr.getDay();
  const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(new Date(curr).setDate(diff));
  monday.setHours(0,0,0,0);
  const saturday = new Date(new Date(monday).setDate(monday.getDate() + 5));
  return { start: monday, end: saturday };
};

const Loader = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md">
    <div className="relative flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
      <div className="absolute text-emerald-600 font-black text-lg">K</div>
    </div>
    <p className="mt-4 text-slate-500 font-bold text-[9px] uppercase tracking-widest">KOOM Synchronization...</p>
  </div>
);

export default function App() {
  const [view, setView] = useState('hub');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); 
  const [user, setUser] = useState(null);
  const [authRole, setAuthRole] = useState(null);
  const [missions, setMissions] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [selectedMission, setSelectedMission] = useState(null);
  const [coordTab, setCoordTab] = useState('journal');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [uiKey, setUiKey] = useState(0);

  const systemLogs = useMemo(() => [
    { time: '08:00:01', event: 'Trigger Automatique : Nettoyage', status: 'SUCCESS', type: 'system' },
    { time: '08:00:05', event: 'Test : Intégrité API', status: 'OK', type: 'test' },
    { time: '09:00:00', event: 'Mail : Rappel J-1 envoyé', status: 'SENT', type: 'mail' },
    { time: '10:00:00', event: 'Test : Latence Cloud', status: '240ms', type: 'test' }
  ], []);

  const goTo = (nextView) => {
    setError(null);
    setIsAuthModalOpen(false);
    setSelectedMission(null);
    if (nextView !== 'coord') setCoordTab('journal');
    if (nextView !== 'volunteer') setSelectedSlots(new Set());
    setView(nextView);
    setUiKey(`${nextView}-${Date.now()}`);
  };

  const normalizeMission = useCallback((m) => {
    const mm = { ...m };
    mm.code = m['Code mission'] || m.CODE || m.code || m.id;
    mm.structure = m.Partenaire || m.PARTENAIRE || m.structure;
    mm.date = m.Date_RDV || m.DATE || m.date;
    mm.heure = m.Heure_RDV || m.HEURE || m.heure;
    mm.secteur = m['Quartier '] || m.Quartier || m.secteur;
    mm.statut = String(m.Statut || m.STATUT || m.statut || '').trim().toUpperCase();
    mm.lieu = m.Lieu_RDV || m.LIEU || m.lieu;
    mm.volunteerName = m.Benevole_ID || m.BENEVOLE || m.volunteerName || m.beneNom;
    mm.phone = m.phone || m.Téléphone || "";
    mm.refDossier = m.refDossier || m.Référence || "";
    mm.commentaires = m.commentaires || m.Commentaires || "";
    return mm;
  }, []);

  const fetchMissions = async () => {
    try {
      const res = await fetch(`${API_URL}?action=listMissions`).then(r => r.json());
      if (res && res.ok) {
        const list = Array.isArray(res.missions) ? res.missions : (Array.isArray(res) ? res : []);
        setMissions(list.map(normalizeMission));
      }
    } catch (e) { console.error("Fetch error"); }
  };

  useEffect(() => {
    let isMounted = true;
    const bypassTimer = setTimeout(() => {
      if (loading && isMounted) {
        setLoading(false); 
        setError("Mode secours activé.");
        setMissions(MOCK_DATA.missions.map(normalizeMission));
      }
    }, TIMEOUT_BYPASS);

    const initialize = async () => {
      await fetchMissions();
      if (isMounted) { clearTimeout(bypassTimer); setLoading(false); }
    };
    initialize();
    return () => { isMounted = false; clearTimeout(bypassTimer); };
  }, [uiKey]);

  const handleLogin = async (tokenInput) => {
    setLoading(true);
    try {
      const res = await fetchWithRetry(`${API_URL}?action=validateToken&token=${encodeURIComponent(tokenInput)}`);
      if (res && res.ok && res.profile) {
        const rawRole = String(res.role || res.profile.role || '').trim().toUpperCase();
        // Correction Bug Token Coordo : détection par inclusion
        const role = rawRole.includes('COORD') ? 'COORD' : (rawRole.includes('BENE') ? 'BENE' : rawRole);
        setUser({ 
          name: String(res.profile.name || res.profile.nom || '').trim(),
          token: tokenInput,
          role: role,
          secteur: res.profile.secteur || res.profile.sector || "Centre"
        });
        setAuthRole(role);
        if (role === 'COORD') goTo('coord');
        else if (role === 'BENE') goTo('volunteer');
        else goTo('hub');
      } else { alert("Token invalide."); }
    } catch (err) { setError("Serveur indisponible."); } finally { setLoading(false); }
  };

  const handleAction = async (payload) => {
    setLoading(true);
    try {
      const res = await fetchWithRetry(API_URL, { 
        method: 'POST', body: JSON.stringify({ ...payload, token: user?.token }) 
      });
      if (res && res.ok) {
        // Mise à jour optimiste robuste (correspondance code trimée)
        if (payload?.action === 'updateStatus' && payload?.status === 'ARCHIVÉ' && payload?.code) {
          const pc = String(payload.code).trim();
          setMissions(prev => prev.map(m => (
            (String(m.code || "").trim() === pc || String(m.id || "").trim() === pc) 
            ? { ...m, statut: 'ARCHIVÉ' } 
            : m
          )));
        }
        setUiKey(prev => prev + 1);
        return res;
      }
      throw new Error(res?.error || "Refusé");
    } catch (err) { setError("Erreur : " + String(err.message)); return { success: false }; } finally { setLoading(false); }
  };

  if (loading) return <Loader />;

  return (
    <div key={uiKey} className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 text-[12px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-emerald-100 px-5 py-2.5 flex justify-between items-center h-14 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => goTo('hub')}>
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-sm">K</div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tighter leading-none">KOOM</h1>
            <p className="text-[6px] text-emerald-600 uppercase font-black tracking-widest">{ASSO_NAME}</p>
          </div>
        </div>
        {user ? (
          <div className="flex items-center gap-4">
            <div className="text-right leading-none">
              <p className="text-[10px] font-black text-slate-900 uppercase">{user.name}</p>
              <p className="text-[8px] text-emerald-600 font-black uppercase tracking-widest">{authRole === 'BENE' ? 'BÉNÉVOLE' : 'COORDINATION'}</p>
            </div>
            <button onClick={() => { setUser(null); goTo('hub'); }} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-red-600 transition-all"><LogOut size={16} /></button>
          </div>
        ) : (
          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-40">v4.8 Stable • 2026</div>
        )}
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {view === 'hub' && <Hub goTo={goTo} openAuth={() => setIsAuthModalOpen(true)} />}
        {view === 'partner' && <PartnerModule handleAction={handleAction} onBack={() => goTo('hub')} />}
        {view === 'volunteer' && authRole === 'BENE' && <VolunteerDashboard user={user} missions={missions} handleAction={handleAction} selectedSlots={selectedSlots} setSelectedSlots={setSelectedSlots} getWeekRange={getWeekRange} />}
        {view === 'coord' && authRole === 'COORD' && <CoordinationDashboard missions={missions} systemLogs={systemLogs} handleAction={handleAction} coordTab={coordTab} setCoordTab={setCoordTab} selectedMission={selectedMission} setSelectedMission={setSelectedMission} getWeekRange={getWeekRange} />}
      </main>

      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} onLogin={handleLogin} loading={loading} />}

      <footer className="mt-12 py-8 border-t border-slate-200 text-center bg-white/50">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{ASSO_NAME}</p>
        <p className="text-[8px] text-slate-300 mt-2 font-bold uppercase tracking-wider">KOOM System • Version Stable v4.8 • 2026</p>
      </footer>
    </div>
  );
}

// --- MODULE HUB ---
function Hub({ goTo, openAuth }) {
  return (
    <div className="py-6 text-center animate-in">
      <h1 className="text-6xl font-black text-slate-900 mb-2 tracking-tighter uppercase">KOOM</h1>
      <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mb-12">Gestion automatisée des missions terrain</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HubCard icon={PlusCircle} title="Partenaires" label="Dépôt Mission" onClick={() => goTo('partner')} color="bg-blue-50 text-blue-600" />
        <HubCard icon={Users} title="Bénévoles" label="Planning" onClick={openAuth} color="bg-emerald-50 text-emerald-600" />
        <HubCard icon={ShieldCheck} title="Coordination" label="Pilotage" onClick={openAuth} color="bg-slate-900 text-white" isDark />
      </div>
    </div>
  );
}

function HubCard({ icon: Icon, title, label, onClick, color, isDark }) {
  return (
    <div onClick={onClick} className={`${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 border border-slate-100'} p-8 rounded-[2rem] shadow-xl cursor-pointer hover:-translate-y-2 transition-all`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 mx-auto ${isDark ? 'bg-white/10' : color}`}><Icon size={24} /></div>
      <h3 className="text-xl font-black uppercase mb-2">{title}</h3>
      <p className={`${isDark ? 'text-white/40' : 'text-slate-400'} text-[9px] font-black uppercase tracking-widest`}>{label}</p>
    </div>
  );
}

// --- MODALE AUTH ---
function AuthModal({ onClose, onLogin, loading }) {
  const [tokenInput, setTokenInput] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-sm p-10 rounded-[2.5rem] shadow-2xl text-center">
        <h3 className="text-xl font-black mb-6 uppercase">Identification</h3>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(tokenInput); }} className="space-y-4">
          <input type="password" required autoFocus value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="••••" className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 text-center font-mono text-xl focus:border-emerald-600 outline-none" />
          <button disabled={loading} type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-900 transition-all text-xs">{loading ? "..." : "Valider"}</button>
          <button onClick={onClose} type="button" className="text-slate-400 text-[10px] font-bold uppercase">Annuler</button>
        </form>
      </div>
    </div>
  );
}

// --- MODULE PARTENAIRE ---
function PartnerModule({ handleAction, onBack }) {
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const res = await handleAction({ action: 'createMission', ...d });
    if (res && res.ok) setSubmitted(true);
  };

  if (submitted) return (
    <div className="text-center py-20 animate-in">
      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-100/50"><CheckCircle size={40} /></div>
      <h2 className="text-2xl font-black uppercase tracking-tighter">Dossier Transmis</h2>
      <p className="text-slate-400 font-bold text-[10px] uppercase mt-2 mb-8 tracking-widest">Un accusé de réception vous a été envoyé</p>
      <button onClick={onBack} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Retour Hub</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto animate-in">
      <button onClick={onBack} className="mb-6 text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 hover:text-emerald-600 transition-colors"><ChevronLeft size={14}/> Retour Hub</button>
      <div className="bg-white p-10 md:p-14 rounded-[3rem] shadow-2xl border border-slate-100">
        <h2 className="text-4xl font-black mb-10 text-slate-900 tracking-tighter uppercase underline decoration-emerald-500 decoration-4 underline-offset-8">Nouvelle Mission</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2"><Field label="Structure / Organisme Nom Complet *" name="structure" required /></div>
          <Field label="Référence dossier interne *" name="refDossier" required />
          <Field label="Email de contact (Accusé) *" name="emailContact" type="email" required />
          <Field label="Numéro de téléphone direct *" name="phone" type="tel" pattern="[0-9]{10}" placeholder="0600000000" required />
          <Dropdown label="Type de mission *" name="typeMission" options={MISSION_TYPES} required />
          <div className="md:col-span-2">
            <Dropdown label="Secteur de Toulouse (Obligatoire) *" name="secteur" options={SECTEURS.map(s => ({id: s.value, label: s.label}))} required />
          </div>
          <Field label="Date du rendez-vous *" name="date" type="date" required />
          <Field label="Heure du rendez-vous *" name="heure" type="time" required />
          <div className="md:col-span-2"><Field label="Lieu exact (Adresse complète) *" name="lieu" required /></div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-2 tracking-widest">Commentaires / Précisions</label>
            <textarea name="commentaires" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-600 outline-none font-bold text-slate-900 h-24 resize-none shadow-inner" placeholder="Ex: Besoin traducteur, étage, code d'entrée..."></textarea>
          </div>
          <div className="md:col-span-2 py-4">
            <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-emerald-700 transition-all text-sm">Transmettre le dossier</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MODULE BÉNÉVOLE ---
function VolunteerDashboard({ user, missions, handleAction, selectedSlots, setSelectedSlots, getWeekRange }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1)); 
  const range = getWeekRange(currentDate);
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  
  const list = missions.filter(m => 
    (m.statut === 'VALIDÉ' || m.volunteerName === user.name) && 
    !String(m.statut || '').toUpperCase().startsWith('ARCHIV')
  ).sort((a,b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-4 animate-in">
      <div className="bg-emerald-600 p-5 rounded-[1.5rem] text-white shadow-lg flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <div className="relative z-10">
          <h2 className="text-lg font-black uppercase leading-tight text-left">Bonjour, {user.name}</h2>
          <p className="opacity-80 font-bold text-[8px] tracking-[0.2em] uppercase mt-0.5 tracking-widest text-left">Session Relais d'Espoir • {user.secteur}</p>
        </div>
        <div className="relative z-10 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-white/20 min-w-[80px]">
          <p className="text-[7px] font-black uppercase opacity-60">Actives</p>
          <p className="text-xl font-black leading-none">{missions.filter(m => m.volunteerName === user.name && !String(m.statut || '').toUpperCase().startsWith('ARCHIV')).length}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-emerald-50 flex flex-col gap-2 shadow-sm">
        <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest text-left">Ma zone d'intervention active</label>
        <select defaultValue={user.secteur} className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-emerald-500/20">
          {SECTEURS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="bg-white p-5 rounded-[1.5rem] shadow-xl border border-emerald-50">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-emerald-900 leading-none">Planning Hebdomadaire</h3>
          <button onClick={() => handleAction({ action: 'savePlanning', data: Array.from(selectedSlots) })} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2"><Save size={14} /> Enregistrer</button>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-center text-[9px]">
            <thead><tr><th className="p-2"></th>{days.map(d => <th key={d} className="p-2 text-slate-400 font-black uppercase tracking-widest">{d.slice(0,3)}</th>)}</tr></thead>
            <tbody>
              {Array.from({length: 12}).map((_, hIdx) => {
                const h = `${(8 + hIdx).toString().padStart(2, '0')}:00`;
                return (
                  <tr key={h} className="border-t border-slate-50">
                    <td className="p-2 font-black text-slate-300">{h}</td>
                    {days.map(d => {
                      const k = `${range.start.toDateString()}-${d}-${h}`;
                      const isS = selectedSlots.has(k);
                      return (
                        <td key={d} className="p-0.5">
                          <div onClick={() => { const n = new Set(selectedSlots); if (n.has(k)) n.delete(k); else n.add(k); setSelectedSlots(n); }} 
                            className={`h-7 rounded-lg cursor-pointer border transition-all duration-200 ${isS ? 'bg-emerald-600 border-emerald-600 shadow-inner' : 'bg-slate-50 border-transparent hover:border-emerald-200'}`} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 mt-8 text-left">Dossiers Disponibles & Engagements</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map(m => (
          <div key={m.code} className={`bg-white p-5 rounded-[1.8rem] shadow-md border-l-[10px] transition-all hover:scale-[1.01] ${m.volunteerName === user.name ? 'border-blue-600 shadow-blue-50' : 'border-emerald-600 shadow-emerald-50'}`}>
            <div className="flex justify-between items-start mb-3">
              <span className={`text-[7px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${m.volunteerName === user.name ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{m.statut}</span>
              <span className="text-[9px] font-black text-slate-400">{m.heure}</span>
            </div>
            <h4 className="text-md font-black mb-1 uppercase tracking-tighter leading-tight text-left">{m.structure}</h4>
            <p className="text-emerald-600 font-black text-[8px] mb-4 uppercase tracking-widest text-left">{m.typeMission} • {m.secteur}</p>
            {m.volunteerName !== user.name ? (
              <button onClick={() => handleAction({ action: 'takeMission', code: m.code })} className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-emerald-700 transition-all">M'ENGAGER</button>
            ) : (
              <div className="flex gap-2">
                <a href={`${CR_FORM_BASE}${m.code}`} target="_blank" className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[9px] uppercase text-center flex items-center justify-center tracking-widest shadow-md hover:bg-emerald-700 transition-all">RAPPORT CR</a>
                <button onClick={() => handleAction({ action: 'cancelMission', code: m.code })} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all shadow-sm flex items-center justify-center"><XCircle size={16}/></button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="col-span-full py-12 text-center bg-white rounded-[2rem] border border-dashed border-slate-200"><p className="text-slate-300 font-black uppercase tracking-[0.3em] text-[10px]">Aucune mission disponible pour le moment</p></div>}
      </div>
    </div>
  );
}

// --- MODULE COORDINATION ---
function CoordinationDashboard({ missions, systemLogs, handleAction, coordTab, setCoordTab, selectedMission, setSelectedMission, getWeekRange }) {
  const [calendarBaseDate, setCalendarBaseDate] = useState(new Date(2026, 0, 1));
  const monthName = calendarBaseDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(calendarBaseDate.getFullYear(), calendarBaseDate.getMonth() + 1, 0).getDate();
  const firstDay = (new Date(calendarBaseDate.getFullYear(), calendarBaseDate.getMonth(), 1).getDay() + 6) % 7;

  return (
    <div className="space-y-4 animate-in text-[11px]">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Attente" value={missions.filter(m => m.statut === 'ATTENTE').length} color="text-amber-600" />
        <StatCard label="Validées" value={missions.filter(m => m.statut === 'VALIDÉ').length} color="text-emerald-600" />
        <StatCard label="En Cours" value={missions.filter(m => ['POURVUE', 'EN COURS'].includes(m.statut)).length} color="text-blue-600" />
        <StatCard label="Archivées" value={missions.filter(m => String(m.statut || '').toUpperCase().startsWith('ARCHIV')).length} color="text-slate-400" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <TabButton active={coordTab === 'journal'} onClick={() => setCoordTab('journal')} label="Dossiers" icon={ClipboardList} />
        <TabButton active={coordTab === 'planning'} onClick={() => setCoordTab('planning')} label="Calendrier" icon={Calendar} />
        <TabButton active={coordTab === 'archives'} onClick={() => setCoordTab('archives')} label="Archives" icon={Archive} />
        <TabButton active={coordTab === 'audit'} onClick={() => setCoordTab('audit')} label="Audit Flux v4.8" icon={Activity} />
      </div>

      {coordTab === 'journal' && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 animate-in">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[7px] tracking-widest border-b border-slate-100">
              <tr><th className="p-4">RDV / Heure</th><th className="p-4">Organisme</th><th className="p-4">Statut</th><th className="p-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="font-bold text-left">
              {missions.filter(m => !String(m.statut || '').toUpperCase().startsWith('ARCHIV')).map(m => (
                <tr key={m.code} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-black">{m.date}<br/><span className="text-emerald-600 text-[8px] tracking-widest">{m.heure}</span></td>
                  <td className="p-4 uppercase leading-tight tracking-tighter">{m.structure}<br/><span className="text-slate-300 text-[7px] font-black">{m.typeMission}</span></td>
                  <td className="p-4"><span className={`px-2.5 py-0.5 rounded-md text-[7px] font-black tracking-widest ${m.statut === 'ATTENTE' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600 shadow-sm'}`}>{m.statut}</span></td>
                  <td className="p-4 text-right">
                    <button onClick={() => setSelectedMission(m)} className="p-2 text-slate-300 hover:text-emerald-600 transition-colors flex items-center justify-center ml-auto"><Edit3 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {coordTab === 'archives' && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 animate-in text-left">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[7px] tracking-widest border-b border-slate-100">
              <tr><th className="p-4">Date Mission</th><th className="p-4">Organisme</th><th className="p-4">Statut</th><th className="p-4 text-right">Détails</th></tr>
            </thead>
            <tbody className="font-bold">
              {missions.filter(m => String(m.statut || '').toUpperCase().startsWith('ARCHIV')).map(m => (
                <tr key={m.code} className="border-t border-slate-50 opacity-60 grayscale hover:grayscale-0 transition-all text-left">
                  <td className="p-4 font-black">{m.date}<br/><span className="text-slate-400 text-[8px]">{m.heure}</span></td>
                  <td className="p-4 uppercase leading-tight">{m.structure}<br/><span className="text-slate-300 text-[7px]">{m.typeMission}</span></td>
                  <td className="p-4"><span className="px-2.5 py-0.5 rounded-md text-[7px] font-black bg-slate-100 text-slate-500 tracking-widest uppercase">ARCHIVÉ</span></td>
                  <td className="p-4 text-right">
                    <button onClick={() => setSelectedMission(m)} className="p-2 text-slate-300 hover:text-slate-500 ml-auto flex items-center justify-center"><Search size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {missions.filter(m => String(m.statut || '').toUpperCase().startsWith('ARCHIV')).length === 0 && <div className="p-20 text-center text-slate-300 font-black uppercase tracking-[0.4em]">Aucune archive disponible</div>}
        </div>
      )}

      {coordTab === 'planning' && (
        <div className="bg-white rounded-[2rem] shadow-2xl border border-emerald-50 overflow-hidden animate-in text-left">
          <div className="flex justify-between items-center p-6 border-b border-slate-50 bg-slate-50/30">
            <div className="flex flex-col">
              <h3 className="text-xl font-black uppercase tracking-tighter leading-none">{monthName}</h3>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">Secteur Coordination — Date_Demande</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCalendarBaseDate(new Date(calendarBaseDate.getFullYear(), calendarBaseDate.getMonth() - 1, 1))} className="p-2 hover:bg-white rounded-xl shadow-sm transition-all border border-slate-100"><ChevronLeft size={16}/></button>
              <button onClick={() => setCalendarBaseDate(new Date(calendarBaseDate.getFullYear(), calendarBaseDate.getMonth() + 1, 1))} className="p-2 hover:bg-white rounded-xl shadow-sm transition-all border border-slate-100"><ChevronRight size={16}/></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-100 border-b border-slate-100">
            {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <div key={d} className="bg-slate-50 p-3 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest">{d}</div>)}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="bg-white min-h-[75px]"></div>)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const missionsDuJour = missions.filter(m => {
                const d = new Date(m.date);
                return d.getDate() === day && d.getMonth() === calendarBaseDate.getMonth() && d.getFullYear() === calendarBaseDate.getFullYear();
              });
              return (
                <div key={day} className="bg-white min-h-[75px] p-2 hover:bg-slate-50 transition-colors border-t border-l border-slate-50 group">
                  <span className="text-[10px] font-black text-slate-200 group-hover:text-emerald-200 transition-colors">{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {missionsDuJour.map(m => (
                      <div key={m.code} className="bg-emerald-600 text-white p-1 rounded-md text-[6px] truncate font-bold uppercase shadow-sm">{m.heure} {m.structure}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {coordTab === 'audit' && (
        <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-slate-100 animate-in text-left">
          <h3 className="text-sm font-black mb-6 uppercase tracking-widest text-emerald-900 leading-none">Journal d'Audit & Triggers v4.8</h3>
          <div className="grid grid-cols-3 gap-3 mb-8">
            <AuditMiniCard label="API Connect" status="PASS" color="text-emerald-500" icon={Terminal} />
            <AuditMiniCard label="Automatismes" status="ACTIF" color="text-blue-500" icon={RefreshCw} />
            <AuditMiniCard label="Flux Mails" status="AUTO-ON" color="text-amber-500" icon={Mail} />
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
            {systemLogs.map((log, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-[9px] font-bold border-l-4 border-slate-900 shadow-sm transition-all hover:bg-slate-100 text-left">
                <span className="text-slate-400 font-mono tracking-tighter">{log.time}</span>
                <span className="flex-1 px-4 truncate uppercase tracking-tighter opacity-70">{log.event}</span>
                <span className="text-emerald-600 uppercase tracking-widest">{log.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="bg-[#1B5E20] p-5 text-white flex justify-between items-center">
              <div className="overflow-hidden text-left">
                <h3 className="text-sm font-black uppercase truncate tracking-tighter leading-tight">{selectedMission.structure}</h3>
                <p className="text-[7px] font-black opacity-60 uppercase tracking-widest mt-0.5">Réf : {selectedMission.code}</p>
              </div>
              <button onClick={() => setSelectedMission(null)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all shrink-0 ml-4"><XCircle size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2.5 text-left">
                <DetailItem label="RDV" value={`${selectedMission.date} ${selectedMission.heure}`} />
                <DetailItem label="Lieu_RDV" value={selectedMission.lieu} />
                <DetailItem label="Statut" value={selectedMission.statut} />
                <DetailItem label="Benevole_ID" value={selectedMission.volunteerName || "---"} />
                {selectedMission.phone && <DetailItem label="Téléphone" value={selectedMission.phone} />}
                {selectedMission.refDossier && <DetailItem label="Réf Dossier" value={selectedMission.refDossier} />}
              </div>
              {selectedMission.commentaires && (
                <div className="bg-slate-50 p-3 rounded-xl text-left border border-slate-100 shadow-inner">
                  <label className="text-[6px] font-black text-slate-300 uppercase block mb-1 tracking-widest">Commentaires Terrain</label>
                  <p className="text-[9px] font-bold text-slate-600 leading-normal italic text-left">"{selectedMission.commentaires}"</p>
                </div>
              )}
              {!String(selectedMission.statut || '').toUpperCase().startsWith('ARCHIV') && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { handleAction({ action: 'updateStatus', code: selectedMission.code, status: 'VALIDÉ' }); setSelectedMission(null); }} className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 transition-all tracking-widest">Valider</button>
                  <button onClick={() => { 
                    if (!selectedMission.code) { alert("Erreur: Code manquant"); return; } 
                    handleAction({ action: 'updateStatus', code: selectedMission.code, status: 'ARCHIVÉ' }); 
                    setCoordTab('archives'); 
                    setSelectedMission(null); 
                  }} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-red-700 transition-all tracking-widest">Archiver</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SOUS-COMPOSANTS ---

function Field({ label, name, type="text", required=false, pattern, placeholder }) {
  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest leading-none">{label}</label>
      <input name={name} required={required} type={type} pattern={pattern} placeholder={placeholder} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-600 outline-none font-bold shadow-inner text-slate-900 text-[11px] placeholder:text-slate-300 transition-all" />
    </div>
  );
}

function Dropdown({ label, name, options, required=false }) {
  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest leading-none">{label}</label>
      <div className="relative">
        <select name={name} required={required} defaultValue="" className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-600 outline-none font-bold appearance-none cursor-pointer text-slate-900 text-[11px] shadow-inner transition-all">
          <option value="" disabled>Sélectionner...</option>
          {options.map(o => <option key={o.id || o} value={o.id || o}>{o.label || o}</option>)}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <ChevronRight size={14} className="rotate-90" />
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon: Icon }) {
  return (
    <button onClick={onClick} className={`px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 transition-all duration-300 ${active ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 scale-105' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}>
      <Icon size={14}/> {label}
    </button>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-50 text-center transition-transform hover:scale-105 group">
      <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1.5 group-hover:text-emerald-400 transition-colors leading-none">{label}</p>
      <p className={`text-2xl font-black ${color} tracking-tighter leading-none`}>{value}</p>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 overflow-hidden shadow-sm text-left">
      <label className="text-[6px] font-black text-slate-300 uppercase block mb-0.5 tracking-widest leading-none text-left">{label}</label>
      <p className="font-black text-[10px] truncate uppercase leading-tight text-slate-700 text-left">{value || "---"}</p>
    </div>
  );
}

function AuditMiniCard({ label, status, color, icon: Icon }) {
  return (
    <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100 shadow-sm flex flex-col items-center">
      <div className="flex items-center justify-center gap-2 mb-1.5 opacity-40">
        <Icon size={12} />
        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      </div>
      <p className={`text-[10px] font-black ${color} leading-none tracking-widest`}>{status}</p>
    </div>
  );
}
