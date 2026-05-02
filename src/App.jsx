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
  deleteDoc, serverTimestamp, getDoc, writeBatch, increment 
} from 'firebase/firestore';
import { 
  Book, Plus, Trash2, Edit2, CheckCircle2, Loader2, 
  GraduationCap, RefreshCw, 
  Image as ImageIcon, Upload, Heart, ChevronUp, ChevronDown, LogOut, Mail, Lock, AlertCircle
} from 'lucide-react';

// --- Configuration ---
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

const STABLE_STORAGE_ID = "cpa_tracker_final_storage_fixed";

// --- 固定メッセージデータ ---
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

// --- 合格くんコンポーネント ---
const Mascot = () => {
  const [shuffledIndices, setShuffledIndices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const indices = MASCOT_MESSAGES.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledIndices(indices);
  }, []);

  const nextMessage = () => {
    setCurrentIndex((prev) => (prev + 1) % MASCOT_MESSAGES.length);
  };

  useEffect(() => {
    const t = setInterval(nextMessage, 600000); 
    return () => clearInterval(t);
  }, []);

  const msg = shuffledIndices.length > 0 ? MASCOT_MESSAGES[shuffledIndices[currentIndex]] : "...";

  return (
    <div className="flex items-start gap-2 bg-indigo-900 p-2.5 rounded-xl border border-indigo-700 cursor-pointer hover:bg-indigo-800 transition-all flex-1 min-w-0 shadow-inner" onClick={nextMessage}>
      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=CPA-Cheer-Final&backgroundColor=6366f1" alt="Mascot" className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1 mb-1">
          <Heart className="w-2 h-2 text-rose-400 fill-rose-400" />
          <span className="text-[7px] font-black text-indigo-300 uppercase tracking-tighter">Support Message</span>
        </div>
        <p className="text-[10px] font-bold text-white leading-normal break-words">{msg}</p>
      </div>
    </div>
  );
};

// --- メインコンポーネント ---
const App = () => {
  // 認証関連
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState("");
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  // データ関連
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

  const fileInputRef = useRef(null);
  const [form, setForm] = useState({ title: '', totalPages: '', currentPage: '', coverUrl: '' });

  // 時計
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 認証監視
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 合計進捗
  const totalProgress = useMemo(() => {
    if (textbooks.length === 0) return { percent: 0, current: 0, total: 0 };
    const cur = textbooks.reduce((s, b) => s + (Number(b.currentPage) || 0), 0);
    const tot = textbooks.reduce((s, b) => s + (Number(b.totalPages) || 0), 0);
    return { percent: tot > 0 ? Math.round((cur / tot) * 100) : 0, current: cur, total: tot };
  }, [textbooks]);

  // データ取得
  useEffect(() => {
    if (!user) return;
    const todayStr = getTodayStr();
    setCurrentDate(todayStr);

    const goalRef = doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'settings', 'weeklyGoal');
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

    const todayRef = doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'dailyLogs', todayStr);
    const unsubToday = onSnapshot(todayRef, (snap) => {
      setTodayStudied(snap.exists() ? Number(snap.data().pages || 0) : 0);
    });

    const booksCol = collection(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks');
    const unsubBooks = onSnapshot(booksCol, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTextbooks(data.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)));
    });

    return () => { unsubGoal(); unsubToday(); unsubBooks(); };
  }, [user]);

  // アクション
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setIsAuthProcessing(true);
    try {
      if (isLoginMode) await signInWithEmailAndPassword(auth, authEmail, authPassword);
      else await createUserWithEmailAndPassword(auth, authEmail, authPassword);
    } catch (err) {
      setAuthError("認証に失敗しました。メール・パスワードを確認してください。");
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
    batch.update(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks', id), { currentPage: newVal, updatedAt: serverTimestamp() });
    batch.set(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'dailyLogs', currentDate), { pages: increment(dlt), updatedAt: serverTimestamp() }, { merge: true });
    batch.update(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'settings', 'weeklyGoal'), { remainingTarget: increment(-dlt), lastUpdatedDate: currentDate });
    await batch.commit();
  };

  const moveTextbook = async (index, direction) => {
    if (!user) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= textbooks.length) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks', textbooks[index].id), { sortOrder: targetIndex });
    batch.update(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks', textbooks[targetIndex].id), { sortOrder: index });
    await batch.commit();
  };

  const handleSave = (e) => {
    e.preventDefault(); 
    if (!user || !form.title) return;

    const bookData = { 
      ...form, 
      totalPages: Number(form.totalPages), 
      currentPage: Number(form.currentPage), 
      updatedAt: serverTimestamp(), 
      sortOrder: editingBookId ? (textbooks.find(t=>t.id===editingBookId)?.sortOrder || 0) : textbooks.length 
    };
    const targetId = editingBookId;

    setIsModalOpen(false); 
    setEditingBookId(null);
    setForm({ title: '', totalPages: '', currentPage: '', coverUrl: '' });

    const runAsyncSave = async () => {
      try {
        if (targetId) await updateDoc(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks', targetId), bookData);
        else await addDoc(collection(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks'), bookData);
      } catch (err) { console.error(err); }
    };
    runAsyncSave();
  };

  // --- 表示ロジック ---

  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        {/* スマホの入力制限を解除するためのスタイルタグ */}
        <style dangerouslySetInnerHTML={{ __html: `
          input { -webkit-user-select: text !important; user-select: text !important; }
        ` }} />
        
        <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 text-center relative z-50">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6"><GraduationCap className="w-8 h-8 text-white" /></div>
          <h1 className="text-2xl font-black text-slate-800 mb-2 font-mono tracking-tighter">CPA Tracker</h1>
          <p className="text-[10px] font-bold text-slate-400 mb-8 uppercase tracking-widest">Login to Sync Devices</p>
          
          <form onSubmit={handleAuth} className="space-y-4 text-left">
            <div className="space-y-1">
              <label htmlFor="auth-email" className="text-[9px] font-black text-slate-400 uppercase ml-2">Email Address</label>
              <input 
                required type="email" id="auth-email" autoComplete="email" placeholder="メールアドレス" 
                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl py-4 px-5 text-sm font-bold outline-none block" 
                value={authEmail} onChange={e => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="auth-password" className="text-[9px] font-black text-slate-400 uppercase ml-2">Password</label>
              <input 
                required type="password" id="auth-password" autoComplete="current-password" placeholder="パスワード" 
                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl py-4 px-5 text-sm font-bold outline-none block" 
                value={authPassword} onChange={e => setAuthPassword(e.target.value)}
              />
            </div>
            {authError && <div className="text-red-500 text-[10px] font-bold px-2">{authError}</div>}
            <button type="submit" disabled={isAuthProcessing} className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-sm shadow-xl active:scale-95 transition-all mt-4">{isAuthProcessing ? 'Processing...' : (isLoginMode ? 'Login' : 'Sign Up')}</button>
          </form>
          <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(""); }} className="mt-8 text-[11px] font-black text-indigo-600 uppercase tracking-wider">{isLoginMode ? 'New here? Sign Up' : 'Already have an account?'}</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-200" /></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans overflow-x-hidden">
      {/* スマホの入力制限を解除するためのスタイルタグ */}
      <style dangerouslySetInnerHTML={{ __html: `
        input { -webkit-user-select: text !important; user-select: text !important; }
      ` }} />
      
      {/* HEADER: 時計と日付・曜日表示を復元 */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-3 py-2 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Mascot />
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end shrink-0 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shadow-inner">
               <div className="text-[11px] font-black text-slate-800 font-mono tracking-tighter leading-none mb-1">
                 {time.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
               </div>
               <div className="text-[8px] font-black text-slate-400 leading-none">
                 {currentDate.replace(/-/g, '/')}({getDayName(currentDate)})
               </div>
            </div>
            <button onClick={() => setIsLogoutModalOpen(true)} className="p-2.5 bg-slate-100 text-slate-400 rounded-xl active:scale-90"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl w-full mx-auto p-3 sm:p-4 flex-grow pb-24">
        {/* STATS */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg border-b-4 border-slate-800">
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">残ノルマ</div>
            <div className="text-xl sm:text-2xl font-black truncate">{Number(remainingWeeklyTarget)}P</div>
          </div>
          <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm border-b-4 border-slate-50">
            <div className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1 text-nowrap">今日進捗</div>
            <div className="flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-black text-slate-800">{Number(todayStudied)}P</span>
              <button onClick={() => { if(textbooks.length > 0) updateProgress(textbooks[0].id, textbooks[0].currentPage + 1) }} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg active:scale-90 transition-transform"><Plus className="w-3 h-3" /></button>
            </div>
          </div>
          <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg border-b-4 border-indigo-700">
            <div className="text-white/60 text-[8px] font-black uppercase mb-1 text-center">全体</div>
            <div className="text-xl sm:text-2xl font-black text-center">{Number(totalProgress.percent)}%</div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">週間目標</span>
              <div className="flex items-center gap-1">
                <input type="number" value={weeklyGoalBase} onChange={(e) => setWeeklyGoalBase(parseInt(e.target.value || 0))} className="w-12 text-[12px] font-black text-indigo-600 outline-none bg-transparent" />
                <span className="text-[9px] font-bold text-slate-300">P/w</span>
              </div>
            </div>
            <button onClick={() => setDoc(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user?.uid, 'settings', 'weeklyGoal'), { remainingTarget: weeklyGoalBase, lastUpdatedDate: getTodayStr() }, { merge: true })} className="p-1.5 text-slate-300 active:rotate-180 transition-all"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <button onClick={() => { setEditingBookId(null); setForm({title:'',totalPages:'',currentPage:'',coverUrl:''}); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-lg active:scale-95 flex items-center gap-2"><Plus className="w-4 h-4" /> <span className="font-black text-xs text-nowrap">教材追加</span></button>
        </div>

        {/* TEXTBOOK LIST */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {textbooks.map((b, idx) => {
            const prog = Math.round((Number(b.currentPage) / (Number(b.totalPages) || 1)) * 100);
            return (
              <div key={b.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm flex overflow-hidden group hover:shadow-md transition-all active:bg-slate-50/50">
                <div className="w-20 sm:w-24 bg-slate-50 flex-shrink-0 flex items-center justify-center border-r border-slate-100 relative">
                  {b.coverUrl ? <img src={String(b.coverUrl)} className="w-full h-full object-cover" alt="" /> : <div className="flex flex-col items-center gap-1 opacity-20"><Book className="w-6 h-6 text-slate-800" /><span className="text-[10px] font-black text-slate-800">{Number(prog)}%</span></div>}
                </div>
                <div className="p-4 flex-grow flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex justify-between items-start mb-1 gap-1">
                      <h3 className="font-black text-sm text-slate-800 truncate flex-1 text-left">{String(b.title)}</h3>
                      <div className="flex shrink-0 gap-0.5 bg-slate-100/50 rounded-lg p-0.5 border border-slate-100">
                         <button onClick={() => moveTextbook(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 disabled:opacity-10 active:text-indigo-600"><ChevronUp className="w-3.5 h-3.5" /></button>
                         <button onClick={() => moveTextbook(idx, 1)} disabled={idx === textbooks.length - 1} className="p-1 text-slate-400 disabled:opacity-10 active:text-indigo-600"><ChevronDown className="w-3.5 h-3.5" /></button>
                         <div className="w-px h-3 bg-slate-200 my-auto mx-0.5"></div>
                         <button onClick={() => { setEditingBookId(b.id); setForm({title:b.title,totalPages:b.totalPages,currentPage:b.currentPage,coverUrl:b.coverUrl||""}); setIsModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                         <button onClick={() => setDeleteConfirmId(b.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                       <div className="flex-grow bg-slate-100 h-2 rounded-full overflow-hidden"><div className={`h-full transition-all duration-700 ${prog >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${prog}%` }} /></div>
                       <span className="text-[10px] font-black text-slate-400 w-8 text-right shrink-0">{Number(prog)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={Number(b.currentPage)} onChange={(e) => updateProgress(b.id, e.target.value)} className="w-14 bg-slate-50 text-center text-sm font-black rounded-xl py-2 border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-100" />
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">/ {Number(b.totalPages)} P</span>
                    </div>
                    {prog >= 100 && <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-in zoom-in" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODALS */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 transform animate-in zoom-in-95 duration-300 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-black text-center mb-8 font-mono">{editingBookId ? '情報を修正' : '教材を追加'}</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <input required type="text" placeholder="教材名" className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-indigo-600 border-2 border-transparent" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <div className="flex flex-col items-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {form.coverUrl ? <img src={String(form.coverUrl)} className="w-20 h-28 object-cover rounded-xl shadow-md" alt="" /> : <><ImageIcon className="w-6 h-6 text-slate-300" /><span className="text-[10px] font-black text-slate-400 text-center">カバー画像アップロード<br/>(省略可)</span></>}
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={async (e) => { const file = e.target.files[0]; if(file) setForm({...form, coverUrl: await resizeImage(file)}); }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-left"><label className="text-[9px] font-black text-slate-400 ml-2">総ページ数</label><input required type="number" className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-sm outline-none" value={form.totalPages} onChange={e => setForm({...form, totalPages: e.target.value})} /></div>
                <div className="space-y-1 text-left"><label className="text-[9px] font-black text-slate-400 ml-2">現在のページ</label><input type="number" className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-sm outline-none" value={form.currentPage} onChange={e => setForm({...form, currentPage: e.target.value})} /></div>
              </div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 py-4 rounded-2xl font-black text-xs active:scale-95 transition-all">キャンセル</button><button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all">保存する</button></div>
            </form>
          </div>
        </div>
      )}

      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-xs shadow-2xl p-8 text-center">
            <h3 className="font-black text-lg mb-2 text-slate-800">ログアウトしますか？</h3>
            <p className="text-[11px] text-slate-400 mb-8 leading-relaxed font-bold">ログイン中のメールアドレス:<br/>{user?.email}</p>
            <div className="flex gap-3"><button onClick={() => setIsLogoutModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl text-[11px] font-black active:scale-95 transition-all">キャンセル</button><button onClick={handleLogout} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black shadow-lg active:scale-95 transition-all">ログアウト</button></div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-[2rem] w-full max-w-xs shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
            <h3 className="font-black text-lg mb-2 text-slate-800">教材を削除しますか？</h3>
            <p className="text-[11px] text-slate-400 mb-8 font-bold text-balance">これまでの学習記録も削除されます。</p>
            <div className="flex gap-3"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl text-[11px] font-black active:scale-95 transition-all">キャンセル</button><button onClick={async () => { if(user) { await deleteDoc(doc(db, 'artifacts', STABLE_STORAGE_ID, 'users', user.uid, 'textbooks', deleteConfirmId)); setDeleteConfirmId(null); } }} className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-[11px] font-black shadow-lg active:scale-95 transition-all">削除する</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
