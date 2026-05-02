import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, addDoc, updateDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { 
  Book, Plus, Trash2, Edit2, CheckCircle2, Loader2, 
  Zap, MessageCircle, Send, X, GraduationCap, RefreshCw, Image as ImageIcon, Upload, TrendingUp, Lightbulb, ChevronRight
} from 'lucide-react';

// --- Configuration ---
// 提供されたFirebase設定を反映
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyBgPwP-30BuXvuydRe6NsYJInMVMlmaWsE",
  authDomain: "cpa-tracker-a0f14.firebaseapp.com",
  projectId: "cpa-tracker-a0f14",
  storageBucket: "cpa-tracker-a0f14.firebasestorage.app",
  messagingSenderId: "77528125896",
  appId: "1:77528125896:web:13829c71b21a7870d870fd",
  measurementId: "G-FNL3C7R07M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 提供されたGemini APIキーを反映
const apiKey = typeof __apiKey !== 'undefined' ? __apiKey : "AIzaSyBUbKnN0pqo6xKQwDskUt_F_XvQDGraAAw";

const STABLE_STORAGE_ID = "cpa_tracker_final_storage_fixed";

// --- Utils ---
const getTodayStr = () => new Date().toLocaleDateString('sv-SE'); 
const getDayName = (dateStr) => {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  try { return days[new Date(dateStr).getDay()]; } catch (e) { return ""; }
};

const resizeImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

// --- 合格くん（分析・特化型） ---
const MascotCompact = ({ callGeminiAI, chatMessages }) => {
  const [point, setPoint] = useState("思考回路を接続中...");
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchPoint = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const recentConsults = chatMessages
        .filter(m => m.role === 'user')
        .slice(-2)
        .map(m => m.text)
        .join(' / ');

      const systemPrompt = `
        あなたは公認会計士試験の超ベテラン講師「合格くん」です。
        【重要】
        直近の相談内容（${recentConsults || "なし"}）を分析し、
        受験生が知らない、または論文式で差がつく高度な知識を1つ提示してください。
        進捗への言及や励ましは一切禁止。専門用語を駆使し100文字以内で結論だけを述べてください。
      `;
      
      const response = await callGeminiAI("核心的な試験知識を1つ提示せよ。", systemPrompt);
      setPoint(response ? String(response) : "【財務】包括利益と当期純利益のリサイクリング。不適切な組替調整はクリーン・サープラス関係を崩壊させる。");
    } catch (e) {
      setPoint("【企業法】株主総会決議の瑕疵。取消事由、無効、不存在の法的性質の差異。");
    } finally { setIsGenerating(false); }
  };

  useEffect(() => { 
    fetchPoint();
    const t = setInterval(fetchPoint, 300000); 
    return () => clearInterval(t); 
  }, [chatMessages.length]);

  return (
    <div className="flex items-start gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-800 transition-all flex-1 min-w-0 shadow-inner" onClick={fetchPoint}>
      <div className={`w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-md ${isGenerating ? 'animate-pulse' : ''}`}>
        <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=CPA-Analytic-v2&backgroundColor=6366f1`} alt="Mascot" className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 mb-0.5">
          <Lightbulb className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
          <span className="text-[8px] font-black text-amber-400 uppercase tracking-tight">Core Knowledge</span>
        </div>
        <p className="text-[11px] font-bold text-slate-100 leading-tight line-clamp-2">
          {String(point)}
        </p>
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [textbooks, setTextbooks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(getTodayStr());
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [time, setTime] = useState(new Date());

  const [weeklyGoalBase, setWeeklyGoalBase] = useState(380);
  const [remainingWeeklyTarget, setRemainingWeeklyTarget] = useState(380);
  const [todayStudied, setTodayStudied] = useState(0);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({ title: '', totalPages: '', currentPage: '', coverUrl: '' });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalProgress = useMemo(() => {
    if (textbooks.length === 0) return { percent: 0, current: 0, total: 0 };
    const cur = textbooks.reduce((s, b) => s + (Number(b.currentPage) || 0), 0);
    const tot = textbooks.reduce((s, b) => s + (Number(b.totalPages) || 0), 0);
    return { percent: tot > 0 ? Math.round((cur / tot) * 100) : 0, current: cur, total: tot };
  }, [textbooks]);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), [chatMessages, isAiTyping]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Auth error"); }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const callGeminiAI = async (q, s, retry = 3) => {
    const currentApiKey = apiKey || "";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${currentApiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: String(q) }] }], systemInstruction: { parts: [{ text: String(s) }] } })
      });
      const json = await res.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) {
      if (retry > 0) return callGeminiAI(q, s, retry - 1);
      return null;
    }
  };

  const handleSendChatMessage = async (e, customMsg = null) => {
    if (e) e.preventDefault();
    const msgText = customMsg || chatInput;
    if (!msgText.trim() || isAiTyping || !user) return;
    
    const newUserMsg = { role: 'user', text: String(msgText), timestamp: new Date().getTime() };
    setChatMessages(p => [...p, newUserMsg]);
    setChatInput("");
    setIsAiTyping(true);

    try {
      const contextPrompt = `あなたは公認会計士試験のプロ講師です。正確な知識を持って回答してください。`;
      const res = await callGeminiAI(msgText, contextPrompt);
      const newAiMsg = { role: 'assistant', text: String(res || "AI通信エラー"), timestamp: new Date().getTime() };
      
      const chatCol = collection(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'chatHistory');
      await addDoc(chatCol, newUserMsg);
      await addDoc(chatCol, newAiMsg);
    } catch (e) { 
      setChatMessages(p => [...p, { role: 'assistant', text: 'エラーが発生しました。' }]); 
    } finally { 
      setIsAiTyping(false); 
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const goalRef = doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'settings', 'weeklyGoal');
    onSnapshot(goalRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setRemainingWeeklyTarget(Number(d.remainingTarget ?? 380));
        setWeeklyGoalBase(Number(d.baseTarget ?? 380));
      } else {
        setDoc(goalRef, { remainingTarget: 380, baseTarget: 380, lastUpdatedDate: getTodayStr() });
      }
    });

    const todayRef = doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'dailyLogs', currentDate);
    onSnapshot(todayRef, (snap) => {
      if (snap.exists()) setTodayStudied(Number(snap.data().pages || 0));
      else setTodayStudied(0);
    });

    const booksCol = collection(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks');
    onSnapshot(booksCol, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTextbooks(data.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      setLoading(false);
    });

    const chatCol = collection(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'chatHistory');
    onSnapshot(chatCol, (snap) => {
      const msgs = snap.docs.map(d => d.data()).sort((a, b) => a.timestamp - b.timestamp);
      if (msgs.length > 0) setChatMessages(msgs);
      else setChatMessages([{ role: 'assistant', text: 'Gemini先生です。論点解説や学習戦略の相談をどうぞ。' }]);
    });
  }, [user, currentDate]);

  const updateProgress = async (id, val) => {
    if (!user) return;
    const b = textbooks.find(x => x.id === id);
    if (!b) return;
    const n = Math.min(Math.max(0, parseInt(val || 0)), b.totalPages);
    const dlt = n - b.currentPage;
    try {
      await updateDoc(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks', id), { currentPage: n, updatedAt: serverTimestamp() });
      if (dlt !== 0) {
        const r = doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'dailyLogs', currentDate);
        const s = await getDoc(r);
        const cur = s.exists() ? (s.data().pages || 0) : 0;
        await setDoc(r, { pages: Math.max(0, cur + dlt), updatedAt: serverTimestamp() }, { merge: true });
        const goalRef = doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'settings', 'weeklyGoal');
        await setDoc(goalRef, { remainingTarget: Math.max(0, remainingWeeklyTarget - dlt) }, { merge: true });
      }
    } catch (e) { console.error(e); }
  };

  const handleSave = async (e) => {
    e.preventDefault(); if (!user || !form.title) return;
    try {
      const d = { 
        title: String(form.title), 
        totalPages: Number(form.totalPages) || 0, 
        currentPage: Number(form.currentPage) || 0, 
        coverUrl: String(form.coverUrl || ""),
        updatedAt: serverTimestamp(), 
        sortOrder: textbooks.length 
      };
      if (editingBookId) await updateDoc(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks', editingBookId), d);
      else await addDoc(collection(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks'), d);
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };

  const dailyGoalCalc = Math.ceil(remainingWeeklyTarget / Math.max(1, (7 - (new Date(currentDate).getDay() + 6) % 7)));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans select-none overflow-x-hidden">
      
      {/* --- TOP BAR --- */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-3 py-2 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <MascotCompact callGeminiAI={callGeminiAI} chatMessages={chatMessages} />
          
          <div className="flex flex-col items-end shrink-0 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
             <div className="text-[12px] font-black text-slate-800 font-mono tracking-tighter leading-none">
                {time.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
             </div>
             <div className="text-[8px] font-black text-slate-400 mt-0.5">
               <span>{currentDate.replace(/-/g, '/')}({getDayName(currentDate)})</span>
             </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl w-full mx-auto p-3 sm:p-4 flex-grow pb-24">
        {/* --- STATS TILES --- */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg border-b-4 border-slate-800">
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">残ノルマ</div>
            <div className="text-xl sm:text-2xl font-black truncate">{remainingWeeklyTarget}P</div>
            <div className="mt-1 text-[8px] font-bold text-white/40">今日目標: {dailyGoalCalc}P</div>
          </div>
          <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm border-b-4 border-slate-50">
            <div className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1">今日進捗</div>
            <div className="flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-black text-slate-800">{todayStudied}P</span>
              <button 
                onClick={() => { if(textbooks[0]) updateProgress(textbooks[0].id, textbooks[0].currentPage + 1) }}
                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg active:scale-90 transition-transform"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg border-b-4 border-indigo-700">
            <div className="text-white/60 text-[8px] font-black uppercase mb-1 text-center">全体</div>
            <div className="text-xl sm:text-2xl font-black text-center">{totalProgress.percent}%</div>
            <div className="text-[7px] text-center font-bold opacity-50 truncate">{totalProgress.current}/{totalProgress.total}P</div>
          </div>
        </div>

        {/* --- CONTROLS --- */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase">週間目標</span>
              <div className="flex items-center gap-1">
                <input 
                  type="number" 
                  value={weeklyGoalBase} 
                  onChange={(e) => setWeeklyGoalBase(parseInt(e.target.value || 0))}
                  className="w-12 text-[12px] font-black text-indigo-600 outline-none bg-transparent"
                />
                <span className="text-[9px] font-bold text-slate-300">P/w</span>
              </div>
            </div>
            <button 
              onClick={() => setDoc(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user?.uid, 'settings', 'weeklyGoal'), { remainingTarget: weeklyGoalBase, lastUpdatedDate: getTodayStr() }, { merge: true })} 
              className="p-1.5 text-slate-300 hover:text-indigo-400 active:rotate-180 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => { setEditingBookId(null); setForm({title:'',totalPages:'',currentPage:'',coverUrl:''}); setIsModalOpen(true); }}
            className="bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> <span className="font-black text-xs">教材追加</span>
          </button>
        </div>

        {/* --- LIST --- */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-200" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {textbooks.map((b) => {
              const prog = Math.round((Number(b.currentPage) / (Number(b.totalPages) || 1)) * 100);
              return (
                <div key={b.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm flex overflow-hidden group hover:shadow-md transition-all">
                  <div className="w-20 sm:w-24 bg-slate-50 flex-shrink-0 flex items-center justify-center border-r border-slate-100 relative overflow-hidden">
                      {b.coverUrl ? (
                        <img src={b.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Book className="w-5 h-5 text-slate-200" />
                          <span className="text-[10px] font-black text-slate-200">{prog}%</span>
                        </div>
                      )}
                  </div>
                  <div className="p-4 flex-grow flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-black text-sm text-slate-800 line-clamp-1">{b.title}</h3>
                        <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => { setEditingBookId(b.id); setForm({title:b.title,totalPages:b.totalPages,currentPage:b.currentPage,coverUrl:b.coverUrl||""}); setIsModalOpen(true); }} className="text-slate-300 hover:text-indigo-600 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                           <button onClick={() => setDeleteConfirmId(b.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                         <div className="flex-grow bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-700 ${prog >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${prog}%` }} />
                         </div>
                         <span className="text-[10px] font-black text-slate-400 w-8 text-right">{prog}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="number" 
                          value={b.currentPage} 
                          onChange={(e) => updateProgress(b.id, e.target.value)}
                          className="w-12 bg-slate-50 text-center text-xs font-black rounded-lg py-2 border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">/ {b.totalPages} P</span>
                      </div>
                      {prog >= 100 && <div className="bg-emerald-50 p-1 rounded-full"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* --- MOBILE CHAT --- */}
      <div className={`fixed inset-x-0 bottom-0 z-50 transition-all duration-500 transform ${isChatOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-20 opacity-0 pointer-events-none'}`}>
        <div className="bg-white w-full md:max-w-sm md:ml-auto md:mr-6 md:mb-6 h-[85vh] md:h-[500px] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_-20px_40px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col overflow-hidden">
          <div className="bg-indigo-600 p-5 flex items-center justify-between text-white shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center"><MessageCircle className="w-5 h-5" /></div>
              <span className="text-xs font-black uppercase tracking-wider">Consulting AI</span>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </div>
          
          <div className="flex-grow overflow-y-auto p-5 space-y-4 bg-slate-50/50">
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-bold leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isAiTyping && <div className="flex gap-1.5 p-2"><div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce delay-75" /></div>}
            <div ref={chatEndRef} />
          </div>
          
          <form onSubmit={handleSendChatMessage} className="p-4 bg-white border-t border-slate-100 pb-8 md:pb-4">
            <div className="relative flex items-center">
              <input 
                type="text" 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                placeholder="Gemini先生に相談..." 
                className="w-full bg-slate-50 rounded-2xl px-5 py-4 text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-600 transition-all pr-12" 
              />
              <button 
                type="submit" 
                className="absolute right-2 p-2 bg-indigo-600 text-white rounded-xl active:scale-90 disabled:bg-slate-200 transition-all"
                disabled={!chatInput.trim() || isAiTyping}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {!isChatOpen && (
        <button 
          onClick={() => setIsChatOpen(true)} 
          className="fixed bottom-6 right-6 bg-indigo-600 text-white w-14 h-14 rounded-2xl shadow-2xl hover:scale-110 active:scale-90 transition-all z-40 flex items-center justify-center border-4 border-white"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* --- MODALS --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 transform animate-in zoom-in-95 duration-300">
            <h2 className="text-xl font-black text-center mb-8">{editingBookId ? '教材の情報を修正' : '新しい教材を追加'}</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">教材名</label>
                <input required type="text" placeholder="例：財務会計論 肢別演習" className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-sm outline-none border-2 border-transparent focus:border-indigo-600" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">教材カバー</label>
                <div 
                  className="flex flex-col items-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 cursor-pointer hover:border-indigo-400 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {form.coverUrl ? (
                    <div className="relative group">
                      <img src={form.coverUrl} className="w-20 h-28 object-cover rounded-xl shadow-md" />
                      <div className="absolute inset-0 bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white"><Upload className="w-6 h-6" /></div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400"><ImageIcon className="w-6 h-6" /></div>
                      <span className="text-[10px] font-black text-slate-400">タップして画像をアップロード</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={async (e) => { const file = e.target.files[0]; if(file) setForm({...form, coverUrl: await resizeImage(file)}); }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">総ページ</label>
                  <input required type="number" className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-sm outline-none border-2 border-transparent focus:border-indigo-600" value={form.totalPages} onChange={e => setForm({...form, totalPages: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">現在</label>
                  <input type="number" className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-sm outline-none border-2 border-transparent focus:border-indigo-600" value={form.currentPage} onChange={e => setForm({...form, currentPage: e.target.value})} />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl text-xs active:scale-95 transition-all">戻る</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl text-xs shadow-lg active:scale-95 transition-all">保存する</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRM --- */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-[2rem] w-full max-w-xs shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 className="w-8 h-8" /></div>
            <h3 className="font-black text-lg mb-2 text-slate-800">教材を削除しますか？</h3>
            <p className="text-[11px] text-slate-400 mb-8 leading-relaxed">この教材の進捗データもすべて削除されます。よろしいですか？</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl text-[10px] font-black text-slate-500">キャンセル</button>
              <button onClick={() => { if(user) deleteDoc(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks', deleteConfirmId)); setDeleteConfirmId(null); }} className="flex-1 py-4 bg-red-500 rounded-2xl text-[10px] font-black text-white shadow-lg">削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;