import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp, 
  writeBatch, 
  increment, 
  getDocs,
  getDoc,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import { 
  Book, Plus, Trash2, Edit2, CheckCircle2, Loader2, 
  GraduationCap, RefreshCw, 
  Image as ImageIcon, Heart, ChevronUp, ChevronDown, LogOut, Database, AlertTriangle, UserCheck, Activity, Wifi, WifiOff
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
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

/**
 * 【同期の絶対命題：V1300-SUPREME】
 * 過去の全ての便利機能と、最新の自動同期・オフライン復旧を統合。
 */
const VERSION = "V1300-FULL";
const MASTER_STORAGE_PATH = "CPA_STUDY_MASTER_FINAL_STORAGE";

const MASCOT_MESSAGES = [
  "今日も一歩前進！その積み重ねが確実に合格へと繋がっていますよ。",
  "休憩も大切な戦略の一つ。リフレッシュして次の1ページへ進みましょう！",
  "あなたのこれまでの努力は裏切りません。自信を持って、自分を信じて。",
  "難しい論点にぶつかるのは、あなたが成長している証拠です。大丈夫！",
  "集中力が上がっていますね！今の素晴らしい感覚を大切にしてください。",
  "公認会計士という大きな夢に向かって、着実に歩んでいる姿は素敵です。",
  "一問一問の理解が、本番での大きな1点に繋がります。丁寧にいきましょう。",
  "テキストがボロボロになるほど、あなたの実力は研ぎ澄まされていきます。",
  "机に向かうその決意こそが、合格者としての第一歩。今日も素晴らしいです！",
  "深呼吸を一回して。落ち着いて取り組めば、必ず解けるようになりますよ。"
];

const getTodayStr = () => new Date().toLocaleDateString('sv-SE'); 
const getDayName = (dateStr) => ['日','月','火','水','木','金','土'][new Date(dateStr).getDay()];
const getWeekNumber = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const resizeImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

const App = () => {
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

  const [textbooks, setTextbooks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(getTodayStr());
  const [time, setTime] = useState(new Date());

  const [weeklyGoalBase, setWeeklyGoalBase] = useState(380);
  const [remainingWeeklyTarget, setRemainingWeeklyTarget] = useState(380);
  const [todayStudied, setTodayStudied] = useState(0);

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fileInputRef = useRef(null);
  const [form, setForm] = useState({ title: '', totalPages: '', currentPage: '', coverUrl: '' });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const totalProgress = useMemo(() => {
    if (textbooks.length === 0) return { percent: 0, current: 0, total: 0 };
    const cur = textbooks.reduce((s, b) => s + (Number(b.currentPage) || 0), 0);
    const tot = textbooks.reduce((s, b) => s + (Number(b.totalPages) || 0), 0);
    return { percent: tot > 0 ? Math.round((cur / tot) * 100) : 0, current: cur, total: tot };
  }, [textbooks]);

  // --- 自動オンライン復旧エンジン ---
  const forceOnline = async () => {
    try {
      await enableNetwork(db);
      setIsOnline(true);
      setSyncError(null);
    } catch (e) {
      console.error("Enable network failed");
    }
  };

  useEffect(() => {
    const handleOnline = () => forceOnline();
    const handleOffline = () => setIsOnline(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') forceOnline();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // --- データ同期ロジック ---
  useEffect(() => {
    if (!user) return;
    setSyncError(null);
    setCurrentDate(getTodayStr());
    forceOnline();

    const goalRef = doc(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'settings', 'weeklyGoal');
    const unsubGoal = onSnapshot(goalRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        // 週が変わっていたらノルマをリセット
        const todayStr = getTodayStr();
        if (d.lastUpdatedDate && getWeekNumber(todayStr) !== getWeekNumber(d.lastUpdatedDate)) {
           setDoc(goalRef, { remainingTarget: Number(d.baseTarget || 380), lastUpdatedDate: todayStr }, { merge: true });
        }
        setRemainingWeeklyTarget(Number(d.remainingTarget ?? 380));
        setWeeklyGoalBase(Number(d.baseTarget ?? 380));
      } else {
        setDoc(goalRef, { remainingTarget: 380, baseTarget: 380, lastUpdatedDate: getTodayStr() });
      }
    }, (err) => {
      if (err.message.includes('offline')) setIsOnline(false);
      setSyncError(err.message);
    });

    const todayRef = doc(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'dailyLogs', getTodayStr());
    const unsubToday = onSnapshot(todayRef, (snap) => {
      setTodayStudied(snap.exists() ? Number(snap.data().pages || 0) : 0);
    });

    const booksCol = collection(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'textbooks');
    const unsubBooks = onSnapshot(booksCol, (snap) => {
      setTextbooks(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0)));
    });

    return () => { unsubGoal(); unsubToday(); unsubBooks(); };
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setIsAuthProcessing(true);
    const cleanEmail = authEmail.trim();
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, authPassword);
    } catch (err) {
      setAuthError("認証失敗");
    } finally { setIsAuthProcessing(false); }
  };

  const updateProgress = async (id, val) => {
    if (!user) return;
    const b = textbooks.find(x => x.id === id);
    if (!b) return;
    const newVal = Math.min(Math.max(0, parseInt(val || 0)), b.totalPages);
    const dlt = newVal - b.currentPage;
    if (dlt === 0) return;

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'textbooks', id), { currentPage: newVal, updatedAt: serverTimestamp() });
      batch.set(doc(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'dailyLogs', getTodayStr()), { pages: increment(dlt), updatedAt: serverTimestamp() }, { merge: true });
      batch.update(doc(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'settings', 'weeklyGoal'), { remainingTarget: increment(-dlt), lastUpdatedDate: getTodayStr() });
      await batch.commit();
    } catch (e) { setSyncError("保存失敗"); }
  };

  const moveTextbook = async (index, direction) => {
    if (!user) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= textbooks.length) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'textbooks', textbooks[index].id), { sortOrder: targetIndex });
      batch.update(doc(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'textbooks', textbooks[targetIndex].id), { sortOrder: index });
      await batch.commit();
    } catch (e) { setSyncError("移動失敗"); }
  };

  const handleSave = async (e) => {
    e.preventDefault(); 
    if (!user || !form.title) return;
    const bookData = { 
      ...form, 
      totalPages: Number(form.totalPages), 
      currentPage: Number(form.currentPage), 
      updatedAt: serverTimestamp(), 
      sortOrder: editingBookId ? (textbooks.find(t=>t.id===editingBookId)?.sortOrder || 0) : textbooks.length 
    };
    setIsModalOpen(false);
    try {
      if (editingBookId) await updateDoc(doc(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'textbooks', editingBookId), bookData);
      else await addDoc(collection(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'textbooks'), bookData);
      setEditingBookId(null);
      setForm({ title: '', totalPages: '', currentPage: '', coverUrl: '' });
    } catch (err) { setSyncError("教材追加失敗"); }
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6"><GraduationCap className="w-8 h-8 text-white" /></div>
          <h1 className="text-2xl font-black mb-6">CPA Tracker</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <input required type="email" placeholder="Email" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-4 font-bold outline-none" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
            <input required type="password" placeholder="Password" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-4 font-bold outline-none" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
            <button type="submit" className="w-full bg-indigo-600 text-white rounded-xl py-4 font-black shadow-lg">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: `input { font-size: 16px !important; }` }} />

      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-3 py-2 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex-1 bg-indigo-900 p-2 rounded-xl border border-indigo-700 flex items-start gap-2 shadow-inner overflow-hidden">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
               <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Study" className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-bold text-white leading-tight truncate">{MASCOT_MESSAGES[Math.floor(time.getMinutes() / 4) % MASCOT_MESSAGES.length]}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={forceOnline} className={`p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 ${isSyncing ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button>
            <div className="flex flex-col items-end bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shadow-inner shrink-0">
               <div className="text-[11px] font-black text-slate-800 font-mono tracking-tighter leading-none mb-1">{time.toLocaleTimeString('ja-JP', { hour12: false })}</div>
               <div className="text-[8px] font-black text-slate-400 leading-none">{getTodayStr().replace(/-/g, '/')}({getDayName(getTodayStr())})</div>
            </div>
            <button onClick={() => signOut(auth)} className="p-2.5 bg-slate-100 text-slate-400 rounded-xl"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl w-full mx-auto p-3 sm:p-4 flex-grow pb-32">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 text-center font-black">
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg border-b-4 border-slate-800"><div className="text-[8px] text-slate-400 uppercase mb-1">残ノルマ</div><div className="text-xl sm:text-2xl truncate">{remainingWeeklyTarget}P</div></div>
          <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm border-b-4 border-slate-50"><div className="text-[8px] text-indigo-600 uppercase mb-1">今日進捗</div><div className="text-xl sm:text-2xl">{todayStudied}P</div></div>
          <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg border-b-4 border-indigo-700"><div className="text-white/60 text-[8px] uppercase mb-1">全体進捗</div><div className="text-xl sm:text-2xl">{totalProgress.percent}%</div></div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">週間目標</span>
              <div className="flex items-center gap-1"><input type="number" value={weeklyGoalBase} onChange={(e) => setWeeklyGoalBase(parseInt(e.target.value || 0))} className="w-12 text-[12px] font-black text-indigo-600 outline-none bg-transparent" /><span className="text-[9px] font-bold text-slate-300">P/w</span></div>
            </div>
            <button onClick={() => setDoc(doc(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user?.uid, 'settings', 'weeklyGoal'), { remainingTarget: weeklyGoalBase, lastUpdatedDate: getTodayStr() }, { merge: true })} className="p-1.5 text-slate-300 active:rotate-180 transition-all ml-2"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <button onClick={() => { setEditingBookId(null); setForm({title:'',totalPages:'',currentPage:'',coverUrl:''}); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-lg active:scale-95 flex items-center gap-2 font-black text-xs text-nowrap"><Plus className="w-4 h-4" /> 教材追加</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {textbooks.map((b, idx) => {
            const prog = Math.round((Number(b.currentPage) / (Number(b.totalPages) || 1)) * 100);
            return (
              <div key={b.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm flex overflow-hidden active:bg-slate-50/50">
                <div className="w-24 bg-slate-50 flex-shrink-0 flex items-center justify-center border-r border-slate-100 relative">
                  {b.coverUrl ? <img src={String(b.coverUrl)} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-1 opacity-20"><Book className="w-6 h-6" /><span className="text-[10px] font-black">{prog}%</span></div>}
                </div>
                <div className="p-4 flex-grow flex flex-col justify-between min-w-0 text-left">
                  <div>
                    <div className="flex justify-between items-start mb-1 gap-1">
                      <h3 className="font-black text-sm text-slate-800 truncate flex-1">{b.title}</h3>
                      <div className="flex gap-1 shrink-0">
                         <button onClick={() => moveTextbook(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 disabled:opacity-5"><ChevronUp className="w-4 h-4" /></button>
                         <button onClick={() => moveTextbook(idx, 1)} disabled={idx === textbooks.length - 1} className="p-1 text-slate-400 disabled:opacity-5"><ChevronDown className="w-4 h-4" /></button>
                         <button onClick={() => { setEditingBookId(b.id); setForm({title:b.title,totalPages:b.totalPages,currentPage:b.currentPage,coverUrl:b.coverUrl||""}); setIsModalOpen(true); }} className="p-1 text-slate-400"><Edit2 className="w-4 h-4" /></button>
                         <button onClick={() => { if(window.confirm('削除しますか？')) deleteDoc(doc(db, 'artifacts', MASTER_STORAGE_PATH, 'users', user.uid, 'textbooks', b.id)) }} className="p-1 text-slate-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                       <div className="flex-grow bg-slate-100 h-2 rounded-full overflow-hidden"><div className={`h-full transition-all duration-700 ${prog >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${prog}%` }} /></div>
                       <span className="text-[10px] font-black text-slate-400 shrink-0">{prog}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5"><input type="number" value={Number(b.currentPage)} onChange={(e) => updateProgress(b.id, e.target.value)} className="w-16 bg-slate-50 text-center text-sm font-black rounded-xl py-2 border border-slate-100 outline-none" /><span className="text-[10px] text-slate-400 font-bold shrink-0">/ {Number(b.totalPages)} P</span></div>
                    {prog >= 100 && <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-in zoom-in" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <div className="fixed bottom-4 left-4 right-4 flex flex-col gap-1 pointer-events-none z-[100]">
        <div className="flex items-center justify-between">
          <div className="bg-white/95 px-3 py-1.5 rounded-full border border-slate-100 shadow-lg flex items-center gap-2">
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-indigo-600" /> : <WifiOff className="w-3.5 h-3.5 text-red-500 animate-pulse" />}
            <span className={`text-[8px] font-black uppercase ${isOnline ? 'text-slate-500' : 'text-red-500'}`}>{isOnline ? 'Full Auto-Sync' : 'Reconnecting...'}</span>
          </div>
          <div className="bg-indigo-600 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 text-[8px] font-black text-white">
             {VERSION} <UserCheck className="w-2.5 h-2.5 ml-1" /> UID:{user?.uid.slice(-12).toUpperCase()}
          </div>
        </div>
        {syncError && <div className="bg-red-50 text-red-600 px-3 py-2 rounded-xl border border-red-200 text-[7px] font-black flex items-center gap-2 shadow-lg"><AlertTriangle className="w-3 h-3" /> {syncError}</div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] pointer-events-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-center mb-8">{editingBookId ? '教材を編集' : '教材を追加'}</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <input required type="text" placeholder="教材名" className="w-full bg-slate-50 rounded-xl px-4 py-4 font-bold text-base outline-none border border-slate-200" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <div className="flex flex-col items-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {form.coverUrl ? <img src={String(form.coverUrl)} className="w-20 h-28 object-cover rounded-xl shadow-md" /> : <><ImageIcon className="w-6 h-6 text-slate-300" /><span className="text-[10px] font-black text-slate-400">カバー画像をアップロード</span></>}
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={async (e) => { if(e.target.files[0]) setForm({...form, coverUrl: await resizeImage(e.target.files[0])}); }} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 ml-1 uppercase">総ページ数</label><input required type="number" className="w-full bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none border border-slate-200" value={form.totalPages} onChange={e => setForm({...form, totalPages: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 ml-1 uppercase">現在ページ</label><input type="number" className="w-full bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none border border-slate-200" value={form.currentPage} onChange={e => setForm({...form, currentPage: e.target.value})} /></div>
              </div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => { setIsModalOpen(false); setEditingBookId(null); }} className="flex-1 bg-slate-100 py-4 rounded-xl font-black">キャンセル</button><button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg">保存する</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
