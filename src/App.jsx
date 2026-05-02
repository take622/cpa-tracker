import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, addDoc, updateDoc, 
  deleteDoc, serverTimestamp, writeBatch, increment, getDoc, getDocs 
} from 'firebase/firestore';
import { 
  Book, Plus, Trash2, Edit2, CheckCircle2, Loader2, 
  GraduationCap, RefreshCw, 
  Image as ImageIcon, Upload, Heart, ChevronUp, ChevronDown, LogOut, Mail, Lock, AlertCircle, ShieldCheck
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
 * 【同期の絶対条件】
 * 環境変数を一切使わず、この固定文字列をアプリIDとして使用します。
 * これによりPC(Gemini)とスマホ(Vercel)が「100%同じ場所」を読み書きします。
 */
const PERMANENT_APP_ID = "CPA_STUDY_TRACKER_SHARED_DATABASE";

// --- 固定メッセージ ---
const MASCOT_MESSAGES = [
  "今日も一歩前進！その積み重ねが確実に合格へと繋がっていますよ。",
  "休憩も大切な戦略の一つ。リフレッシュして次の1ページへ進みましょう！",
  "あなたのこれまでの努力は裏切りません。自信を持って、自分を信じて。",
  "難しい論点にぶつかるのは、あなたが成長している証拠です。大丈夫！",
  "ノルマ達成おめでとうございます！明日もこの良いリズムを維持しましょう。",
  "少しずつでも、昨日より前に進んでいる自分を褒めてあげてくださいね。",
  "体調管理も立派な試験対策です。今日は無理せず、早めに休みましょうか。",
  "集中力が上がっていますね！今の素晴らしい感覚を大切にしてください。",
  "公認会計士という大きな夢に向かって、着実に歩んでいる姿は素敵です。",
  "苦しい時こそ、合格後の自分を想像してみてください。応援しています！",
  "一問一問の理解が、本番での大きな1点に繋がります。丁寧にいきましょう。",
  "周りと比べず、自分のペースで着実に。あなたの道は間違っていません。",
  "テキストがボロボロになるほど、あなたの実力は研ぎ澄まされていきます。",
  "机に向かうその決意こそが、合格者としての第一歩。今日も素晴らしいです！",
  "深呼吸を一回して。落ち着いて取り組めば、必ず解けるようになりますよ。"
];

// --- Utils ---
const getTodayStr = () => new Date().toLocaleDateString('sv-SE'); 
const getDayName = (dateStr) => {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  try { return days[new Date(dateStr).getDay()]; } catch (e) { return ""; }
};
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

const Mascot = () => {
  const [index, setIndex] = useState(0);
  return (
    <div className="flex items-start gap-2 bg-indigo-900 p-2.5 rounded-xl border border-indigo-700 cursor-pointer flex-1 min-w-0" onClick={() => setIndex(i => (i + 1) % MASCOT_MESSAGES.length)}>
      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Final-Support&backgroundColor=6366f1" alt="Mascot" className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1 mb-0.5">
          <Heart className="w-2 h-2 text-rose-400 fill-rose-400" />
          <span className="text-[7px] font-black text-indigo-300 uppercase tracking-tighter">Support Message</span>
        </div>
        <p className="text-[10px] font-bold text-white leading-tight break-words">{MASCOT_MESSAGES[index]}</p>
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState("");
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

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

  // 1秒ごとの時計
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 認証状態の監視
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

  // 【デバイス間リアルタイム同期ロジック】
  useEffect(() => {
    if (!user) return;
    const todayStr = getTodayStr();
    setCurrentDate(todayStr);

    // 1. 週間設定の同期 (PERMANENT_APP_IDで全デバイスのフォルダを完全固定)
    const goalRef = doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'settings', 'weeklyGoal');
    const unsubGoal = onSnapshot(goalRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (getWeekNumber(todayStr) !== getWeekNumber(d.lastUpdatedDate || "") && d.lastUpdatedDate) {
          updateDoc(goalRef, { remainingTarget: Number(d.baseTarget || 380), lastUpdatedDate: todayStr });
        }
        setRemainingWeeklyTarget(Number(d.remainingTarget ?? 380));
        setWeeklyGoalBase(Number(d.baseTarget ?? 380));
      } else {
        setDoc(goalRef, { remainingTarget: 380, baseTarget: 380, lastUpdatedDate: todayStr });
      }
    });

    // 2. 今日の勉強量の同期
    const todayRef = doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'dailyLogs', todayStr);
    const unsubToday = onSnapshot(todayRef, (snap) => {
      setTodayStudied(snap.exists() ? Number(snap.data().pages || 0) : 0);
    });

    // 3. 教材リストの同期
    const booksCol = collection(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'textbooks');
    const unsubBooks = onSnapshot(booksCol, (snap) => {
      setTextbooks(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)));
    });

    return () => { unsubGoal(); unsubToday(); unsubBooks(); };
  }, [user]);

  // 手動更新機能（自動同期の補助）
  const forceSync = async () => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    try {
      const todayStr = getTodayStr();
      const goalRef = doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'settings', 'weeklyGoal');
      const gSnap = await getDoc(goalRef);
      if (gSnap.exists()) {
        setRemainingWeeklyTarget(Number(gSnap.data().remainingTarget));
        setWeeklyGoalBase(Number(gSnap.data().baseTarget));
      }
      
      const booksCol = collection(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'textbooks');
      const bSnap = await getDocs(booksCol);
      setTextbooks(bSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)));
      
      setTimeout(() => setIsSyncing(false), 800);
    } catch (e) {
      console.error(e);
      setIsSyncing(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setIsAuthProcessing(true);
    try {
      if (isLoginMode) await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      else await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
    } catch (err) {
      setAuthError("認証に失敗。正しいメール/パスワードを入力してください。");
    } finally { setIsAuthProcessing(false); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setTextbooks([]);
    setIsLogoutModalOpen(false);
  };

  const updateProgress = async (id, val) => {
    if (!user) return;
    const b = textbooks.find(x => x.id === id);
    if (!b) return;
    const newVal = Math.min(Math.max(0, parseInt(val || 0)), b.totalPages);
    const dlt = newVal - b.currentPage;
    if (dlt === 0) return;

    const batch = writeBatch(db);
    batch.update(doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'textbooks', id), { currentPage: newVal, updatedAt: serverTimestamp() });
    batch.set(doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'dailyLogs', currentDate), { pages: increment(dlt), updatedAt: serverTimestamp() }, { merge: true });
    batch.update(doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'settings', 'weeklyGoal'), { remainingTarget: increment(-dlt), lastUpdatedDate: currentDate });
    await batch.commit();
  };

  const moveTextbook = async (index, direction) => {
    if (!user) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= textbooks.length) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'textbooks', textbooks[index].id), { sortOrder: targetIndex });
    batch.update(doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'textbooks', textbooks[targetIndex].id), { sortOrder: index });
    await batch.commit();
  };

  const handleSave = (e) => {
    e.preventDefault(); 
    if (!user || !form.title) return;
    const bookData = { ...form, totalPages: Number(form.totalPages), currentPage: Number(form.currentPage), updatedAt: serverTimestamp(), sortOrder: editingBookId ? (textbooks.find(t=>t.id===editingBookId)?.sortOrder || 0) : textbooks.length };
    const tid = editingBookId;
    setIsModalOpen(false); setEditingBookId(null); setForm({ title: '', totalPages: '', currentPage: '', coverUrl: '' });
    const runSave = async () => {
      try {
        if (tid) await updateDoc(doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'textbooks', tid), bookData);
        else await addDoc(collection(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'textbooks'), bookData);
      } catch (err) { console.error(err); }
    };
    runSave();
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center font-sans"><Loader2 className="w-8 h-8 animate-spin text-indigo-200" /></div>;

  // --- LOGIN VIEW (入力感度最優先) ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <style dangerouslySetInnerHTML={{ __html: `
          body { -webkit-user-select: auto !important; user-select: auto !important; }
          input { font-size: 16px !important; pointer-events: auto !important; -webkit-user-select: text !important; user-select: text !important; }
        ` }} />
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6"><GraduationCap className="w-8 h-8 text-white" /></div>
          <h2 className="text-2xl font-black text-slate-800 mb-2 font-mono tracking-tighter text-center">CPA Tracker</h2>
          <p className="text-[10px] font-bold text-slate-400 mb-8 uppercase tracking-widest text-center">Sync Across All Devices</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="text-left">
              <label htmlFor="e-in" className="text-[9px] font-black text-slate-400 uppercase ml-1">Email Address</label>
              <input required type="email" id="e-in" placeholder="メールアドレス" className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl py-4 px-4 text-base font-bold outline-none block" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
            </div>
            <div className="text-left">
              <label htmlFor="p-in" className="text-[9px] font-black text-slate-400 uppercase ml-1">Password</label>
              <input required type="password" id="p-in" placeholder="パスワード" className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl py-4 px-4 text-base font-bold outline-none block" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
            </div>
            {authError && <div className="text-red-500 text-[10px] font-bold py-1">{authError}</div>}
            <button type="submit" disabled={isAuthProcessing} className="w-full bg-indigo-600 text-white rounded-xl py-4 font-black text-sm shadow-md active:scale-95 transition-all mt-4">{isAuthProcessing ? '接続中...' : (isLoginMode ? 'Login' : 'Sign Up')}</button>
          </form>
          <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(""); }} className="mt-8 text-[11px] font-black text-indigo-600 uppercase tracking-wider block w-full text-center">{isLoginMode ? 'New here? Create Account' : 'Back to Login'}</button>
        </div>
      </div>
    );
  }

  // --- MAIN VIEW ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: `input { font-size: 16px !important; -webkit-user-select: text !important; user-select: text !important; pointer-events: auto !important; }` }} />

      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-3 py-2 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Mascot />
          <div className="flex items-center gap-2">
            <button onClick={forceSync} className={`p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 active:scale-90 transition-all ${isSyncing ? 'animate-spin text-indigo-600' : ''}`}><RefreshCw className="w-4 h-4" /></button>
            <div className="flex flex-col items-end shrink-0 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shadow-inner">
               <div className="text-[11px] font-black text-slate-800 font-mono tracking-tighter leading-none mb-1">{time.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
               <div className="text-[8px] font-black text-slate-400 leading-none">{currentDate.replace(/-/g, '/')}({getDayName(currentDate)})</div>
            </div>
            <button onClick={() => setIsLogoutModalOpen(true)} className="p-2.5 bg-slate-100 text-slate-400 rounded-xl active:scale-90"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl w-full mx-auto p-3 sm:p-4 flex-grow pb-24">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 text-center">
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg border-b-4 border-slate-800"><div className="text-[8px] font-black text-slate-400 uppercase mb-1">残ノルマ</div><div className="text-xl sm:text-2xl font-black truncate">{Number(remainingWeeklyTarget)}P</div></div>
          <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm border-b-4 border-slate-50">
            <div className="text-[8px] font-black text-indigo-600 uppercase mb-1">今日進捗</div>
            <div className="flex items-center justify-center gap-1"><span className="text-xl sm:text-2xl font-black text-slate-800">{Number(todayStudied)}P</span><button onClick={() => { if(textbooks.length > 0) updateProgress(textbooks[0].id, textbooks[0].currentPage + 1) }} className="p-0.5 bg-indigo-50 text-indigo-600 rounded-md active:scale-90"><Plus className="w-3 h-3" /></button></div>
          </div>
          <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg border-b-4 border-indigo-700"><div className="text-white/60 text-[8px] font-black uppercase mb-1 text-nowrap">全体進捗</div><div className="text-xl sm:text-2xl font-black">{Number(totalProgress.percent)}%</div></div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">週間目標</span>
              <div className="flex items-center gap-1">
                <input type="number" value={weeklyGoalBase} onChange={(e) => setWeeklyGoalBase(parseInt(e.target.value || 0))} className="w-12 text-[12px] font-black text-indigo-600 outline-none bg-transparent" />
                <span className="text-[9px] font-bold text-slate-300">P/w</span>
              </div>
            </div>
            <button onClick={() => setDoc(doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user?.uid, 'settings', 'weeklyGoal'), { remainingTarget: weeklyGoalBase, lastUpdatedDate: getTodayStr() }, { merge: true })} className="p-1.5 text-slate-300 active:rotate-180 transition-all"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <button onClick={() => { setEditingBookId(null); setForm({title:'',totalPages:'',currentPage:'',coverUrl:''}); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-lg active:scale-95 flex items-center gap-2 font-black text-xs text-nowrap"><Plus className="w-4 h-4" /> 教材追加</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {textbooks.map((b, idx) => {
            const prog = Math.round((Number(b.currentPage) / (Number(b.totalPages) || 1)) * 100);
            return (
              <div key={b.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm flex overflow-hidden group active:bg-slate-50/50">
                <div className="w-20 sm:w-24 bg-slate-50 flex-shrink-0 flex items-center justify-center border-r border-slate-100 relative overflow-hidden">
                  {b.coverUrl ? <img src={String(b.coverUrl)} className="w-full h-full object-cover" alt="" /> : <div className="flex flex-col items-center gap-1 opacity-20"><Book className="w-6 h-6 text-slate-800" /><span className="text-[10px] font-black text-slate-800">{Number(prog)}%</span></div>}
                </div>
                <div className="p-4 flex-grow flex flex-col justify-between min-w-0 text-left">
                  <div>
                    <div className="flex justify-between items-start mb-1 gap-1">
                      <h3 className="font-black text-sm text-slate-800 truncate flex-1">{String(b.title)}</h3>
                      <div className="flex shrink-0 gap-1">
                         <button onClick={() => moveTextbook(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 disabled:opacity-10 active:scale-90"><ChevronUp className="w-4 h-4" /></button>
                         <button onClick={() => moveTextbook(idx, 1)} disabled={idx === textbooks.length - 1} className="p-1 text-slate-400 disabled:opacity-10 active:scale-90"><ChevronDown className="w-4 h-4" /></button>
                         <button onClick={() => { setEditingBookId(b.id); setForm({title:b.title,totalPages:b.totalPages,currentPage:b.currentPage,coverUrl:b.coverUrl||""}); setIsModalOpen(true); }} className="text-slate-400 p-1 active:scale-90"><Edit2 className="w-4 h-4" /></button>
                         <button onClick={() => setDeleteConfirmId(b.id)} className="text-slate-400 p-1 active:scale-90"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3"><div className="flex-grow bg-slate-100 h-2 rounded-full overflow-hidden"><div className={`h-full transition-all duration-700 ${prog >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${prog}%` }} /></div><span className="text-[10px] font-black text-slate-400 w-8 text-right shrink-0">{Number(prog)}%</span></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5"><input type="number" value={Number(b.currentPage)} onChange={(e) => updateProgress(b.id, e.target.value)} className="w-14 bg-slate-50 text-center text-sm font-black rounded-xl py-2 border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 select-text" /><span className="text-[10px] text-slate-400 font-bold shrink-0">/ {Number(b.totalPages)} P</span></div>
                    {prog >= 100 && <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-in zoom-in" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* SYNC INDICATOR (UID照合用) */}
      <div className="fixed bottom-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
        <div className="bg-white/90 px-3 py-1.5 rounded-full border border-slate-100 shadow-sm flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-nowrap">Cloud Mastery</span>
        </div>
        <div className="bg-white/90 px-3 py-1.5 rounded-full border border-slate-100 shadow-sm flex items-center gap-1.5">
           <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-bounce' : 'bg-emerald-500'}`} />
           <span className="text-[7px] font-bold text-slate-500 font-mono uppercase tracking-tighter">UID:{user?.uid.slice(-8)}</span>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] pointer-events-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-black text-center mb-8 font-mono">{editingBookId ? '修正' : '追加'}</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <input required type="text" placeholder="教材名" className="w-full bg-slate-50 rounded-xl px-4 py-4 font-bold text-base outline-none border border-slate-200 select-text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <div className="flex flex-col items-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {form.coverUrl ? <img src={String(form.coverUrl)} className="w-20 h-28 object-cover rounded-xl shadow-md" alt="" /> : <><ImageIcon className="w-6 h-6 text-slate-300" /><span className="text-[10px] font-black text-slate-400 text-center">カバー画像アップロード</span></>}
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={async (e) => { const f = e.target.files[0]; if(f) setForm({...form, coverUrl: await resizeImage(f)}); }} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 ml-1 uppercase">Total</label><input required type="number" className="w-full bg-slate-50 rounded-xl px-4 py-3 font-bold text-base outline-none border border-slate-200 select-text" value={form.totalPages} onChange={e => setForm({...form, totalPages: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 ml-1 uppercase">Current</label><input type="number" className="w-full bg-slate-50 rounded-xl px-4 py-3 font-bold text-base outline-none border border-slate-200 select-text" value={form.currentPage} onChange={e => setForm({...form, currentPage: e.target.value})} /></div>
              </div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 py-4 rounded-xl font-black text-xs active:scale-95">キャンセル</button><button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-black text-xs shadow-lg active:scale-95">保存する</button></div>
            </form>
          </div>
        </div>
      )}

      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] pointer-events-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-xs shadow-2xl p-8 text-center border border-slate-200">
            <h3 className="font-black text-lg mb-2 text-slate-800">ログアウトしますか？</h3>
            <p className="text-[11px] text-slate-400 mb-8 font-bold">ログイン中: {user?.email}</p>
            <div className="flex gap-3"><button onClick={() => setIsLogoutModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl text-[11px] font-black active:scale-95">キャンセル</button><button onClick={handleLogout} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black shadow-lg active:scale-95 transition-all">ログアウト</button></div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] pointer-events-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-xs shadow-2xl p-8 text-center border border-slate-200">
            <h3 className="font-black text-lg mb-2 text-slate-800">教材を削除しますか？</h3>
            <p className="text-[11px] text-slate-400 mb-8 font-bold">記録もすべて削除されます。</p>
            <div className="flex gap-3"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl text-[11px] font-black active:scale-95">キャンセル</button><button onClick={async () => { if(user) { await deleteDoc(doc(db, 'artifacts', PERMANENT_APP_ID, 'users', user.uid, 'textbooks', deleteConfirmId)); setDeleteConfirmId(null); } }} className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-[11px] font-black shadow-md active:scale-95">削除する</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
