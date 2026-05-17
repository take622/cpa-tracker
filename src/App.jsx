// ============================================================
// CPA Study Tracker - App.jsx
// Safari入力完全修正版（backdropFilter完全除去）
// FIXED_ID: CPA_ROOT_V7000 (絶対変更禁止)
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
  enableNetwork,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBgPwP-30BuXvuydRe6NsYJInMVMlmaWsE",
  authDomain: "cpa-tracker-a0f14.firebaseapp.com",
  projectId: "cpa-tracker-a0f14",
  storageBucket: "cpa-tracker-a0f14.firebasestorage.app",
  messagingSenderId: "77528125896",
  appId: "1:77528125896:web:13829c71b21a7870d870fd",
};

const FIXED_ID = "CPA_ROOT_V7000";
const DEFAULT_WEEKLY = 100;
const DAY_JA = ["日","月","火","水","木","金","土"];

const fbApp = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

const P = (uid) => ({
  settings: doc(db, `artifacts/${FIXED_ID}/users/${uid}/settings/weeklyGoal`),
  tbCol:    collection(db, `artifacts/${FIXED_ID}/users/${uid}/textbooks`),
  tb:  (id) => doc(db, `artifacts/${FIXED_ID}/users/${uid}/textbooks/${id}`),
  log: (dt) => doc(db, `artifacts/${FIXED_ID}/users/${uid}/dailyLogs/${dt}`),
});

const pad = (n) => String(n).padStart(2, "0");
const toDay = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const toMonday = () => {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const resizeImg = (file) => new Promise((res) => {
  const r = new FileReader();
  r.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let [w, h] = [img.width, img.height];
      if (w > 200) { h = h * 200 / w; w = 200; }
      if (h > 200) { w = w * 200 / h; h = 200; }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      res(c.toDataURL("image/jpeg", 0.7));
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
});

const MSGS = [
  "今日も一歩前進！合格まであと少し！",
  "継続は力なり。君なら絶対できる！",
  "難しい問題も積み重ねで必ず解ける！",
  "一日一日を大切に。合格は目の前だ！",
  "諦めなければ必ず道は開ける！",
  "今の努力が未来の自分を救う！",
  "合格くんはいつも君の味方だぞ！",
  "小さな積み重ねが大きな結果に！",
  "今日の頑張りを明日の自分が感謝する！",
  "財務諸表も最初は誰でも苦手。大丈夫！",
];
const shuffle = (a) => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; };

// ============================================================
// グローバルCSS（index.htmlの<head>に追加することを推奨）
// ============================================================
const GCSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #0d1117; }
  input, textarea {
    font-size: 16px !important;
    -webkit-appearance: none !important;
    -webkit-user-select: auto !important;
    user-select: auto !important;
    touch-action: manipulation !important;
  }
  button { -webkit-tap-highlight-color: transparent; }
`;

// ============================================================
// 確認ダイアログ
// ============================================================
function ConfirmDlg({ msg, okLabel, okColor, onOk, onCancel }) {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"rgba(0,0,0,0.8)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"20px",
    }}>
      <div style={{
        background:"#1e2533",
        border:"1px solid rgba(255,255,255,0.15)",
        borderRadius:"16px",
        padding:"28px 20px 24px",
        width:"100%", maxWidth:"300px",
        textAlign:"center",
        fontFamily:"'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif",
      }}>
        <p style={{ color:"#e2e8f0", fontSize:"16px", lineHeight:1.65, margin:"0 0 24px" }}>{msg}</p>
        <div style={{ display:"flex", gap:"10px" }}>
          <button onClick={onCancel} style={{
            flex:1, padding:"13px",
            background:"rgba(255,255,255,0.08)",
            border:"1px solid rgba(255,255,255,0.15)",
            borderRadius:"10px",
            color:"rgba(255,255,255,0.75)",
            fontSize:"15px", fontWeight:"600", cursor:"pointer",
          }}>キャンセル</button>
          <button onClick={onOk} style={{
            flex:1, padding:"13px",
            background: okColor,
            border:"none", borderRadius:"10px",
            color:"#fff", fontSize:"15px", fontWeight:"700", cursor:"pointer",
          }}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ログイン画面
// ★ Safari対策: backdropFilter一切なし・filterなし・overflowなし
// ============================================================
function LoginScreen({ onLogin, onSignup }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [isNew, setIsNew] = useState(false);
  const [err,   setErr]   = useState("");
  const [busy,  setBusy]  = useState(false);

  const submit = async () => {
    if (!email || !pass) { setErr("メールとパスワードを入力してください"); return; }
    setErr(""); setBusy(true);
    try {
      isNew ? await onSignup(email, pass) : await onLogin(email, pass);
    } catch (e) {
      const m = {
        "auth/user-not-found":       "メールアドレスが見つかりません",
        "auth/wrong-password":       "パスワードが間違っています",
        "auth/invalid-credential":   "メールまたはパスワードが間違っています",
        "auth/email-already-in-use": "このメールは既に使用されています",
        "auth/weak-password":        "パスワードは6文字以上にしてください",
        "auth/invalid-email":        "メールアドレスの形式が正しくありません",
      };
      setErr(m[e.code] || e.message);
    } finally { setBusy(false); }
  };

  return (
    <>
      <style>{GCSS}</style>
      <div style={{
        minHeight: "100vh",
        // ★ backdropFilter禁止・filter禁止
        background: "#0f1923",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif",
      }}>
        <div style={{
          width: "100%",
          maxWidth: "360px",
          // ★ backdropFilter禁止・filter禁止・overflow禁止
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.13)",
          borderRadius: "20px",
          padding: "36px 24px 40px",
        }}>
          <div style={{ textAlign:"center", marginBottom:"28px" }}>
            <div style={{ fontSize:"52px", lineHeight:1, marginBottom:"10px" }}>📚</div>
            <div style={{ color:"#fff", fontSize:"20px", fontWeight:"700" }}>CPA Study Tracker</div>
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"12px", marginTop:"5px" }}>合格への道を、一緒に歩もう</div>
          </div>

          <div style={{ display:"flex", background:"rgba(0,0,0,0.35)", borderRadius:"10px", padding:"4px", marginBottom:"24px" }}>
            {["ログイン","新規登録"].map((l,i) => (
              <button key={i} onClick={() => { setIsNew(i===1); setErr(""); }} style={{
                flex:1, padding:"10px", border:"none", borderRadius:"7px",
                fontSize:"14px", fontWeight:"600", cursor:"pointer",
                background: isNew===(i===1) ? "#63b3ed" : "transparent",
                color:      isNew===(i===1) ? "#1a1a2e" : "rgba(255,255,255,0.55)",
              }}>{l}</button>
            ))}
          </div>

          {/* ★ メール input: 親にposition:relative等一切なし */}
          <div style={{ marginBottom:"14px" }}>
            <label style={{ display:"block", color:"rgba(255,255,255,0.65)", fontSize:"14px", marginBottom:"7px" }}>
              メールアドレス
            </label>
            <input
              type="email"
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              style={{
                display:"block", width:"100%", padding:"14px",
                fontSize:"16px", lineHeight:"1.4",
                color:"#fff", background:"rgba(255,255,255,0.1)",
                border:"1px solid rgba(255,255,255,0.2)",
                borderRadius:"10px", outline:"none",
                WebkitAppearance:"none",
              }}
            />
          </div>

          {/* ★ パスワード input */}
          <div style={{ marginBottom:"22px" }}>
            <label style={{ display:"block", color:"rgba(255,255,255,0.65)", fontSize:"14px", marginBottom:"7px" }}>
              パスワード
            </label>
            <input
              type="password"
              autoComplete={isNew ? "new-password" : "current-password"}
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="6文字以上"
              style={{
                display:"block", width:"100%", padding:"14px",
                fontSize:"16px", lineHeight:"1.4",
                color:"#fff", background:"rgba(255,255,255,0.1)",
                border:"1px solid rgba(255,255,255,0.2)",
                borderRadius:"10px", outline:"none",
                WebkitAppearance:"none",
              }}
            />
          </div>

          {err && (
            <div style={{
              background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)",
              borderRadius:"8px", padding:"10px 14px",
              color:"#fca5a5", fontSize:"13px", marginBottom:"14px",
            }}>{err}</div>
          )}

          <button onClick={submit} disabled={busy} style={{
            display:"block", width:"100%", padding:"15px",
            fontSize:"16px", fontWeight:"700",
            background: busy ? "rgba(99,179,237,0.3)" : "#4299e1",
            border:"none", borderRadius:"10px", color:"#fff",
            cursor: busy ? "not-allowed" : "pointer",
          }}>
            {busy ? "処理中..." : isNew ? "アカウント作成" : "ログイン"}
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// ルート
// ============================================================
export default function App() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }), []);

  useEffect(() => {
    const fn = () => { if (document.visibilityState === "visible") enableNetwork(db).catch(()=>{}); };
    document.addEventListener("visibilitychange", fn);
    const t = setInterval(() => enableNetwork(db).catch(()=>{}), 60000);
    return () => { document.removeEventListener("visibilitychange", fn); clearInterval(t); };
  }, []);

  if (loading) return (
    <>
      <style>{GCSS}</style>
      <div style={{ minHeight:"100vh", background:"#0d1117", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:"17px", fontFamily:"sans-serif" }}>
        読み込み中...
      </div>
    </>
  );

  if (!user) return (
    <LoginScreen
      onLogin={(e,p)  => signInWithEmailAndPassword(auth, e, p)}
      onSignup={(e,p) => createUserWithEmailAndPassword(auth, e, p)}
    />
  );

  return <Dashboard user={user} onLogout={() => signOut(auth)} />;
}

// ============================================================
// ダッシュボード
// ============================================================
function Dashboard({ user, onLogout }) {
  const uid = user.uid;

  const [books,      setBooks]      = useState([]);
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY);
  const [lastMonday, setLastMonday] = useState(null);
  const [todayLog,   setTodayLog]   = useState({ pages:0, startOfDayPages:0 });
  const [now,        setNow]        = useState(new Date());
  const [mascotMsg,  setMascotMsg]  = useState("");
  const [showMascot, setShowMascot] = useState(false);
  const [sync,       setSync]       = useState("ok");
  const [modal,      setModal]      = useState(null);
  const [editBook,   setEditBook]   = useState(null);
  const [form,       setForm]       = useState({ name:"", total:"", cur:"", img:"" });
  const [goalForm,   setGoalForm]   = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmOut, setConfirmOut] = useState(false);

  const msgQ   = useRef(shuffle(MSGS));
  const msgIdx = useRef(0);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const nextMsg = useCallback(() => {
    if (msgIdx.current >= msgQ.current.length) { msgQ.current = shuffle(MSGS); msgIdx.current = 0; }
    setMascotMsg(msgQ.current[msgIdx.current++]);
    setShowMascot(true);
    setTimeout(() => setShowMascot(false), 4500);
  }, []);

  useEffect(() => { const t = setInterval(nextMsg, 30000); return () => clearInterval(t); }, [nextMsg]);

  useEffect(() => {
    const p = P(uid);
    return onSnapshot(p.settings, snap => {
      if (snap.exists()) {
        const d = snap.data();
        setWeeklyGoal(d.target ?? DEFAULT_WEEKLY);
        setLastMonday(d.lastResetMonday ?? null);
      } else {
        setDoc(p.settings, { target:DEFAULT_WEEKLY, lastResetMonday:toMonday(), updatedAt:serverTimestamp() }).catch(console.error);
      }
    }, console.error);
  }, [uid]);

  useEffect(() => {
    const q = query(P(uid).tbCol, orderBy("order","asc"));
    return onSnapshot(q, snap => setBooks(snap.docs.map(d => ({ id:d.id, ...d.data() }))), console.error);
  }, [uid]);

  useEffect(() => {
    return onSnapshot(P(uid).log(toDay()), snap => {
      if (snap.exists()) setTodayLog(snap.data());
    }, console.error);
  }, [uid]);

  useEffect(() => {
    if (!lastMonday) return;
    const mon = toMonday();
    if (lastMonday !== mon) setDoc(P(uid).settings, { lastResetMonday:mon, updatedAt:serverTimestamp() }, { merge:true }).catch(console.error);
  }, [lastMonday]);

  const totalCur      = books.reduce((s,b) => s+(b.currentPage||0), 0);
  const totalPages    = books.reduce((s,b) => s+(b.totalPages||0), 0);
  const overallPct    = totalPages > 0 ? Math.min(100, Math.round(totalCur / totalPages * 100)) : 0;
  const todayProgress = Math.max(0, totalCur - (todayLog.startOfDayPages||0));
  const remaining     = Math.max(0, weeklyGoal - todayProgress);

  const saveBook = async () => {
    const name = form.name.trim(); if (!name) return;
    const total = parseInt(form.total)||0;
    const cur   = Math.min(parseInt(form.cur)||0, total||999999);
    const p = P(uid);
    setModal(null); setSync("saving");
    try {
      if (editBook) {
        await setDoc(p.tb(editBook.id), { name, totalPages:total, currentPage:cur, imageBase64:form.img||editBook.imageBase64||"", order:editBook.order??Date.now(), updatedAt:serverTimestamp() }, { merge:true });
      } else {
        const id = `book_${Date.now()}`;
        const maxOrd = books.length ? Math.max(...books.map(b=>b.order??0)) : 0;
        await setDoc(p.tb(id), { name, totalPages:total, currentPage:cur, imageBase64:form.img||"", order:maxOrd+1, updatedAt:serverTimestamp() });
      }
      setSync("ok");
    } catch(e) { console.error(e); setSync("err"); }
  };

  const doDelete = async () => {
    const id = confirmDel; setConfirmDel(null); setSync("saving");
    try { await deleteDoc(P(uid).tb(id)); setSync("ok"); } catch(e) { setSync("err"); }
  };

  const moveBook = async (i, dir) => {
    const j = i+dir; if (j<0||j>=books.length) return;
    setSync("saving");
    try {
      await Promise.all([
        setDoc(P(uid).tb(books[i].id), { order:j }, { merge:true }),
        setDoc(P(uid).tb(books[j].id), { order:i }, { merge:true }),
      ]);
      setSync("ok");
    } catch(e) { setSync("err"); }
  };

  const changePage = async (book, delta) => {
    const newPage = Math.max(0, Math.min((book.currentPage||0)+delta, book.totalPages||999999));
    setSync("saving");
    try {
      await setDoc(P(uid).tb(book.id), { currentPage:newPage, updatedAt:serverTimestamp() }, { merge:true });
      const newTotal = books.reduce((s,b) => b.id===book.id ? s+newPage : s+(b.currentPage||0), 0);
      await setDoc(P(uid).log(toDay()), { pages:Math.max(0,newTotal-(todayLog.startOfDayPages||0)), startOfDayPages:todayLog.startOfDayPages||0, updatedAt:serverTimestamp() }, { merge:true });
      setSync("ok");
    } catch(e) { console.error(e); setSync("err"); }
  };

  const saveGoal = async () => {
    const val = parseInt(goalForm); if (!val||val<1) return;
    setModal(null); setSync("saving");
    try { await setDoc(P(uid).settings, { target:val, lastResetMonday:toMonday(), updatedAt:serverTimestamp() }, { merge:true }); setSync("ok"); }
    catch(e) { setSync("err"); }
  };

  const openAdd  = () => { setForm({ name:"",total:"",cur:"",img:"" }); setEditBook(null); setModal("add"); };
  const openEdit = (b) => { setForm({ name:b.name, total:String(b.totalPages||""), cur:String(b.currentPage||""), img:b.imageBase64||"" }); setEditBook(b); setModal("edit"); };
  const openSettings = () => { setGoalForm(String(weeklyGoal)); setModal("settings"); };
  const handleImg = async (e) => { const f=e.target.files?.[0]; if(f){const b64=await resizeImg(f); setForm(p=>({...p,img:b64}));} };

  const hh=pad(now.getHours()), mm=pad(now.getMinutes()), ss=pad(now.getSeconds());
  const dateStr=`${now.getFullYear()}/${pad(now.getMonth()+1)}/${pad(now.getDate())}(${DAY_JA[now.getDay()]})`;
  const syncColor = sync==="ok"?"#48bb78":sync==="saving"?"#f6ad55":"#fc8181";
  const font = "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif";

  return (
    <>
      <style>{GCSS}</style>
      <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0d1117,#1a1f35)", fontFamily:font, color:"#e2e8f0", paddingBottom:"60px" }}>

        {/* トップバー */}
        <div style={{ position:"sticky", top:0, zIndex:100, background:"#0d1117", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"10px 14px", display:"flex", alignItems:"center", gap:"8px" }}>
          <button onClick={nextMsg} style={{ background:"none", border:"none", fontSize:"26px", cursor:"pointer", padding:"4px", lineHeight:1 }}>📚</button>
          <div style={{ flex:1, textAlign:"center" }}>
            <div style={{ fontSize:"20px", fontWeight:"800", color:"#63b3ed", letterSpacing:"0.04em", lineHeight:1.1 }}>{hh}:{mm}:{ss}</div>
            <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", marginTop:"2px" }}>{dateStr}</div>
          </div>
          <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:syncColor }} />
            <Btn onClick={openSettings} sm>⚙️</Btn>
            <Btn onClick={() => setConfirmOut(true)} sm>🚪</Btn>
          </div>
        </div>

        {/* 合格くんバブル */}
        {showMascot && (
          <div style={{ position:"fixed", top:"64px", left:"50%", transform:"translateX(-50%)", zIndex:200, background:"#2d3748", border:"1px solid rgba(99,179,237,0.4)", borderRadius:"14px", padding:"11px 18px", maxWidth:"88vw", fontSize:"14px", color:"#bee3f8", boxShadow:"0 8px 28px rgba(0,0,0,0.45)" }}>
            {mascotMsg}
          </div>
        )}

        {/* サマリー */}
        <div style={{ padding:"14px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", maxWidth:"600px", margin:"0 auto" }}>
          <SCard icon="📅" label="残ノルマ"   value={remaining}    unit="p"  color="#fc8181" />
          <SCard icon="✏️" label="今日の進捗" value={todayProgress} unit="p"  color="#68d391" />
          <SCard icon="🎯" label="週間目標"   value={weeklyGoal}   unit="p"  color="#63b3ed" onClick={openSettings} />
          <SCard icon="📖" label="教材数"     value={books.length} unit="冊" color="#f6ad55" />
        </div>

        {/* 全体進捗バー */}
        {books.length > 0 && (
          <div style={{ padding:"0 14px 4px", maxWidth:"600px", margin:"0 auto" }}>
            <div style={{
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(139,92,246,0.25)",
              borderRadius:"14px",
              padding:"14px 16px",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                  <span style={{ fontSize:"16px" }}>🎓</span>
                  <span style={{ fontSize:"13px", color:"rgba(255,255,255,0.65)", fontWeight:"600" }}>全体進捗</span>
                </div>
                <div style={{ display:"flex", alignItems:"baseline", gap:"3px" }}>
                  <span style={{ fontSize:"24px", fontWeight:"800", color:"#a78bfa", lineHeight:1 }}>{overallPct}</span>
                  <span style={{ fontSize:"13px", color:"rgba(255,255,255,0.5)" }}>%</span>
                  <span style={{ fontSize:"11px", color:"rgba(255,255,255,0.35)", marginLeft:"6px" }}>
                    （{totalCur} / {totalPages} p）
                  </span>
                </div>
              </div>
              {/* プログレスバー */}
              <div style={{ height:"8px", background:"rgba(255,255,255,0.08)", borderRadius:"4px", overflow:"hidden" }}>
                <div style={{
                  height:"100%",
                  width:`${overallPct}%`,
                  borderRadius:"4px",
                  background: overallPct >= 100
                    ? "#68d391"
                    : "linear-gradient(90deg, #7c3aed, #a78bfa)",
                  transition:"width .6s ease",
                }} />
              </div>
            </div>
          </div>
        )}

        {/* 教材リスト */}
        <div style={{ padding:"0 14px 16px", maxWidth:"600px", margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
            <span style={{ fontSize:"15px", fontWeight:"700", color:"rgba(255,255,255,0.75)" }}>📚 教材一覧</span>
            <Btn onClick={openAdd} accent>＋ 追加</Btn>
          </div>
          {books.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px", color:"rgba(255,255,255,0.25)", border:"2px dashed rgba(255,255,255,0.08)", borderRadius:"16px" }}>
              <div style={{ fontSize:"36px", marginBottom:"10px" }}>📭</div>
              <div>「＋ 追加」から教材を登録してください</div>
            </div>
          ) : books.map((b,i) => (
            <BookCard key={b.id} book={b} index={i} total={books.length}
              onEdit={() => openEdit(b)}
              onDelete={() => setConfirmDel(b.id)}
              onUp={() => moveBook(i,-1)}
              onDown={() => moveBook(i,1)}
              onPage={d => changePage(b,d)}
            />
          ))}
        </div>

        {/* 教材モーダル */}
        {(modal==="add"||modal==="edit") && (
          <Sheet title={modal==="add" ? "📗 教材を追加" : "✏️ 教材を編集"} onClose={() => setModal(null)}>
            <FInput label="教材名" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="例: 財務会計論テキスト" />
            <FInput label="総ページ数" value={form.total} onChange={v=>setForm(p=>({...p,total:v}))} type="number" placeholder="例: 500" />
            <FInput label="現在のページ" value={form.cur} onChange={v=>setForm(p=>({...p,cur:v}))} type="number" placeholder="例: 120" />
            <div style={{ marginBottom:"18px" }}>
              <label style={LS}>表紙画像（任意）</label>
              <input type="file" accept="image/*" onChange={handleImg} style={{ color:"rgba(255,255,255,0.6)", fontSize:"14px", display:"block" }} />
              {form.img && <img src={form.img} alt="" style={{ width:"54px",height:"72px",objectFit:"cover",borderRadius:"6px",marginTop:"8px" }} />}
            </div>
            <Btn onClick={saveBook} accent full>{modal==="add" ? "追加する" : "保存する"}</Btn>
          </Sheet>
        )}

        {/* 設定モーダル */}
        {modal==="settings" && (
          <Sheet title="⚙️ 設定" onClose={() => setModal(null)}>
            <FInput label="週間目標ページ数" value={goalForm} onChange={setGoalForm} type="number" placeholder="例: 100" />
            <Btn onClick={saveGoal} accent full>保存する</Btn>
            <div style={{ marginTop:"16px", padding:"12px", background:"rgba(255,255,255,0.04)", borderRadius:"10px", fontSize:"12px", color:"rgba(255,255,255,0.3)", lineHeight:1.9 }}>
              <div>🔑 UID: {uid.slice(0,12)}...</div>
              <div>📡 固定ID: {FIXED_ID}</div>
              <div>📱 同期: {sync==="ok"?"✅ 正常":sync==="saving"?"⏳ 保存中":"❌ エラー"}</div>
            </div>
          </Sheet>
        )}

        {confirmDel && (
          <ConfirmDlg msg="この教材を削除しますか？" okLabel="削除する" okColor="#e53e3e" onOk={doDelete} onCancel={() => setConfirmDel(null)} />
        )}
        {confirmOut && (
          <ConfirmDlg msg="ログアウトしますか？" okLabel="ログアウト" okColor="#4299e1" onOk={() => { setConfirmOut(false); onLogout(); }} onCancel={() => setConfirmOut(false)} />
        )}
      </div>
    </>
  );
}

// ============================================================
// 教材カード
// ============================================================
function BookCard({ book, index, total, onEdit, onDelete, onUp, onDown, onPage }) {
  const pct = book.totalPages > 0 ? Math.min(100, Math.round((book.currentPage||0)/book.totalPages*100)) : 0;
  const bar = pct>=100?"#68d391":pct>=50?"#63b3ed":"#f6ad55";
  return (
    <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"16px", padding:"14px", marginBottom:"10px" }}>
      <div style={{ display:"flex", gap:"12px" }}>
        <div style={{ width:"44px", height:"60px", borderRadius:"6px", flexShrink:0, background:"#2d3748", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", overflow:"hidden" }}>
          {book.imageBase64 ? <img src={book.imageBase64} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : "📗"}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:"700", fontSize:"15px", marginBottom:"3px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{book.name}</div>
          <div style={{ fontSize:"12px", color:"rgba(255,255,255,0.45)", marginBottom:"7px" }}>{book.currentPage||0} / {book.totalPages||"?"} p — {pct}%</div>
          <div style={{ height:"5px", background:"rgba(255,255,255,0.08)", borderRadius:"3px", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:bar, borderRadius:"3px", transition:"width .4s" }} />
          </div>
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"12px", gap:"6px" }}>
        <div style={{ display:"flex", gap:"5px" }}>
          {[1,5,10].map(n => <Btn key={n} onClick={() => onPage(n)} color="#68d391">+{n}</Btn>)}
          <Btn onClick={() => onPage(-1)} color="#fc8181">-1</Btn>
        </div>
        <div style={{ display:"flex", gap:"4px" }}>
          <Btn onClick={onUp}     disabled={index===0}       color="#a0aec0">▲</Btn>
          <Btn onClick={onDown}   disabled={index===total-1} color="#a0aec0">▼</Btn>
          <Btn onClick={onEdit}   color="#63b3ed">✏️</Btn>
          <Btn onClick={onDelete} color="#fc8181">🗑</Btn>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// サマリーカード
// ============================================================
function SCard({ icon, label, value, unit, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${color}28`, borderRadius:"14px", padding:"13px 12px", cursor:onClick?"pointer":"default" }}>
      <div style={{ fontSize:"18px", marginBottom:"4px" }}>{icon}</div>
      <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.45)", marginBottom:"3px" }}>{label}</div>
      <div style={{ fontSize:"26px", fontWeight:"800", color, lineHeight:1 }}>
        {value}<span style={{ fontSize:"12px", fontWeight:"400", marginLeft:"3px" }}>{unit}</span>
      </div>
    </div>
  );
}

// ============================================================
// ボトムシート
// ★★★ Safari対策の核心: backdropFilterを絶対に使わない ★★★
// ============================================================
function Sheet({ title, children, onClose }) {
  return (
    <div
      onClick={e => e.target===e.currentTarget && onClose()}
      style={{
        position:"fixed", inset:0, zIndex:300,
        background:"rgba(0,0,0,0.75)",
        // ★ backdropFilter: 絶対に書かない（Safariでinputのキーボードがでなくなるバグの原因）
        display:"flex", alignItems:"flex-end", justifyContent:"center",
      }}
    >
      <div style={{
        // ★ background は単色のみ。filterもbackdropFilterも一切なし
        background:"#1e2a3a",
        border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:"20px 20px 0 0",
        padding:"22px 18px 50px",
        width:"100%", maxWidth:"500px",
        maxHeight:"88vh", overflowY:"auto",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <span style={{ fontSize:"16px", fontWeight:"700" }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:"22px", cursor:"pointer", padding:"4px", lineHeight:1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// フォーム入力
// ★ Safari対策: inputの親に余計なスタイル一切なし
// ============================================================
function FInput({ label, value, onChange, type="text", placeholder }) {
  return (
    <div style={{ marginBottom:"16px" }}>
      <label style={LS}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={type==="number" ? "numeric" : undefined}
        autoComplete="off"
        style={{
          display:"block", width:"100%",
          padding:"13px 14px",
          fontSize:"16px", lineHeight:"1.4",
          color:"#fff",
          background:"rgba(255,255,255,0.08)",
          border:"1px solid rgba(255,255,255,0.15)",
          borderRadius:"10px", outline:"none",
          WebkitAppearance:"none",
        }}
      />
    </div>
  );
}

// ============================================================
// ボタン
// ============================================================
function Btn({ children, onClick, color="#63b3ed", disabled=false, accent=false, sm=false, full=false }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        background: accent ? "#4299e1" : disabled ? "rgba(255,255,255,0.04)" : `${color}18`,
        border: `1px solid ${disabled?"rgba(255,255,255,0.05)":accent?"transparent":color+"45"}`,
        borderRadius:"8px",
        padding: sm ? "6px 9px" : "7px 11px",
        color: disabled ? "rgba(255,255,255,0.2)" : accent ? "#fff" : color,
        fontSize:"13px", fontWeight:"700",
        cursor: disabled ? "not-allowed" : "pointer",
        minWidth: full ? "auto" : "34px",
        width: full ? "100%" : undefined,
        display: full ? "block" : undefined,
      }}
      onPointerDown={e => { if(!disabled) e.currentTarget.style.opacity="0.7"; }}
      onPointerUp={e => { e.currentTarget.style.opacity="1"; }}
      onPointerLeave={e => { e.currentTarget.style.opacity="1"; }}
    >
      {children}
    </button>
  );
}

const LS = {
  display:"block",
  color:"rgba(255,255,255,0.65)",
  fontSize:"14px",
  fontWeight:"600",
  marginBottom:"7px",
};
