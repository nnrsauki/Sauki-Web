"use client";
import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, Search, MessageCircle, Gift, ChevronLeft, Copy, 
  CheckCircle, Loader2, CreditCard, Download, AlertTriangle, 
  X, Phone, Mail, RefreshCw, FileText, Home
} from 'lucide-react';

// --- CONFIGURATION ---
const ADMIN_NUMBER = "2348164135836"; // International format for links
const DISPLAY_NUMBER = "08164135836"; // Display format
const EMAIL = "saukidatalinks@gmail.com";

const NETWORKS = [
  { id: 'mtn', name: 'MTN', color: 'bg-yellow-50', img: '/mtn.png' },
  { id: 'airtel', name: 'Airtel', color: 'bg-red-50', img: '/airtel.png' },
  { id: 'glo', name: 'Glo', color: 'bg-green-50', img: '/glo.png' },
];

export default function UserApp() {
  // --- STATE ---
  const [view, setView] = useState('home'); 
  const [broadcastMsg, setBroadcastMsg] = useState('');
  
  // Data State
  const [plans, setPlans] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  // Input State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userName, setUserName] = useState('');
  const [isPorted, setIsPorted] = useState(false);
  
  // Forms State
  const [gaNet, setGaNet] = useState('MTN');
  const [gaPhone, setGaPhone] = useState('');
  const [gaKey, setGaKey] = useState('');
  const [compName, setCompName] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compMsg, setCompMsg] = useState('');
  
  // Transaction State
  const [isLoading, setIsLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [activeRef, setActiveRef] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('idle'); // idle, verifying, success, timeout
  const [isPolling, setIsPolling] = useState(false);
  const [pollStartTime, setPollStartTime] = useState(null);
  
  // Track State
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResult, setTrackResult] = useState(null);

  // Receipt State
  const receiptRef = useRef(null);
  const [receiptData, setReceiptData] = useState(null);

  // --- INIT ---
  useEffect(() => {
    // Load html2canvas for receipt generation
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.async = true;
    document.body.appendChild(script);

    // Fetch Broadcast
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data.message && data.message.trim() !== "") setBroadcastMsg(data.message);
      })
      .catch(() => {});

    // Check Pending Transaction
    const saved = localStorage.getItem('sauki_pend');
    if (saved) {
      const d = JSON.parse(saved);
      if (Date.now() - d.t < 1800000) { // 30 mins expiry
        setPhoneNumber(d.ph);
        setIsPorted(d.pt);
      } else {
        localStorage.removeItem('sauki_pend');
      }
    }
  }, []);

  // --- POLLING & TIMEOUT LOGIC ---
  useEffect(() => {
    let interval;
    
    // 1. Polling Interval (every 5 seconds)
    if (isPolling && activeRef && verificationStatus !== 'success' && verificationStatus !== 'timeout') {
      interval = setInterval(() => {
        verifyPayment(true); // True = silent mode
      }, 5000);
    }

    // 2. Timeout Check (60 seconds)
    // If we are actively verifying (spinning) or polling, check if time has exceeded 60s
    if (isPolling && pollStartTime) {
        const checkTimeout = setInterval(() => {
            if (Date.now() - pollStartTime > 60000) { // 60 seconds limit
                setIsPolling(false); // Stop polling
                if (verificationStatus !== 'success') {
                    setVerificationStatus('timeout');
                }
            }
        }, 1000);
        return () => { clearInterval(interval); clearInterval(checkTimeout); };
    }

    return () => clearInterval(interval);
  }, [isPolling, activeRef, verificationStatus, pollStartTime]);


  // --- HELPERS ---
  const sendToWhatsApp = (text) => {
    window.open(`https://wa.me/${ADMIN_NUMBER}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const downloadReceiptImage = async () => {
    if (!receiptRef.current || !window.html2canvas) {
      alert("Receipt generator loading... try again in a second.");
      return;
    }
    try {
      const canvas = await window.html2canvas(receiptRef.current, {
        scale: 2, // High resolution
        backgroundColor: '#ffffff',
        logging: false
      });
      const link = document.createElement('a');
      link.download = `Receipt-${receiptData?.ref || 'Sauki'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert("Could not generate image. Please screenshot instead.");
    }
  };

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
          name: "Abdullahi Adam Usman FLW"
        });
        
        // Start polling immediately
        setVerificationStatus('idle');
        setIsPolling(true);
        setPollStartTime(Date.now()); // Start the 60s timer
        setView('payment');
      } else {
        alert(data.message || "Failed to generate account.");
      }
    } catch (e) { alert("System Busy"); } 
    finally { setIsLoading(false); }
  };

  const verifyPayment = async (silent = false) => {
    if (!silent) {
        // Reset timer if user clicks button manually to give them another 60s? 
        // Or keep original timer? 
        // User requirement: "after 60 second of spinning" implies from the moment of action.
        // Let's reset the timer to give them a fresh 60s window if they explicitly click.
        setVerificationStatus('verifying');
        setPollStartTime(Date.now());
        setIsPolling(true);
    }
    
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: activeRef,
          tx_ref: activeRef,
          mobile_number: phoneNumber,
          plan_id: selectedPlan?.id,
          network: selectedNetwork,
          ported: isPorted
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setVerificationStatus('success');
        setIsPolling(false); 
        localStorage.removeItem('sauki_pend');
        
        // Prepare Receipt Data
        setReceiptData({
          ref: activeRef,
          plan: selectedPlan?.name || "Data Plan",
          amount: selectedPlan?.price || "0.00",
          phone: phoneNumber,
          date: new Date().toLocaleString(),
          status: 'Successful'
        });
        
        setView('success');
      } 
      // Note: We don't handle failure here by stopping, we let the poller/timer handle the 'timeout' state.
    } catch (e) {
      if (!silent) console.log("Verification check failed temporarily");
    }
  };

  // --- UI ACTIONS ---
  const handleGiveaway = () => {
    if(!gaPhone || !gaKey) return alert("Fill all fields");
    sendToWhatsApp(`Giveaway Entry:\nNetwork: ${gaNet}\nPhone: ${gaPhone}\nKey: ${gaKey}`);
  };

  const handleComplaint = () => {
    if(!compPhone || !compMsg) return alert("Fill all fields");
    sendToWhatsApp(`Complaint:\nName: ${compName}\nPhone: ${compPhone}\nIssue: ${compMsg}`);
  };

  const handleTrack = async () => {
    if(!trackQuery) return;
    setIsLoading(true);
    try {
        const res = await fetch(`/api/track?q=${trackQuery}`);
        const data = await res.json();
        setTrackResult(data);
    } catch(e) {
        if(trackQuery.startsWith('Sauki')) {
             const res = await fetch('/api/purchase', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'recheck', tx_ref: trackQuery })
            });
            const d = await res.json();
            if(d.success) alert("Transaction Retried Successfully");
            else alert(d.error || "Transaction not found");
        } else {
            alert("Order not found");
        }
    }
    setIsLoading(false);
  };

  // Helper to open receipt from track
  const openReceiptFromTrack = (tx) => {
      setReceiptData({
          ref: tx.tx_ref || tx.id || "N/A",
          plan: tx.plan_id || "Data Plan",
          amount: tx.amount || "N/A",
          phone: tx.phone_number || "N/A",
          date: new Date(tx.created_at).toLocaleString(),
          status: 'Successful'
      });
      setView('success');
  };

  // Helper to retry from track
  const retryFromTrack = (tx) => {
      setActiveRef(tx.tx_ref || tx.id);
      setPhoneNumber(tx.phone_number);
      setVerificationStatus('verifying');
      setIsPolling(true);
      setPollStartTime(Date.now());
      setView('payment');
      verifyPayment();
  };

  // --- SUB-COMPONENTS ---
  const Header = ({ title, showBack = false }) => (
    <div className="bg-white px-4 py-3 flex items-center gap-3 shadow-sm shrink-0 z-20 border-b border-slate-100">
      {showBack && (
        <button onClick={() => setView('home')} className="p-1.5 hover:bg-slate-100 rounded-full">
          <ChevronLeft className="text-slate-600" size={24} />
        </button>
      )}
      <h2 className="font-bold text-lg text-slate-800">{title}</h2>
    </div>
  );

  const WhatsappIcon = () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="text-green-400">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl relative font-sans overflow-hidden">
      
      {/* 1. TOP CONTACT BAR */}
      <div className="bg-slate-900 text-white text-[11px] py-2 px-4 flex justify-between items-center shrink-0 z-30 font-medium">
        <a href={`mailto:${EMAIL}`} className="flex items-center gap-1.5 hover:text-blue-300 transition-colors">
            <Mail size={12} className="text-blue-400"/> <span>Email</span>
        </a>
        <a href={`tel:${ADMIN_NUMBER}`} className="flex items-center gap-1.5 hover:text-green-300 transition-colors">
            <Phone size={12} className="text-green-400"/> <span>Call</span>
        </a>
        <a href={`https://wa.me/${ADMIN_NUMBER}`} target="_blank" className="flex items-center gap-1.5 hover:text-green-300 transition-colors">
            <WhatsappIcon /> <span>WhatsApp</span>
        </a>
      </div>

      {/* 2. BROADCAST BAR */}
      {broadcastMsg && (
        <div className="bg-orange-600 text-white text-[11px] font-bold py-1.5 overflow-hidden whitespace-nowrap shrink-0 z-30 shadow-md relative">
            <div className="inline-block animate-[marquee_15s_linear_infinite] pl-[100%]">
                {broadcastMsg} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {broadcastMsg}
            </div>
        </div>
      )}

      {/* --- HOME VIEW --- */}
      {view === 'home' && (
        <>
          <div className="bg-white px-6 pt-6 pb-2 shadow-sm z-10 shrink-0 border-b border-slate-100 flex flex-col items-center">
            <img 
              src="/logo.png" 
              className="w-20 h-20 rounded-2xl object-contain shadow-lg border border-slate-100 mb-3 bg-white" 
              onError={(e) => e.target.style.display='none'} 
            />
            <h1 className="font-black text-2xl text-slate-900 tracking-tight leading-none mb-2">Sauki Data</h1>
            <p className="text-[10px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 tracking-wide uppercase">
              Government Certified by SMEDAN
            </p>
          </div>

          <div className="flex-1 px-6 py-4 flex flex-col justify-evenly">
             <div className="text-center">
                <h2 className="text-2xl font-black text-slate-800 leading-tight">Cheap Data.<br/>Instant Delivery.</h2>
             </div>

             {isLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="animate-spin text-blue-600" size={32}/></div>
             ) : (
                <div className="grid grid-cols-3 gap-3">
                    {NETWORKS.map((net) => (
                    <button
                        key={net.id}
                        onClick={() => handleNetworkSelect(net.id)}
                        className={`p-3 rounded-2xl shadow-sm border border-slate-200 active:scale-95 transition-all flex flex-col items-center gap-2 bg-white hover:border-blue-400`}
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center p-1 ${net.color}`}>
                            <img src={net.img} alt={net.name} className="w-full h-full object-contain rounded-full" onError={(e) => e.target.style.display='none'} />
                        </div>
                        <span className="font-bold text-xs text-slate-700">{net.name}</span>
                    </button>
                    ))}
                </div>
             )}

            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setView('track')} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl gap-2 active:bg-slate-50 transition-colors shadow-sm">
                <Search size={20} className="text-slate-500" />
                <span className="text-[10px] font-bold text-slate-600">Track</span>
              </button>
              <button onClick={() => setView('complaint')} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl gap-2 active:bg-slate-50 transition-colors shadow-sm">
                <MessageCircle size={20} className="text-slate-500" />
                <span className="text-[10px] font-bold text-slate-600">Complaint</span>
              </button>
              <button onClick={() => setView('giveaway')} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl gap-2 active:bg-slate-50 transition-colors shadow-sm">
                <Gift size={20} className="text-slate-500" />
                <span className="text-[10px] font-bold text-slate-600">Giveaway</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* --- PLANS VIEW --- */}
      {view === 'plans' && (
        <>
          <Header title={`${selectedNetwork?.toUpperCase()} Plans`} showBack={true} />
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
            {plans.map(plan => (
              <button key={plan.id} onClick={() => { setSelectedPlan(plan); setView('checkout'); }}
                className="w-full bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center active:border-blue-500 transition-all">
                <div className="text-left">
                  <div className="font-bold text-slate-800">{plan.name}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">30 Days Validity</div>
                </div>
                <div className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-sm">₦{plan.price}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* --- CHECKOUT VIEW --- */}
      {view === 'checkout' && (
        <>
          <Header title="Enter Details" showBack={true} />
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
            <div className="bg-white border border-blue-100 p-4 rounded-xl mb-6 flex justify-between items-center shadow-sm">
               <div>
                 <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wide">Selected Plan</p>
                 <p className="font-bold text-slate-800">{selectedPlan?.name}</p>
               </div>
               <p className="text-xl font-black text-blue-600">₦{selectedPlan?.price}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">Recipient Number</label>
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="080..." className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold text-lg text-slate-800 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">Your Name</label>
                <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Enter Name" className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors" />
              </div>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-white cursor-pointer">
                <input type="checkbox" checked={isPorted} onChange={(e) => setIsPorted(e.target.checked)} className="w-5 h-5 accent-blue-600 rounded" />
                <span className="text-sm text-slate-600 font-semibold">Is this a ported number?</span>
              </label>
            </div>
            
          <div className="mt-auto pt-6 pb-2">
              <button onClick={initiateTransfer} disabled={isLoading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-transform disabled:opacity-70">
                {isLoading ? <Loader2 className="animate-spin" /> : 'Pay with Transfer'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* --- PAYMENT VIEW --- */}
      {view === 'payment' && paymentDetails && (
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="p-4 flex justify-between items-center border-b border-slate-100">
             <h2 className="font-bold text-lg text-slate-800">Complete Payment</h2>
             <button onClick={()=>setView('home')} className="text-red-500 text-sm font-bold bg-red-50 px-3 py-1 rounded-full">Cancel</button>
          </div>
          
          <div className="flex-1 p-6 flex flex-col items-center text-center overflow-y-auto">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Transfer exactly</p>
            <h1 className="text-4xl font-black text-slate-900 mb-8">₦{paymentDetails.amount}</h1>
            
            <div className="w-full bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6 relative">
               <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400">BANK DETAILS</div>
               
               <p className="font-bold text-slate-800 text-lg mb-1">{paymentDetails.bank}</p>
               <p className="text-xs text-slate-400 mb-4 font-medium">Abdullahi Adam Usman FLW</p> 
               
               <div onClick={() => { navigator.clipboard.writeText(paymentDetails.account); alert('Copied!'); }}
                  className="bg-white p-4 rounded-xl border border-slate-200 cursor-pointer active:scale-95 transition-transform shadow-sm">
                  <p className="text-3xl font-mono font-bold text-slate-900 tracking-widest">{paymentDetails.account}</p>
                  <p className="text-[10px] text-blue-500 font-bold mt-1 uppercase">Tap to Copy Account Number</p>
               </div>
            </div>
            
            {/* TIMEOUT ERROR MESSAGE */}
            {verificationStatus === 'timeout' && (
              <div className="w-full bg-red-50 border border-red-100 p-4 rounded-xl mb-6 text-left animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex gap-2 items-start mb-2">
                     <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18}/>
                     <p className="font-bold text-red-700">Payment not confirmed yet.</p>
                  </div>
                  <p className="text-xs text-red-600 leading-relaxed font-medium">
                      In case your bank delayed payment, you can go back to the <b>Track Order</b> at the homepage to check transaction status after a few minutes.
                  </p>
              </div>
            )}

            {/* NORMAL INFO BOX (Only if NOT timed out) */}
            {verificationStatus !== 'timeout' && (
                <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex gap-3 text-left items-start mb-6">
                   <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5"/>
                   <p className="text-xs text-orange-700 font-medium leading-relaxed">
                       {verificationStatus === 'verifying' 
                        ? "We are verifying your transaction. Do not close this page..." 
                        : "Make the transfer first. We will verify automatically even if you don't click below."}
                   </p>
                </div>
            )}

            {/* BUTTON LOGIC */}
            {verificationStatus === 'timeout' ? (
                 <button onClick={() => setView('home')} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform mt-auto flex justify-center items-center gap-2">
                    <Home size={18}/> Go Back Home
                 </button>
            ) : (
                <button onClick={() => verifyPayment()} disabled={verificationStatus === 'verifying'} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-200 active:scale-95 transition-transform mt-auto disabled:opacity-70 flex justify-center items-center gap-2">
                  {verificationStatus === 'verifying' ? (
                      <>
                        <Loader2 className="animate-spin" size={20}/> Confirming Transaction...
                      </>
                  ) : 'I have sent the money'}
                </button>
            )}

          </div>
        </div>
      )}

      {/* --- SUCCESS / RECEIPT VIEW --- */}
      {view === 'success' && receiptData && (
        <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto">
             <div className="p-4 flex justify-between items-center bg-white shadow-sm z-10">
                 <button onClick={()=>setView('home')} className="text-slate-500 font-bold flex items-center gap-1"><ChevronLeft size={16}/> Back</button>
                 <span className="font-bold text-green-600 flex items-center gap-1"><CheckCircle size={16}/> Successful</span>
             </div>

             <div className="flex-1 p-6 flex items-center justify-center">
                <div ref={receiptRef} id="receipt-card" className="bg-white w-full shadow-xl rounded-none p-8 flex flex-col relative text-slate-800">
                    <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
                    <div className="flex flex-col items-center mb-6 border-b border-slate-100 pb-6">
                        <img 
                          src="/logo.png" 
                          className="w-16 h-16 object-contain mb-3" 
                          onError={(e) => e.target.style.display='none'} 
                        />
                        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">Transaction Receipt</h2>
                        <p className="text-xs text-slate-400 font-medium">Sauki Data Links</p>
                    </div>

                    <div className="text-center mb-8">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Total Amount</p>
                        <h1 className="text-3xl font-black text-slate-900">₦{receiptData.amount}</h1>
                        <div className="inline-block bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded mt-2 border border-green-100">PAYMENT SUCCESSFUL</div>
                    </div>

                    <div className="space-y-3 text-sm border-t border-slate-100 pt-6">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Transaction Ref</span>
                            <span className="font-mono font-bold text-slate-900 text-xs">{receiptData.ref}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Date</span>
                            <span className="font-bold text-slate-900">{receiptData.date}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Recipient</span>
                            <span className="font-bold text-slate-900">{receiptData.phone}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Product</span>
                            <span className="font-bold text-slate-900">{receiptData.plan}</span>
                        </div>
                    </div>

                    <div className="mt-12 pt-6 border-t border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400 mb-1">If you have any issues, contact support:</p>
                        <p className="text-xs font-bold text-slate-700">{EMAIL}</p>
                        <p className="text-xs font-bold text-slate-700">{DISPLAY_NUMBER}</p>
                    </div>
                </div>
             </div>

             <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 gap-3 z-10">
                 <button onClick={downloadReceiptImage} className="py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <Download size={18}/> Save Image
                 </button>
                 <button onClick={() => window.location.reload()} className="py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <RefreshCw size={18}/> New Order
                 </button>
             </div>
        </div>
      )}

      {/* --- GIVEAWAY VIEW --- */}
      {view === 'giveaway' && (
          <>
            <Header title="Giveaway Entry" showBack={true} />
            <div className="flex-1 p-6 space-y-4 bg-slate-50">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <select value={gaNet} onChange={e=>setGaNet(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700">
                        <option value="MTN">MTN</option><option value="GLO">Glo</option><option value="AIRTEL">Airtel</option>
                    </select>
                    <input value={gaPhone} onChange={e=>setGaPhone(e.target.value)} type="tel" placeholder="Phone Number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium" />
                    <input value={gaKey} onChange={e=>setGaKey(e.target.value)} placeholder="Giveaway Code" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium" />
                </div>
                <button onClick={handleGiveaway} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold mt-4 shadow-lg shadow-green-200 active:scale-95 transition-transform flex justify-center gap-2">
                    <WhatsappIcon /> Submit via WhatsApp
                </button>
            </div>
          </>
      )}

      {/* --- COMPLAINT VIEW --- */}
      {view === 'complaint' && (
          <>
            <Header title="Support" showBack={true} />
            <div className="flex-1 p-6 space-y-4 bg-slate-50">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <input value={compName} onChange={e=>setCompName(e.target.value)} placeholder="Your Name" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium" />
                    <input value={compPhone} onChange={e=>setCompPhone(e.target.value)} type="tel" placeholder="Phone Number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium" />
                    <textarea value={compMsg} onChange={e=>setCompMsg(e.target.value)} placeholder="Describe your issue..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none h-32 font-medium resize-none" />
                 </div>
                <button onClick={handleComplaint} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold mt-4 shadow-lg shadow-green-200 active:scale-95 transition-transform flex justify-center gap-2">
                     <WhatsappIcon /> Send via WhatsApp
                </button>
            </div>
          </>
      )}

      {/* --- TRACK VIEW --- */}
      {view === 'track' && (
          <>
            <Header title="Track Order" showBack={true} />
            <div className="flex-1 p-6 bg-slate-50">
                <div className="flex gap-2 mb-6">
                    <input value={trackQuery} onChange={e=>setTrackQuery(e.target.value)} placeholder="Phone or Ref ID" className="flex-1 p-4 bg-white border border-slate-200 rounded-xl outline-none font-medium shadow-sm" />
                    <button onClick={handleTrack} className="bg-blue-600 text-white px-6 rounded-xl font-bold shadow-md active:scale-95 transition-transform">Check</button>
                </div>
                {trackResult && (
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        {trackResult.transactions ? trackResult.transactions.map(t => (
                            <div key={t.id} className="border-b border-slate-100 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-slate-800">{t.plan_id}</span>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.status==='success'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>{t.status}</span>
                                </div>
                                <div className="text-xs text-slate-400 font-medium mb-2">{new Date(t.created_at).toLocaleString()}</div>
                                <div className="flex gap-2">
                                    {t.status === 'success' ? (
                                        <button onClick={() => openReceiptFromTrack(t)} className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg flex items-center justify-center gap-1 hover:bg-slate-200">
                                            <FileText size={12}/> Receipt
                                        </button>
                                    ) : (
                                        <button onClick={() => retryFromTrack(t)} className="flex-1 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg flex items-center justify-center gap-1 hover:bg-blue-100">
                                            <RefreshCw size={12}/> Retry
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

      <style jsx global>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
      `}</style>
    </div>
  );
}
                          
