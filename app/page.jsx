"use client";
import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, Search, MessageCircle, Gift, ChevronLeft, Copy, 
  CheckCircle, Loader2, CreditCard, Download, AlertTriangle, 
  X, Phone, Mail, RotateCcw, Printer, Share2, ImageIcon, Home
} from 'lucide-react';

// --- CONFIGURATION ---
const ADMIN_NUMBER = "2348164135836"; 
const WA_LINK = "";
const EMAIL = "saukidatalinks@gmail.com";
const ACCOUNT_NAME = "Abdullahi Adam Usman FLW";

const NETWORKS = [
  { id: 'mtn', name: 'MTN', color: 'bg-yellow-50', img: '/mtn.png' },
  { id: 'airtel', name: 'Airtel', color: 'bg-red-50', img: '/airtel.png' },
  { id: 'glo', name: 'Glo', color: 'bg-green-50', img: '/glo.png' },
];

export default function UserApp() {
  // --- STATE ---
  const [view, setView] = useState('home'); 
  const [broadcastMsg, setBroadcastMsg] = useState('');
  
  // Data
  const [plans, setPlans] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  // Inputs
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userName, setUserName] = useState('');
  const [isPorted, setIsPorted] = useState(false);
  
  // Forms
  const [gaNet, setGaNet] = useState('MTN');
  const [gaPhone, setGaPhone] = useState('');
  const [gaKey, setGaKey] = useState('');
  const [compName, setCompName] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compMsg, setCompMsg] = useState('');
  
  // Transaction
  const [isLoading, setIsLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [activeRef, setActiveRef] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('idle'); // idle, polling, success, delayed
  const pollTimer = useRef(null);
  const pollCount = useRef(0);
  
  // Track & Receipt
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  // specific state for tracking individual retry loading/errors
  const [retryStates, setRetryStates] = useState({}); 

  // --- INIT ---
  useEffect(() => {
    fetch('/api/status').then(res => res.json()).then(data => {
      if (data.message) setBroadcastMsg(data.message);
    }).catch(() => {});

    const saved = localStorage.getItem('sauki_pend');
    if (saved) {
      const d = JSON.parse(saved);
      // increased cache validity to 1 hour
      if (Date.now() - d.t < 3600000) { 
        setPhoneNumber(d.ph);
        setIsPorted(d.pt);
      } else {
        localStorage.removeItem('sauki_pend');
      }
    }
    return () => clearInterval(pollTimer.current);
  }, []);

  // --- LOGIC ---

  const handleNetworkSelect = async (netId) => {
    setIsLoading(true);
    setSelectedNetwork(netId);
    try {
      const res = await fetch(`/api/plans?network=${netId}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setPlans(data);
        setView('plans');
      } else {
        alert("No plans available.");
      }
    } catch (e) { alert("Connection Failed"); } 
    finally { setIsLoading(false); }
  };

  const initiateTransfer = async () => {
    if (!phoneNumber || phoneNumber.length < 10 || !userName) return alert("Enter valid details");
    setIsLoading(true);
    const ref = `Sauki-${phoneNumber}-${Date.now()}`;
    setActiveRef(ref);
    
    // Save pending state
    localStorage.setItem('sauki_pend', JSON.stringify({ 
      ref, ph: phoneNumber, id: selectedPlan.id, net: selectedNetwork, pt: isPorted, t: Date.now() 
    }));

    try {
      const res = await fetch('/api/initiate-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_ref: ref,
          amount: selectedPlan.price,
          email: EMAIL,
          phone_number: phoneNumber,
          name: userName,
          plan_id: selectedPlan.id,
          ported: isPorted
        })
      });
      const data = await res.json();
      if (data.success || data.account_number) {
        setPaymentDetails({
          account: data.account_number || data.account,
          bank: data.bank_name || data.bank,
          amount: data.amount || selectedPlan.price,
          name: ACCOUNT_NAME 
        });
        setView('payment');
        startPolling(ref);
      } else {
        alert(data.message || "Failed to generate account.");
      }
    } catch (e) { alert("System Busy"); } 
    finally { setIsLoading(false); }
  };

  const startPolling = (ref) => {
      setVerificationStatus('polling');
      if(pollTimer.current) clearInterval(pollTimer.current);
      pollCount.current = 0;
      
      // Check every 5 seconds (slower interval for smoothness)
      pollTimer.current = setInterval(() => {
          verifyPayment(ref, true);
      }, 5000);
  };

  const verifyPayment = async (ref = activeRef, isAuto = false) => {
    if(!isAuto) {
        setVerificationStatus('polling');
        pollCount.current = 0; // Reset counter on manual click
    }
    
    // Stop after approx 40 seconds (8 checks * 5s) to allow more time for transfers
    if (pollCount.current >= 8) {
        clearInterval(pollTimer.current);
        setVerificationStatus('delayed'); 
        return;
    }

    if (isAuto) pollCount.current += 1;

    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: ref,
          tx_ref: ref,
          mobile_number: phoneNumber,
          plan_id: selectedPlan?.id,
          network: selectedNetwork,
          ported: isPorted
        })
      });
      const data = await res.json();
      
      if (data.success) {
        clearInterval(pollTimer.current);
        setVerificationStatus('success');
        localStorage.removeItem('sauki_pend');
        setReceiptData({
            ref: ref,
            date: new Date().toISOString(),
            phone: phoneNumber,
            plan: selectedPlan?.name || 'Data Plan',
            amount: selectedPlan?.price || '0.00',
            status: 'Successful'
        });
        setView('success');
      } 
      else {
          if (!isAuto && verificationStatus !== 'delayed') {
             // Optional: visual shake or subtle notification instead of alert for smoother feel
             alert(data.error || "Payment not confirmed yet. Please wait a moment.");
          }
      }
    } catch (e) { if (!isAuto) alert("Connection Error"); }
  };

  // --- GIVEAWAY (WhatsApp Fix) ---
  const handleGiveaway = () => {
    if(!gaPhone || !gaKey) return alert("Fill all fields");
    const msg = `Giveaway Entry\n1. Number: ${gaPhone}\n2. Network: ${gaNet}\n3. Key: ${gaKey}\n\nMake sure you fill all the details.`;
    // FIXED: Using WA_LINK for direct redirection
    window.open(`${WA_LINK}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- COMPLAINT (DB) ---
  const handleComplaint = async () => {
    if(!compPhone || !compMsg) return alert("Phone and Message required");
    setIsLoading(true);
    try {
        const res = await fetch('/api/complaints', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name: compName, phone: compPhone, message: compMsg })
        });
        const d = await res.json();
        if(d.success) {
            alert("Complaint Lodged. We will check it.");
            setView('home');
            setCompMsg(''); setCompName(''); setCompPhone('');
        } else {
            alert("Failed: " + d.error);
        }
    } catch(e) { alert("Connection Error"); }
    setIsLoading(false);
  };

  // --- TRACKING & RECEIPT ---
  const handleTrack = async () => {
    if(!trackQuery) return;
    setIsLoading(true);
    setRetryStates({}); // Clear previous retry messages
    try {
        const res = await fetch(`/api/track?q=${trackQuery}`);
        const data = await res.json();
        setTrackResult(data);
    } catch(e) {
        // If track fails, try to "smart recover" by rechecking the reference directly
        retryTransaction({ reference: trackQuery }, true);
    }
    setIsLoading(false);
  };
  
  // FIXED: Improved Retry Logic
  const retryTransaction = async (transaction, silent = false) => {
      const ref = transaction.reference || transaction; // handle both object and string
      
      // Prevent double submission if already loading
      if (retryStates[ref]?.loading) return;

      if(!silent && !confirm("Retry this transaction? We will check for payment and deliver data.")) return;
      
      // Set loading state for this specific item
      setRetryStates(prev => ({ ...prev, [ref]: { loading: true, msg: 'Verifying Payment...' } }));

      try {
        const res = await fetch('/api/purchase', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                action: 'recheck', 
                tx_ref: ref,
                // Include these to prevent "Invalid Plan" errors on backend
                plan_id: transaction.plan_id,
                network: transaction.network
            })
        });
        const d = await res.json();
        
        if(d.success) {
            // Success: Update UI to show receipt button immediately
            setRetryStates(prev => ({ ...prev, [ref]: { loading: false, msg: 'Success!', type: 'success' } }));
            alert("Transaction Successful! Data sent.");
            handleTrack(); // Refresh list to show Receipt button
        }
        else {
            // Failure: Show specific error message near transaction
            const errorMsg = d.error?.includes('fund') ? "Payment not confirmed" : (d.error || "Delivery Failed");
            setRetryStates(prev => ({ 
                ...prev, 
                [ref]: { loading: false, msg: errorMsg, type: 'error' } 
            }));
        }
      } catch(e) { 
          if(!silent) {
            setRetryStates(prev => ({ 
                ...prev, 
                [ref]: { loading: false, msg: 'Connection Error', type: 'error' } 
            }));
          }
      }
  };

  const downloadReceiptImage = async () => {
    const element = document.getElementById('receipt-hidden-render');
    element.style.display = 'block';
    
    try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(element, { 
            scale: 2, 
            backgroundColor: "#ffffff", 
            useCORS: true 
        });
        
        const data = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = data;
        link.download = `Sauki-Receipt-${receiptData.ref}.png`;
        link.click();
    } catch (e) { 
        console.error(e);
        alert("Error generating image."); 
    } finally { 
        element.style.display = 'none'; 
    }
  };

  // FIXED: Receipt now carries exact price
  const viewReceipt = (t) => {
      setReceiptData({
          ref: t.reference,
          date: t.created_at,
          phone: t.phone_number,
          plan: t.plan_id, 
          // Use exact amount from transaction if available
          amount: t.amount || t.price || 'PAID', 
          status: 'Successful'
      });
      setShowReceiptModal(true);
  };
  
  const Header = ({ title, showBack }) => (
    <div className="bg-white px-4 py-3 flex items-center gap-3 shadow-sm shrink-0 z-20 border-b border-slate-100">
      {showBack && <button onClick={() => setView('home')} className="p-1.5 hover:bg-slate-100 rounded-full"><ChevronLeft className="text-slate-600" size={24} /></button>}
      <h2 className="font-bold text-lg text-slate-800">{title}</h2>
    </div>
  );

  const WhatsappIcon = () => (<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" className="text-green-400"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>);

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl relative font-sans overflow-hidden">
      
      {/* STATUS BAR */}
      <div className="bg-slate-900 text-white text-[10px] py-2 px-3 flex justify-between items-center shrink-0 z-30 font-medium">
        <a href={`mailto:${EMAIL}`} className="flex items-center gap-1 hover:text-blue-300"><Mail size={12} className="text-blue-400"/> <span>Email</span></a>
        {/* FIXED: WhatsApp Link */}
        <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-green-300"><WhatsappIcon /> <span>WhatsApp</span></a>
        <a href={`tel:${ADMIN_NUMBER}`} className="flex items-center gap-1 hover:text-green-300"><Phone size={12} className="text-green-400"/> <span>Call</span></a>
      </div>
      
      {/* FIXED: Slower Marquee (30s) */}
      {broadcastMsg && <div className="bg-orange-600 text-white text-[11px] font-bold py-1.5 overflow-hidden whitespace-nowrap shrink-0 z-30 shadow-md"><div className="inline-block animate-[marquee_30s_linear_infinite] pl-[100%]">{broadcastMsg} &nbsp;&nbsp;&nbsp;&nbsp; {broadcastMsg}</div></div>}

      {/* --- HOME --- */}
      {view === 'home' && (
        <>
          <div className="bg-white px-6 pt-6 pb-2 shadow-sm z-10 shrink-0 border-b border-slate-100 flex flex-col items-center">
            <img src="/logo.png" className="w-20 h-20 rounded-2xl object-contain shadow-lg border border-slate-100 mb-3 bg-white" onError={(e) => e.target.style.display='none'} />
            <h1 className="font-black text-2xl text-slate-900 tracking-tight leading-none mb-2">Sauki Data</h1>
            <p className="text-[10px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 tracking-wide uppercase">Government Certified by SMEDAN</p>
          </div>
          <div className="flex-1 px-6 py-4 flex flex-col justify-evenly">
             <div className="text-center"><h2 className="text-2xl font-black text-slate-800 leading-tight">Cheap Data.<br/>Instant Delivery.</h2></div>
             {isLoading ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-blue-600" size={32}/></div> : (
                <div className="grid grid-cols-3 gap-3">
                    {NETWORKS.map((net) => (
                    <button key={net.id} onClick={() => handleNetworkSelect(net.id)} className={`p-3 rounded-2xl shadow-sm border border-slate-200 active:scale-95 transition-all flex flex-col items-center gap-2 bg-white hover:border-blue-400`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center p-1 ${net.color}`}><img src={net.img} alt={net.name} className="w-full h-full object-contain rounded-full" onError={(e) => e.target.style.display='none'} /></div>
                        <span className="font-bold text-xs text-slate-700">{net.name}</span>
                    </button>
                    ))}
                </div>
             )}
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setView('track')} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl gap-2 active:bg-slate-50 shadow-sm"><Search size={20} className="text-slate-500" /><span className="text-[10px] font-bold text-slate-600">Track</span></button>
              <button onClick={() => setView('complaint')} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl gap-2 active:bg-slate-50 shadow-sm"><MessageCircle size={20} className="text-slate-500" /><span className="text-[10px] font-bold text-slate-600">Complaint</span></button>
              <button onClick={() => setView('giveaway')} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl gap-2 active:bg-slate-50 shadow-sm"><Gift size={20} className="text-slate-500" /><span className="text-[10px] font-bold text-slate-600">Giveaway</span></button>
            </div>
          </div>
        </>
      )}

      {/* --- PLANS --- */}
      {view === 'plans' && (
        <>
          <Header title={`${selectedNetwork?.toUpperCase()} Plans`} showBack={true} />
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
            {plans.map(plan => (
              <button key={plan.id} onClick={() => { setSelectedPlan(plan); setView('checkout'); }} className="w-full bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center active:border-blue-500 transition-all">
                <div className="text-left"><div className="font-bold text-slate-800">{plan.name}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">30 Days Validity</div></div>
                <div className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-sm">₦{plan.price}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* --- CHECKOUT --- */}
      {view === 'checkout' && (
        <>
          <Header title="Enter Details" showBack={true} />
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
            <div className="bg-white border border-blue-100 p-4 rounded-xl mb-6 flex justify-between items-center shadow-sm">
               <div><p className="text-[10px] text-blue-500 font-bold uppercase tracking-wide">Selected Plan</p><p className="font-bold text-slate-800">{selectedPlan?.name}</p></div>
               <p className="text-xl font-black text-blue-600">₦{selectedPlan?.price}</p>
            </div>
            <div className="space-y-4">
              <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone Number (080...)" className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold text-lg text-slate-800" />
              <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Your Name" className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500" />
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-white cursor-pointer"><input type="checkbox" checked={isPorted} onChange={(e) => setIsPorted(e.target.checked)} className="w-5 h-5 accent-blue-600 rounded" /><span className="text-sm text-slate-600 font-semibold">Is this a ported number?</span></label>
            </div>
            <div className="mt-auto pt-6 pb-2">
              <button onClick={initiateTransfer} disabled={isLoading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-transform disabled:opacity-70">{isLoading ? <Loader2 className="animate-spin" /> : 'Pay with Transfer'}</button>
            </div>
          </div>
        </>
      )}

      {/* --- PAYMENT --- */}
      {view === 'payment' && paymentDetails && (
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="p-4 flex justify-between items-center border-b border-slate-100">
             <h2 className="font-bold text-lg text-slate-800">Complete Payment</h2>
             <button onClick={()=>{clearInterval(pollTimer.current); setView('home');}} className="text-red-500 text-sm font-bold bg-red-50 px-3 py-1 rounded-full">Cancel</button>
          </div>
          <div className="flex-1 p-6 flex flex-col items-center text-center overflow-y-auto">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Transfer exactly</p>
            <h1 className="text-4xl font-black text-slate-900 mb-8">₦{paymentDetails.amount}</h1>
            <div className="w-full bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6 relative">
               <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400">BANK DETAILS</div>
               <p className="font-bold text-slate-800 text-lg mb-1">{paymentDetails.bank}</p>
               <p className="text-xs text-slate-400 mb-4 font-medium">{paymentDetails.name}</p>
               <div onClick={() => { navigator.clipboard.writeText(paymentDetails.account); alert('Copied!'); }} className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer active:scale-95 transition-transform shadow-sm">
                  <p className="text-3xl font-mono font-bold text-slate-900 tracking-widest">{paymentDetails.account}</p>
                  <p className="text-[10px] text-blue-500 font-bold mt-1 uppercase">Tap to Copy</p>
               </div>
            </div>
            
            {/* POLLING STATE */}
            {verificationStatus === 'polling' && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3 w-full mb-6 animate-pulse">
                    <Loader2 className="animate-spin text-blue-600" size={24}/>
                    <div className="text-left"><p className="text-sm font-bold text-blue-900">Checking payment...</p><p className="text-xs text-blue-600">Please wait, confirming transfer.</p></div>
                </div>
            )}
            
            {/* DELAYED STATE */}
            {verificationStatus === 'delayed' && (
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl w-full mb-6 text-left">
                    <p className="text-sm font-bold text-orange-800 flex items-center gap-2"><AlertTriangle size={16}/> Payment Delayed?</p>
                    <p className="text-xs text-orange-700 mt-1 mb-3">Bank networks might be slow. You can keep checking or try later.</p>
                    <div className="flex gap-2">
                        <button onClick={() => verifyPayment(activeRef, false)} className="px-3 py-2 bg-orange-200 text-orange-900 rounded-lg text-xs font-bold flex-1 hover:bg-orange-300">Check Again</button>
                        <button onClick={() => setView('home')} className="px-3 py-2 bg-white border border-orange-200 text-orange-900 rounded-lg text-xs font-bold flex-1 flex items-center justify-center gap-1 hover:bg-orange-50"><Home size={12}/> Home</button>
                    </div>
                </div>
            )}

            <button onClick={() => verifyPayment(activeRef, false)} disabled={verificationStatus === 'polling'} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-200 active:scale-95 transition-transform mt-auto disabled:opacity-70">
              {verificationStatus === 'polling' ? 'Verifying...' : 'I have sent the money'}
            </button>
          </div>
        </div>
      )}

      {/* --- SUCCESS VIEW --- */}
      {view === 'success' && receiptData && (
        <div className="flex-1 flex flex-col justify-center p-8 bg-white text-center">
            <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse"><CheckCircle size={48} className="text-green-600" /></div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Payment Successful!</h2>
            <p className="text-slate-500 mb-8 font-medium">Data sent to <span className="text-slate-900 font-bold">{receiptData.phone}</span></p>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowReceiptModal(true)} className="py-3.5 border-2 border-slate-100 rounded-xl font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50"><Printer size={18}/> Receipt</button>
                <button onClick={() => window.location.reload()} className="py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">Buy More</button>
            </div>
        </div>
      )}

      {/* --- TRACK VIEW --- */}
      {view === 'track' && (
          <>
            <Header title="Track Order" showBack={true} />
            <div className="flex-1 p-6 bg-slate-50">
                <div className="flex gap-2 mb-6">
                    <input value={trackQuery} onChange={e=>setTrackQuery(e.target.value)} placeholder="Phone or Ref ID" className="flex-1 p-4 bg-white border border-slate-200 rounded-xl outline-none font-medium shadow-sm" />
                    <button onClick={handleTrack} className="bg-blue-600 text-white px-6 rounded-xl font-bold shadow-md active:scale-95 transition-transform">{isLoading ? <Loader2 className="animate-spin"/> : 'Check'}</button>
                </div>
                {trackResult && (
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        {trackResult.transactions ? trackResult.transactions.map(t => (
                            <div key={t.id} className="border-b border-slate-100 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
                                <div className="flex justify-between items-center mb-1"><span className="font-bold text-slate-800">{t.plan_id}</span><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.status==='success'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>{t.status}</span></div>
                                <div className="text-xs text-slate-400 font-medium mb-2">{new Date(t.created_at).toLocaleString()}</div>
                                
                                {/* Status Message Area (for Retries) */}
                                {retryStates[t.reference] && (
                                    <div className={`text-xs font-bold mb-2 p-2 rounded ${retryStates[t.reference].type === 'error' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {retryStates[t.reference].msg}
                                    </div>
                                )}

                                <div className="flex justify-end gap-2">
                                    {t.status === 'success' && <button onClick={()=>viewReceipt(t)} className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold flex items-center gap-1"><Printer size={12}/> Receipt</button>}
                                    {t.status !== 'success' && (
                                        <button 
                                            onClick={()=>retryTransaction(t)} 
                                            disabled={retryStates[t.reference]?.loading}
                                            className="px-3 py-1 bg-orange-100 text-orange-600 rounded text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {retryStates[t.reference]?.loading ? <Loader2 size={12} className="animate-spin"/> : <RotateCcw size={12}/>} 
                                            Retry
                                        </button>
                                    )}
                                </div>
                            </div>
                        )) : <p className="text-center text-slate-500 font-medium py-4">Order not found.</p>}
                    </div>
                )}
            </div>
          </>
      )}

      {/* --- RECEIPT MODAL --- */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
           <div className="bg-white w-full max-w-sm rounded-none md:rounded-lg overflow-hidden relative">
               <button onClick={() => setShowReceiptModal(false)} className="absolute top-2 right-2 p-2 hover:bg-slate-100 rounded-full text-slate-400 z-10"><X size={24}/></button>
               <div className="p-8 text-center bg-white text-black font-sans relative">
                   <div className="mb-6 flex flex-col items-center">
                       <img src="/logo.png" className="w-16 h-16 object-contain mb-2" onError={(e) => e.target.style.display='none'} />
                       <h2 className="text-xl font-black tracking-tight text-slate-900">SAUKI DATA LINKS</h2>
                       <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Transaction Receipt</p>
                   </div>
                   <div className="border-t-2 border-black border-dashed py-6 space-y-4 text-sm">
                       <div className="flex justify-between"><span className="text-slate-600">Status</span><span className="font-bold text-green-600 uppercase">{receiptData.status}</span></div>
                       <div className="flex justify-between"><span className="text-slate-600">Date</span><span className="font-bold text-black">{new Date(receiptData.date).toLocaleDateString()}</span></div>
                       <div className="flex justify-between"><span className="text-slate-600">Ref</span><span className="font-mono font-bold text-xs text-black">{receiptData.ref}</span></div>
                       <div className="flex justify-between"><span className="text-slate-600">Phone</span><span className="font-bold text-black">{receiptData.phone}</span></div>
                       <div className="flex justify-between"><span className="text-slate-600">Plan</span><span className="font-bold text-black">{receiptData.plan}</span></div>
                   </div>
                   <div className="border-t-2 border-black border-dashed pt-6 pb-8">
                       <div className="flex justify-between items-center"><span className="font-bold text-slate-900">AMOUNT</span><span className="font-black text-2xl text-slate-900">₦{receiptData.amount}</span></div>
                   </div>
               </div>
               <button onClick={downloadReceiptImage} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 flex items-center justify-center gap-2"><ImageIcon size={18}/> Download Image</button>
           </div>
        </div>
      )}

      {/* --- HIDDEN RECEIPT RENDER --- */}
      {receiptData && (
        <div id="receipt-hidden-render" style={{display: 'none', position: 'fixed', top: 0, left: 0, width: '400px', background: 'white', padding: '40px', zIndex: -10}}>
            <div className="mb-6 flex flex-col items-center">
                <img src="/logo.png" className="w-20 h-20 object-contain mb-4" />
                <h2 className="text-2xl font-black tracking-tight text-slate-900">SAUKI DATA LINKS</h2>
                <p className="text-sm text-slate-500 font-bold tracking-widest uppercase">Transaction Receipt</p>
            </div>
            <div className="border-t-2 border-black border-dashed py-8 space-y-5 text-base">
                <div className="flex justify-between"><span className="text-slate-600">Status</span><span className="font-bold text-green-600 uppercase">SUCCESSFUL</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Date</span><span className="font-bold text-black">{new Date(receiptData.date).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Time</span><span className="font-bold text-black">{new Date(receiptData.date).toLocaleTimeString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Reference</span><span className="font-mono font-bold text-xs text-black">{receiptData.ref}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Recipient</span><span className="font-bold text-black">{receiptData.phone}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Plan</span><span className="font-bold text-black">{receiptData.plan}</span></div>
            </div>
            <div className="border-t-2 border-black border-dashed pt-8 pb-10">
                <div className="flex justify-between items-center"><span className="font-bold text-slate-900">AMOUNT</span><span className="font-black text-3xl text-slate-900">₦{receiptData.amount}</span></div>
            </div>
            <div className="text-xs text-slate-400 space-y-2 text-center">
                <p className="font-bold text-slate-600">Sauki Data Links</p>
                <p>{EMAIL} | {ADMIN_NUMBER.replace('234', '0')}</p>
                <p>Government Certified by SMEDAN</p>
            </div>
        </div>
      )}

      {/* --- GIVEAWAY --- */}
      {view === 'giveaway' && (
          <>
            <Header title="Giveaway Entry" showBack={true} />
            <div className="flex-1 p-6 space-y-4 bg-slate-50">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <select value={gaNet} onChange={e=>setGaNet(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700"><option value="MTN">MTN</option><option value="GLO">Glo</option><option value="AIRTEL">Airtel</option></select>
                    <input value={gaPhone} onChange={e=>setGaPhone(e.target.value)} type="tel" placeholder="Phone Number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium" />
                    <input value={gaKey} onChange={e=>setGaKey(e.target.value)} placeholder="Giveaway Code" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium" />
                </div>
                <button onClick={handleGiveaway} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold mt-4 shadow-lg shadow-green-200 active:scale-95 transition-transform flex justify-center gap-2"><MessageCircle size={20} /> Submit via WhatsApp</button>
            </div>
          </>
      )}

      {/* --- COMPLAINT --- */}
      {view === 'complaint' && (
          <>
            <Header title="Support" showBack={true} />
            <div className="flex-1 p-6 space-y-4 bg-slate-50">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <input value={compName} onChange={e=>setCompName(e.target.value)} placeholder="Your Name" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium" />
                    <input value={compPhone} onChange={e=>setCompPhone(e.target.value)} type="tel" placeholder="Phone Number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium" />
                    <textarea value={compMsg} onChange={e=>setCompMsg(e.target.value)} placeholder="Describe your issue..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none h-32 font-medium resize-none" />
                 </div>
                <button onClick={handleComplaint} disabled={isLoading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold mt-4 shadow-lg shadow-blue-200 active:scale-95 transition-transform flex justify-center gap-2">
                    {isLoading ? <Loader2 className="animate-spin"/> : 'Submit Ticket'}
                </button>
            </div>
          </>
      )}

      {/* FOOTER */}
      <div className="p-4 bg-white border-t border-slate-100 text-center text-[10px] text-slate-400 shrink-0 flex flex-col items-center gap-2 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-5 opacity-90 mb-1">
             <img src="/coat.png" className="h-8 object-contain drop-shadow-sm" onError={(e) => e.target.style.display='none'} />
             <div className="h-6 w-px bg-slate-200"></div>
             <img src="/smedan.png" className="h-8 object-contain drop-shadow-sm" onError={(e) => e.target.style.display='none'} />
        </div>
        <div>
            <p className="font-bold text-slate-600 mb-0.5">Sauki Data Links © 2025</p>
            <p className="font-medium text-slate-400">Developed with ❤️ from Abdallah Nangere 🇳🇬</p>
        </div>
      </div>
    </div>
  );
}