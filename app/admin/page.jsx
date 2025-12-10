"use client";
import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, LayoutDashboard, Package, Activity, 
  MessageSquare, Megaphone, LogOut, Plus, Search, 
  RotateCcw, Printer, Trash2, Send, X, Save, CheckCircle, AlertCircle
} from 'lucide-react';

// --- CONFIGURATION ---
// This matches your existing backend auth check
const AUTH_CHECK_ENDPOINT = '/api/admin?action=check'; 

export default function AdminApp() {
  const [authHeader, setAuthHeader] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('plans'); // plans, tx, complaints, msg
  
  // Login State
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Data State
  const [plans, setPlans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  
  // Modals
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null); // If set, shows receipt modal

  // --- AUTHENTICATION ---

  const handleLogin = async () => {
    if (!loginUser || !loginPass) return alert("Enter credentials");
    setIsLoading(true);
    const creds = 'Basic ' + btoa(loginUser + ':' + loginPass);
    
    try {
      const res = await fetch(AUTH_CHECK_ENDPOINT, { 
        headers: { 'Authorization': creds } 
      });
      
      if (res.ok) {
        setAuthHeader(creds);
        setIsAuthenticated(true);
        // Load initial data immediately after login
        loadPlans(creds);
        loadStatus();
      } else {
        alert("Access Denied: Invalid Credentials");
      }
    } catch (e) {
      alert("Connection Error to Backend");
    } finally {
      setIsLoading(false);
    }
  };

  // --- DATA FETCHING ---
  
  const loadPlans = async (creds = authHeader) => {
    try {
      const res = await fetch('/api/plans');
      const data = await res.json();
      setPlans(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
  };
  
  const loadTx = async (search = '') => {
    setIsLoading(true);
    try {
      let url = '/api/admin?action=transactions';
      if(search) url += `&search=${search}`;
      const res = await fetch(url, { headers: { 'Authorization': authHeader } });
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
    setIsLoading(false);
  };
  
  const loadComplaints = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin?action=complaints', { headers: { 'Authorization': authHeader } });
      const data = await res.json();
      setComplaints(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
    setIsLoading(false);
  };
  
  const loadStatus = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if(data.message) setBroadcastMsg(data.message);
      } catch(e) {}
  };

  // --- ACTIONS ---

  const savePlan = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = {
      action: 'create',
      id: formData.get('id'),
      network: formData.get('network'),
      name: formData.get('name'),
      price: formData.get('price'),
      plan_id_api: formData.get('api_id')
    };
    
    await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify(body)
    });
    setShowPlanModal(false);
    loadPlans();
  };
  
  const deletePlan = async (id) => {
      if(!confirm("Delete this plan configuration?")) return;
      await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ action: 'delete', id })
    });
    loadPlans();
  };
  
  const retryTx = async (id) => {
      if(!confirm("Retry this transaction?")) return;
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ action: 'retry', id })
      });
      const d = await res.json();
      if(d.success) { alert("Retry Successful"); loadTx(); }
      else alert("Retry Failed: " + d.error);
  };
  
  const resolveComplaint = async (id) => {
      if(!confirm("Mark as resolved?")) return;
      await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
          body: JSON.stringify({ action: 'delete_complaint', id })
      });
      loadComplaints();
  };
  
  const sendManual = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const body = {
          action: 'manual',
          phone: formData.get('phone'),
          network: formData.get('network'),
          plan_id: formData.get('plan_id')
      };
      
      try {
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify(body)
        });
        const d = await res.json();
        if(d.success) { alert("Data Dispatched Successfully"); setShowManualModal(false); }
        else alert("Failed: " + d.error);
      } catch(e) { alert("Connection Error"); }
  };
  
  const saveBroadcast = async () => {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ action: 'save_message', message: broadcastMsg })
      });
      alert("Broadcast Live");
  };

  const handlePrintReceipt = () => {
      window.print();
  };

  // --- UI RENDERERS ---

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2 tracking-tight">Sauki Admin Pro</h2>
          <p className="text-white/50 text-sm mb-8">Secure Gateway Access</p>
          
          <input 
            type="text" 
            placeholder="Admin ID" 
            className="w-full bg-black/40 border border-white/10 p-4 rounded-xl mb-3 text-center text-white placeholder-white/30 focus:border-blue-500 outline-none transition-all focus:bg-black/60"
            value={loginUser}
            onChange={e => setLoginUser(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Passkey" 
            className="w-full bg-black/40 border border-white/10 p-4 rounded-xl mb-6 text-center text-white placeholder-white/30 focus:border-blue-500 outline-none transition-all focus:bg-black/60"
            value={loginPass}
            onChange={e => setLoginPass(e.target.value)}
          />
          <button 
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex justify-center"
          >
            {isLoading ? <RotateCcw className="animate-spin" /> : 'Unlock Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex font-sans overflow-hidden">
      
      {/* SIDEBAR (Desktop) */}
      <aside className="w-72 border-r border-white/10 p-6 flex flex-col hidden md:flex bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-10 pl-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-blue-500/40 shadow-lg">
            <LayoutDashboard size={18} />
          </div>
          <span className="font-bold text-lg tracking-tight">Sauki Pro</span>
        </div>
        
        <nav className="flex-1 space-y-2">
          {[
            { id: 'plans', icon: Package, label: 'Plans' },
            { id: 'tx', icon: Activity, label: 'Transactions' },
            { id: 'complaints', icon: MessageSquare, label: 'Complaints' },
            { id: 'msg', icon: Megaphone, label: 'Broadcast' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => { setActiveTab(item.id); if(item.id==='tx') loadTx(); if(item.id==='complaints') loadComplaints(); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-sm ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon size={18} /> <span>{item.label}</span>
            </button>
          ))}
        </nav>
        
        <button onClick={() => window.location.reload()} className="flex items-center gap-3 text-red-400 px-4 py-3 hover:bg-red-500/10 rounded-2xl mt-auto transition-colors text-sm font-medium">
          <LogOut size={18} /> Sign Out
        </button>
      </aside>

      {/* MOBILE NAV (Bottom) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/10 p-2 flex justify-around z-40 pb-safe">
        {[
            { id: 'plans', icon: Package },
            { id: 'tx', icon: Activity },
            { id: 'complaints', icon: MessageSquare },
            { id: 'msg', icon: Megaphone }
        ].map((item) => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); if(item.id==='tx') loadTx(); if(item.id==='complaints') loadComplaints(); }} 
            className={`p-3 rounded-xl ${activeTab === item.id ? 'text-blue-500 bg-white/10' : 'text-white/50'}`}>
                <item.icon size={24} />
            </button>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative bg-gradient-to-br from-black to-slate-900">
        
        {/* PLANS TAB */}
        {activeTab === 'plans' && (
          <div className="max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Plan Management</h1>
                <p className="text-white/40 mt-1">Configure pricing & API mapping</p>
              </div>
              <button onClick={() => { setEditingPlan(null); setShowPlanModal(true); }} className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all backdrop-blur-md">
                <Plus size={18} /> New Plan
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map(p => (
                <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors group relative overflow-hidden">
                    <div className={`absolute top-0 right-0 p-2 opacity-10 font-black text-6xl group-hover:scale-110 transition-transform ${p.network === 'mtn' ? 'text-yellow-400' : p.network === 'glo' ? 'text-green-500' : 'text-red-500'}`}>
                        {p.network[0].toUpperCase()}
                    </div>
                    <div className="relative z-10">
                        <span className="text-xs font-bold uppercase tracking-wider text-white/40 border border-white/10 px-2 py-0.5 rounded-md mb-2 inline-block">{p.network}</span>
                        <h3 className="text-xl font-bold mb-1">{p.name}</h3>
                        <p className="text-blue-400 font-mono mb-4 text-lg">₦{p.price}</p>
                        <div className="flex gap-2 text-xs font-mono text-white/30 mb-4">ID: {p.id} • API: {p.plan_id_api}</div>
                        <div className="flex gap-2">
                            <button onClick={() => { setEditingPlan(p); setShowPlanModal(true); }} className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-sm font-medium">Edit</button>
                            <button onClick={() => deletePlan(p.id)} className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg"><Trash2 size={16}/></button>
                        </div>
                    </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === 'tx' && (
          <div className="max-w-6xl mx-auto animate-in fade-in zoom-in-95 duration-300 pb-20">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
                <p className="text-white/40 mt-1">Live feed of all data processing</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                  <div className="flex-1 md:w-64 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                      <input 
                        placeholder="Search ref or phone..." 
                        onKeyDown={(e) => e.key === 'Enter' && loadTx(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                  </div>
                  <button onClick={() => setShowManualModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-blue-600/20">
                    <Send size={16} /> Manual
                  </button>
                  <button onClick={() => loadTx()} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl">
                    <RotateCcw size={18} />
                  </button>
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
               <div className="overflow-x-auto">
               <table className="w-full text-left">
                <thead className="bg-black/20 text-white/40 text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-4">Time</th>
                    <th className="p-4">Reference</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Plan</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                   {isLoading ? (
                       <tr><td colSpan="6" className="p-8 text-center text-white/40"><RotateCcw className="animate-spin inline mr-2"/> Loading...</td></tr>
                   ) : transactions.map(t => (
                       <tr key={t.id} className="hover:bg-white/5 text-sm transition-colors group">
                           <td className="p-4 text-white/50 whitespace-nowrap">{new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} <br/> <span className="text-[10px]">{new Date(t.created_at).toLocaleDateString()}</span></td>
                           <td className="p-4 font-mono text-white/40 text-xs">{t.reference}</td>
                           <td className="p-4 font-medium">{t.phone_number}</td>
                           <td className="p-4">{t.plan_id}</td>
                           <td className="p-4">
                               <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold w-fit ${t.status === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>
                                   {t.status === 'success' ? <CheckCircle size={12}/> : <AlertCircle size={12}/>}
                                   {t.status}
                               </span>
                           </td>
                           <td className="p-4 text-right">
                               <div className="flex justify-end gap-2">
                                   <button onClick={() => setReceiptData(t)} title="Receipt" className="p-2 hover:bg-white/10 rounded-lg text-blue-400 transition-colors">
                                       <Printer size={16} />
                                   </button>
                                   {t.status !== 'success' && (
                                       <button onClick={()=>retryTx(t.id)} title="Retry" className="p-2 hover:bg-white/10 rounded-lg text-orange-400 transition-colors">
                                           <RotateCcw size={16} />
                                       </button>
                                   )}
                               </div>
                           </td>
                       </tr>
                   ))}
                </tbody>
               </table>
               </div>
            </div>
          </div>
        )}

        {/* BROADCAST & COMPLAINTS */}
        {activeTab === 'msg' && (
             <div className="max-w-xl mx-auto mt-10 animate-in fade-in zoom-in-95">
                 <h1 className="text-3xl font-bold mb-6">System Broadcast</h1>
                 <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
                     <label className="block text-white/40 text-sm mb-3">Announcement Message</label>
                     <textarea 
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none h-32 resize-none placeholder-white/20"
                        value={broadcastMsg}
                        onChange={e => setBroadcastMsg(e.target.value)}
                        placeholder="Type message here to show on user dashboard..."
                     ></textarea>
                     <div className="flex justify-between items-center mt-6">
                         <span className="text-white/30 text-xs">Updates immediately</span>
                         <button onClick={saveBroadcast} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-600/20 transition-all active:scale-95">
                             <Save size={18} /> Publish Update
                         </button>
                     </div>
                 </div>
             </div>
        )}

        {activeTab === 'complaints' && (
            <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95">
                <h1 className="text-3xl font-bold mb-6">User Complaints</h1>
                <div className="space-y-4">
                    {complaints.length === 0 && <p className="text-white/30 text-center py-10">No active complaints.</p>}
                    {complaints.map(c => (
                        <div key={c.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl flex justify-between items-start gap-4">
                            <div>
                                <h3 className="font-bold text-lg">{c.name || 'Anonymous'} <span className="text-white/40 font-normal text-sm ml-2">{c.phone}</span></h3>
                                <p className="text-white/80 mt-1">{c.message}</p>
                                <p className="text-white/20 text-xs mt-3">{new Date(c.created_at).toLocaleString()}</p>
                            </div>
                            <button onClick={() => resolveComplaint(c.id)} className="bg-white/10 hover:bg-green-500/20 hover:text-green-400 text-white/60 px-4 py-2 rounded-xl text-xs font-bold transition-all">
                                Mark Resolved
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </main>

      {/* --- MODALS --- */}

      {/* RECEIPT MODAL */}
      {receiptData && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white text-black w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
                  <button onClick={() => setReceiptData(null)} className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                  
                  {/* PRINTABLE AREA */}
                  <div id="receipt-area" className="text-center pt-4 pb-6">
                      <div className="w-16 h-16 bg-slate-900 rounded-xl mx-auto flex items-center justify-center mb-4">
                          <span className="text-white font-black text-xl">S</span>
                      </div>
                      <h2 className="text-2xl font-black mb-1">TRANSACTION RECEIPT</h2>
                      <p className="text-slate-500 text-xs font-bold mb-6 uppercase tracking-widest">Sauki Data Links</p>
                      
                      <div className="space-y-3 text-sm border-t border-b border-dashed border-slate-300 py-6 mb-6">
                          <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-bold text-green-600 uppercase">{receiptData.status}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-bold">{new Date(receiptData.created_at).toLocaleDateString()}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Time</span><span className="font-bold">{new Date(receiptData.created_at).toLocaleTimeString()}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono font-bold text-xs">{receiptData.reference}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Recipient</span><span className="font-bold">{receiptData.phone_number}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Plan ID</span><span className="font-bold">{receiptData.plan_id}</span></div>
                      </div>
                      
                      <p className="text-xs text-slate-400">Computer Generated Receipt</p>
                  </div>
                  
                  <button onClick={handlePrintReceipt} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex justify-center gap-2 hover:bg-slate-800 transition-colors">
                      <Printer size={18} /> Print / Save PDF
                  </button>
                  
                  <style jsx global>{`
                      @media print {
                          body * { visibility: hidden; }
                          #receipt-area, #receipt-area * { visibility: visible; }
                          #receipt-area { position: absolute; left: 0; top: 0; width: 100%; }
                      }
                  `}</style>
              </div>
          </div>
      )}

      {/* PLAN MODAL */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{editingPlan ? 'Edit Configuration' : 'New Plan'}</h3>
                    <button onClick={() => setShowPlanModal(false)}><X className="text-white/40 hover:text-white" /></button>
                </div>
                <form onSubmit={savePlan} className="space-y-4">
                    <input name="id" defaultValue={editingPlan?.id} placeholder="Internal ID (e.g. mtn-1gb)" className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-blue-500" required />
                    <div className="flex gap-3">
                        <select name="network" defaultValue={editingPlan?.network} className="bg-black/50 border border-white/10 p-4 rounded-xl text-white flex-1 outline-none">
                            <option value="mtn">MTN</option>
                            <option value="glo">Glo</option>
                            <option value="airtel">Airtel</option>
                        </select>
                        <input name="price" type="number" defaultValue={editingPlan?.price} placeholder="Price" className="w-24 bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-blue-500" required />
                    </div>
                    <input name="name" defaultValue={editingPlan?.name} placeholder="Display Name (e.g. 1GB SME)" className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-blue-500" required />
                    <input name="api_id" defaultValue={editingPlan?.plan_id_api} placeholder="API ID (e.g. 210)" className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-blue-500" required />
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20">Save Configuration</button>
                </form>
            </div>
        </div>
      )}
      
      {/* MANUAL MODAL */}
      {showManualModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Manual Dispatch</h3>
                    <button onClick={() => setShowManualModal(false)}><X className="text-white/40 hover:text-white" /></button>
                </div>
                <form onSubmit={sendManual} className="space-y-4">
                    <input name="phone" placeholder="Recipient Phone" className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-blue-500" required />
                    <select name="network" className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none">
                            <option value="mtn">MTN</option>
                            <option value="glo">Glo</option>
                            <option value="airtel">Airtel</option>
                    </select>
                    <select name="plan_id" className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-white outline-none">
                        {plans.map(p => <option key={p.id} value={p.id}>{p.name} - ₦{p.price}</option>)}
                    </select>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20">Dispatch Data</button>
                </form>
            </div>
          </div>
      )}
    </div>
  );
 }
      
