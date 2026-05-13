// ============================================================
// CPA Study Tracker - App.jsx
// Firebase Firestore リアルタイム同期版
// FIXED_ID: CPA_ROOT_V7000 (ハードコード固定)
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

// ============================================================
// Firebase 設定（ハードコード固定 - 絶対に変更しないこと）
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBgPwP-30BuXvuydRe6NsYJInMVMlmaWsE",
  authDomain: "cpa-tracker-a0f14.firebaseapp.com",
  databaseURL: "https://cpa-tracker-a0f14-default-rtdb.firebaseio.com",
  projectId: "cpa-tracker-a0f14",
  storageBucket: "cpa-tracker-a0f14.firebasestorage.app",
  messagingSenderId: "77528125896",
  appId: "1:77528125896:web:13829c71b21a7870d870fd",
  measurementId: "G-FNL3C7R07M",
};

// ============================================================
// 定数（絶対に変更しないこと - 同期の鍵）
// ============================================================
const FIXED_ID = "CPA_ROOT_V7000";
const BASE_WEEKLY_TARGET = 100;

// Firebase 初期化（重複初期化防止）
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// ============================================================
// Firestoreパスヘルパー（UIDを受け取って毎回生成）
// ============================================================
const getPaths = (uid) => ({
  settings: doc(db, `artifacts/${FIXED_ID}/users/${uid}/settings/weeklyGoal`),
  textbook: (id) => doc(db, `artifacts/${FIXED_ID}/users/${uid}/textbooks/${id}`),
  textbooksCol: collection(db, `artifacts/${FIXED_ID}/users/${uid}/textbooks`),
  dailyLog: (date) => doc(db, `artifacts/${FIXED_ID}/users/${uid}/dailyLogs/${date}`),
});

// ============================================================
// 励ましメッセージ
// ============================================================
const MESSAGES = [
  "今日も一歩前進！合格まであと少し！",
  "継続は力なり。君なら絶対できる！",
  "難しい問題も、積み重ねで必ず解けるようになる！",
  "一日一日を大切に。合格は目の前だ！",
  "諦めなければ必ず道は開ける！",
  "今の努力が未来の自分を救う！",
  "休憩も大事。でも戻ってきた君は強い！",
  "合格くんはいつも君の味方だぞ！",
  "小さな積み重ねが大きな結果につながる！",
  "今日の頑張りを明日の自分が感謝する！",
  "財務諸表も最初は誰でも苦手。大丈夫！",
  "監査論、管理会計…全部マスターしよう！",
];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// 日付ユーティリティ
// ============================================================
const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getThisMondayStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// 画像リサイズ（Base64）
// ============================================================
function resizeImage(file, maxW = 200, maxH = 200, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxW) { h = (h * maxW) / w; w = maxW; }
        if (h > maxH) { w = (w * maxH) / h; h = maxH; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// ログイン画面（プレーンHTML構造 - iOSズーム・入力問題対策済み）
// ============================================================
function LoginScreen({ onLogin, onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        await onSignup(email, password);
      } else {
        await onLogin(email, password);
      }
    } catch (e) {
      const msgs = {
        "auth/user-not-found": "メールアドレスが見つかりません",
        "auth/wrong-password": "パスワードが間違っています",
        "auth/email-already-in-use": "このメールアドレスは既に使用されています",
        "auth/invalid-email": "メールアドレスの形式が正しくありません",
        "auth/weak-password": "パスワードは6文字以上で入力してください",
        "auth/invalid-credential": "メールアドレスまたはパスワードが間違っています",
      };
      setError(msgs[e.code] || "エラー: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
  };

  const cardStyle = {
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "20px",
    padding: "40px 28px",
    width: "100%",
    maxWidth: "380px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  };

  const inputStyle = {
    width: "100%",
    padding: "13px 14px",
    fontSize: "16px", // iOSズーム防止（16px以上必須）
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    outline: "none",
    boxSizing: "border-box",
    WebkitAppearance: "none",
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "52px", marginBottom: "10px" }}>📚</div>
          <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: "700", margin: "0 0 6px" }}>
            CPA Study Tracker
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", margin: 0 }}>
            合格への道を、一緒に歩もう
          </p>
        </div>

        {/* タブ */}
        <div style={{
          display: "flex",
          background: "rgba(0,0,0,0.3)",
          borderRadius: "10px",
          padding: "4px",
          marginBottom: "24px",
        }}>
          {["ログイン", "新規登録"].map((label, i) => (
            <button
              key={i}
              onClick={() => { setIsSignup(i === 1); setError(""); }}
              style={{
                flex: 1,
                padding: "10px",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                background: isSignup === (i === 1) ? "rgba(99,179,237,0.9)" : "transparent",
                color: isSignup === (i === 1) ? "#1a1a2e" : "rgba(255,255,255,0.55)",
                transition: "all 0.2s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", color: "rgba(255,255,255,0.65)", fontSize: "13px", marginBottom: "6px" }}>
            メールアドレス
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            autoComplete="email"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label style={{ display: "block", color: "rgba(255,255,255,0.65)", fontSize: "13px", marginBottom: "6px" }}>
            パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6文字以上"
            autoComplete={isSignup ? "new-password" : "current-password"}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: "8px",
            padding: "10px 14px",
            color: "#fca5a5",
            fontSize: "13px",
            marginBottom: "14px",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            fontSize: "16px",
            fontWeight: "700",
            border: "none",
            borderRadius: "10px",
            cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "rgba(99,179,237,0.35)" : "linear-gradient(135deg, #63b3ed, #4299e1)",
            color: "#fff",
            boxShadow: loading ? "none" : "0 4px 15px rgba(66,153,225,0.35)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {loading ? "処理中..." : isSignup ? "アカウント作成" : "ログイン"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ルートコンポーネント
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // スマホスリープ復帰時のFirebase再接続（オフラインエラー対策）
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        enableNetwork(db).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    const timer = setInterval(() => enableNetwork(db).catch(() => {}), 60000);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(timer);
    };
  }, []);

  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e, #0f3460)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: "18px",
        fontFamily: "sans-serif",
      }}>
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={(email, pw) => signInWithEmailAndPassword(auth, email, pw)}
        onSignup={(email, pw) => createUserWithEmailAndPassword(auth, email, pw)}
      />
    );
  }

  return <MainDashboard user={user} onLogout={() => signOut(auth)} />;
}

// ============================================================
// メインダッシュボード
// ============================================================
function MainDashboard({ user, onLogout }) {
  const uid = user.uid;

  const [textbooks, setTextbooks] = useState([]);
  const [weeklyGoal, setWeeklyGoal] = useState(BASE_WEEKLY_TARGET);
  const [lastResetMonday, setLastResetMonday] = useState(null);
  const [todayLog, setTodayLog] = useState({ pages: 0, startOfDayPages: 0 });
  const [now, setNow] = useState(new Date());
  const [mascotMsg, setMascotMsg] = useState("");
  const [showMascot, setShowMascot] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced");
  const [modal, setModal] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [bookForm, setBookForm] = useState({ name: "", totalPages: "", currentPage: "", imageBase64: "" });
  const [goalForm, setGoalForm] = useState("");

  const msgQueue = useRef(shuffleArray(MESSAGES));
  const msgIndex = useRef(0);
  const textbooksRef = useRef([]);
  textbooksRef.current = textbooks;

  // 時計
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 合格くん自動メッセージ
  const showNextMessage = useCallback(() => {
    if (msgIndex.current >= msgQueue.current.length) {
      msgQueue.current = shuffleArray(MESSAGES);
      msgIndex.current = 0;
    }
    setMascotMsg(msgQueue.current[msgIndex.current++]);
    setShowMascot(true);
    setTimeout(() => setShowMascot(false), 4500);
  }, []);

  useEffect(() => {
    const t = setInterval(showNextMessage, 30000);
    return () => clearInterval(t);
  }, [showNextMessage]);

  // --- Firestore リアルタイム同期: 設定 ---
  useEffect(() => {
    const p = getPaths(uid);
    const unsub = onSnapshot(
      p.settings,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setWeeklyGoal(d.target ?? BASE_WEEKLY_TARGET);
          setLastResetMonday(d.lastResetMonday ?? null);
        } else {
          // 初回: 設定を作成
          const monday = getThisMondayStr();
          setDoc(p.settings, {
            target: BASE_WEEKLY_TARGET,
            lastResetMonday: monday,
            weeklyPages: 0,
            updatedAt: serverTimestamp(),
          }).catch(console.error);
        }
      },
      (err) => console.error("settings:", err)
    );
    return unsub;
  }, [uid]);

  // --- Firestore リアルタイム同期: 教材 ---
  useEffect(() => {
    const p = getPaths(uid);
    const q = query(p.textbooksCol, orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTextbooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("textbooks:", err)
    );
    return unsub;
  }, [uid]);

  // --- Firestore リアルタイム同期: 今日のログ ---
  useEffect(() => {
    const p = getPaths(uid);
    const today = getTodayStr();
    const unsub = onSnapshot(
      p.dailyLog(today),
      (snap) => {
        if (snap.exists()) {
          setTodayLog(snap.data());
        }
        // 存在しない場合は textbooks ロード後に初期化する
      },
      (err) => console.error("dailyLog:", err)
    );
    return unsub;
  }, [uid]);

  // 日次ログ初期化（教材ロード後）
  useEffect(() => {
    if (textbooks.length === 0) return;
    const today = getTodayStr();
    const p = getPaths(uid);
    // すでにログがあれば何もしない
    if (todayLog.startOfDayPages !== undefined && todayLog.startOfDayPages > 0) return;

    // 初回の場合のみ現在ページ合計をスナップショット
    const startPages = textbooks.reduce((s, b) => s + (b.currentPage || 0), 0);
    if (startPages > 0 && todayLog.startOfDayPages === 0) {
      setDoc(p.dailyLog(today), {
        pages: 0,
        startOfDayPages: startPages,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(console.error);
    }
  }, [textbooks.length > 0]);

  // 月曜リセット
  useEffect(() => {
    if (lastResetMonday === null) return;
    const monday = getThisMondayStr();
    if (lastResetMonday !== monday) {
      const p = getPaths(uid);
      setDoc(p.settings, {
        target: weeklyGoal,
        lastResetMonday: monday,
        weeklyPages: 0,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(console.error);
    }
  }, [lastResetMonday]);

  // --- 計算値 ---
  const totalCurrentPages = textbooks.reduce((s, b) => s + (b.currentPage || 0), 0);
  const todayProgress = Math.max(0, totalCurrentPages - (todayLog.startOfDayPages || 0));
  const remainingNorma = Math.max(0, weeklyGoal - todayProgress);

  // --- 教材保存（UIを即座に閉じる非同期保存）---
  const saveBook = async () => {
    const name = bookForm.name.trim();
    if (!name) return;
    const totalPages = parseInt(bookForm.totalPages) || 0;
    const currentPage = Math.min(parseInt(bookForm.currentPage) || 0, totalPages || Infinity);
    const p = getPaths(uid);

    // 先にモーダルを閉じる
    setModal(null);
    setEditTarget(null);
    setSyncStatus("saving");

    try {
      if (editTarget) {
        await setDoc(p.textbook(editTarget.id), {
          name, totalPages, currentPage,
          imageBase64: bookForm.imageBase64 || editTarget.imageBase64 || "",
          order: editTarget.order ?? Date.now(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        const newId = `book_${Date.now()}`;
        const maxOrder = textbooks.length > 0
          ? Math.max(...textbooks.map((b) => b.order ?? 0))
          : 0;
        await setDoc(p.textbook(newId), {
          name, totalPages, currentPage,
          imageBase64: bookForm.imageBase64 || "",
          order: maxOrder + 1,
          updatedAt: serverTimestamp(),
        });
      }
      setSyncStatus("synced");
    } catch (e) {
      console.error(e);
      setSyncStatus("error");
    }
  };

  // --- 教材削除 ---
  const deleteBook = async (id) => {
    if (!window.confirm("この教材を削除しますか？")) return;
    const p = getPaths(uid);
    setSyncStatus("saving");
    try {
      await deleteDoc(p.textbook(id));
      setSyncStatus("synced");
    } catch (e) {
      console.error(e);
      setSyncStatus("error");
    }
  };

  // --- 並べ替え ---
  const moveBook = async (index, dir) => {
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= textbooks.length) return;
    const p = getPaths(uid);
    setSyncStatus("saving");
    try {
      await Promise.all([
        setDoc(p.textbook(textbooks[index].id), { order: swapIdx }, { merge: true }),
        setDoc(p.textbook(textbooks[swapIdx].id), { order: index }, { merge: true }),
      ]);
      setSyncStatus("synced");
    } catch (e) {
      setSyncStatus("error");
    }
  };

  // --- ページ増減 ---
  const changePage = async (book, delta) => {
    const newPage = Math.max(0, Math.min((book.currentPage || 0) + delta, book.totalPages || 99999));
    const today = getTodayStr();
    const p = getPaths(uid);
    setSyncStatus("saving");
    try {
      await setDoc(p.textbook(book.id), { currentPage: newPage, updatedAt: serverTimestamp() }, { merge: true });
      // 今日のログも更新
      const newTotal = textbooks.reduce((s, b) => b.id === book.id ? s + newPage : s + (b.currentPage || 0), 0);
      const todayPages = Math.max(0, newTotal - (todayLog.startOfDayPages || 0));
      await setDoc(p.dailyLog(today), {
        pages: todayPages,
        startOfDayPages: todayLog.startOfDayPages || 0,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSyncStatus("synced");
    } catch (e) {
      console.error(e);
      setSyncStatus("error");
    }
  };

  // --- 週間目標保存 ---
  const saveGoal = async () => {
    const val = parseInt(goalForm);
    if (!val || val < 1) return;
    const p = getPaths(uid);
    setModal(null);
    setSyncStatus("saving");
    try {
      await setDoc(p.settings, { target: val, lastResetMonday: getThisMondayStr(), updatedAt: serverTimestamp() }, { merge: true });
      setSyncStatus("synced");
    } catch (e) {
      setSyncStatus("error");
    }
  };

  // --- モーダルを開く ---
  const openAddBook = () => {
    setBookForm({ name: "", totalPages: "", currentPage: "", imageBase64: "" });
    setEditTarget(null);
    setModal("addBook");
  };
  const openEditBook = (book) => {
    setBookForm({ name: book.name, totalPages: String(book.totalPages || ""), currentPage: String(book.currentPage || ""), imageBase64: book.imageBase64 || "" });
    setEditTarget(book);
    setModal("editBook");
  };
  const openSettings = () => { setGoalForm(String(weeklyGoal)); setModal("settings"); };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await resizeImage(file);
    setBookForm((prev) => ({ ...prev, imageBase64: b64 }));
  };

  // 時刻
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}(${DAY_NAMES[now.getDay()]})`;
  const syncColor = syncStatus === "synced" ? "#48bb78" : syncStatus === "saving" ? "#f6ad55" : "#fc8181";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0d1117 0%, #161b27 60%, #1a1f35 100%)",
      fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', sans-serif",
      color: "#e2e8f0",
      paddingBottom: "60px",
    }}>
      {/* ---- トップバー ---- */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(13,17,23,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <button
          onClick={showNextMessage}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "28px", lineHeight: 1, padding: "4px", WebkitTapHighlightColor: "transparent" }}
          onPointerDown={(e) => (e.currentTarget.style.transform = "scale(0.88)")}
          onPointerUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onPointerLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          📚
        </button>

        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "0.04em", color: "#63b3ed", lineHeight: 1.1 }}>{timeStr}</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{dateStr}</div>
        </div>

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: syncColor, boxShadow: `0 0 6px ${syncColor}` }} title={syncStatus} />
          <TapBtn onClick={openSettings} small>⚙️</TapBtn>
          <TapBtn onClick={onLogout} small>🚪</TapBtn>
        </div>
      </div>

      {/* ---- 合格くんバブル ---- */}
      {showMascot && (
        <div style={{
          position: "fixed", top: "68px", left: "50%", transform: "translateX(-50%)",
          zIndex: 200, background: "linear-gradient(135deg,#2d3748,#4a5568)",
          border: "1px solid rgba(99,179,237,0.4)", borderRadius: "16px",
          padding: "12px 20px", maxWidth: "88vw", textAlign: "center",
          fontSize: "14px", color: "#bee3f8", boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          animation: "fadeInDown 0.3s ease",
        }}>
          {mascotMsg}
        </div>
      )}

      {/* ---- サマリーカード ---- */}
      <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxWidth: "600px", margin: "0 auto" }}>
        <SummaryCard icon="📅" label="残ノルマ" value={remainingNorma} unit="p" color="#fc8181" />
        <SummaryCard icon="✏️" label="今日の進捗" value={todayProgress} unit="p" color="#68d391" />
        <SummaryCard icon="🎯" label="週間目標" value={weeklyGoal} unit="p" color="#63b3ed" onClick={openSettings} />
        <SummaryCard icon="📖" label="教材数" value={textbooks.length} unit="冊" color="#f6ad55" />
      </div>

      {/* ---- 教材リスト ---- */}
      <div style={{ padding: "0 16px 16px", maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "rgba(255,255,255,0.75)" }}>
            📚 教材一覧
          </h2>
          <TapBtn onClick={openAddBook} accent>＋ 追加</TapBtn>
        </div>

        {textbooks.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            color: "rgba(255,255,255,0.25)",
            border: "2px dashed rgba(255,255,255,0.08)", borderRadius: "16px",
          }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>📭</div>
            <div>「＋ 追加」から教材を登録してください</div>
          </div>
        ) : (
          textbooks.map((book, i) => (
            <BookCard
              key={book.id}
              book={book}
              index={i}
              total={textbooks.length}
              onEdit={() => openEditBook(book)}
              onDelete={() => deleteBook(book.id)}
              onMoveUp={() => moveBook(i, -1)}
              onMoveDown={() => moveBook(i, 1)}
              onChangePage={(delta) => changePage(book, delta)}
            />
          ))
        )}
      </div>

      {/* ---- モーダル ---- */}
      {(modal === "addBook" || modal === "editBook") && (
        <BottomModal title={modal === "addBook" ? "📗 教材を追加" : "✏️ 教材を編集"} onClose={() => setModal(null)}>
          <FormInput label="教材名" value={bookForm.name} onChange={(v) => setBookForm((p) => ({ ...p, name: v }))} placeholder="例: 財務会計論テキスト" />
          <FormInput label="総ページ数" value={bookForm.totalPages} onChange={(v) => setBookForm((p) => ({ ...p, totalPages: v }))} type="number" placeholder="例: 500" />
          <FormInput label="現在のページ" value={bookForm.currentPage} onChange={(v) => setBookForm((p) => ({ ...p, currentPage: v }))} type="number" placeholder="例: 120" />
          <div style={{ marginBottom: "18px" }}>
            <label style={labelStyle}>表紙画像（任意）</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", display: "block" }} />
            {bookForm.imageBase64 && (
              <img src={bookForm.imageBase64} alt="preview" style={{ width: "56px", height: "74px", objectFit: "cover", borderRadius: "6px", marginTop: "8px" }} />
            )}
          </div>
          <TapBtn onClick={saveBook} accent full>{modal === "addBook" ? "追加する" : "保存する"}</TapBtn>
        </BottomModal>
      )}

      {modal === "settings" && (
        <BottomModal title="⚙️ 設定" onClose={() => setModal(null)}>
          <FormInput label="週間目標ページ数" value={goalForm} onChange={setGoalForm} type="number" placeholder="例: 100" />
          <TapBtn onClick={saveGoal} accent full>保存する</TapBtn>
          <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", fontSize: "12px", color: "rgba(255,255,255,0.35)", lineHeight: 1.8 }}>
            <div>🔑 UID: {uid.slice(0, 12)}...</div>
            <div>📡 固定ID: {FIXED_ID}</div>
            <div>📱 同期: {syncStatus === "synced" ? "✅ 正常" : syncStatus === "saving" ? "⏳ 保存中" : "❌ エラー"}</div>
          </div>
        </BottomModal>
      )}

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// 教材カード
// ============================================================
function BookCard({ book, index, total, onEdit, onDelete, onMoveUp, onMoveDown, onChangePage }) {
  const progress = book.totalPages > 0 ? Math.min(100, Math.round(((book.currentPage || 0) / book.totalPages) * 100)) : 0;
  const barColor = progress >= 100 ? "#68d391" : progress >= 50 ? "#63b3ed" : "#f6ad55";

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "16px",
      padding: "14px",
      marginBottom: "10px",
    }}>
      <div style={{ display: "flex", gap: "12px" }}>
        {/* 表紙 */}
        <div style={{
          width: "46px", height: "62px", borderRadius: "6px", flexShrink: 0,
          background: book.imageBase64 ? "transparent" : "linear-gradient(135deg,#2d3748,#4a5568)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", overflow: "hidden",
        }}>
          {book.imageBase64 ? <img src={book.imageBase64} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "📗"}
        </div>

        {/* 情報 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: "700", fontSize: "15px", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {book.name}
          </div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginBottom: "8px" }}>
            {book.currentPage || 0} / {book.totalPages || "?"} p — {progress}%
          </div>
          <div style={{ height: "5px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: barColor, borderRadius: "3px", transition: "width 0.4s ease" }} />
          </div>
        </div>
      </div>

      {/* 操作ボタン */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", gap: "6px" }}>
        <div style={{ display: "flex", gap: "5px" }}>
          {[1, 5, 10].map((n) => (
            <TapBtn key={n} onClick={() => onChangePage(n)} color="#68d391">+{n}</TapBtn>
          ))}
          <TapBtn onClick={() => onChangePage(-1)} color="#fc8181">-1</TapBtn>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <TapBtn onClick={onMoveUp} disabled={index === 0} color="#a0aec0">▲</TapBtn>
          <TapBtn onClick={onMoveDown} disabled={index === total - 1} color="#a0aec0">▼</TapBtn>
          <TapBtn onClick={onEdit} color="#63b3ed">✏️</TapBtn>
          <TapBtn onClick={onDelete} color="#fc8181">🗑</TapBtn>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// サマリーカード
// ============================================================
function SummaryCard({ icon, label, value, unit, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${color}28`,
      borderRadius: "14px",
      padding: "14px 12px",
      cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ fontSize: "20px", marginBottom: "4px" }}>{icon}</div>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: "800", color, lineHeight: 1 }}>
        {value}<span style={{ fontSize: "12px", fontWeight: "400", marginLeft: "3px" }}>{unit}</span>
      </div>
    </div>
  );
}

// ============================================================
// ボトムシートモーダル
// ============================================================
function BottomModal({ title, children, onClose }) {
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(5px)",
      }}
    >
      <div style={{
        background: "linear-gradient(160deg,#1a202c,#2d3748)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "20px 20px 0 0",
        padding: "24px 20px 48px",
        width: "100%", maxWidth: "500px",
        maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: "22px", cursor: "pointer", padding: "4px", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// フォーム入力
// ============================================================
function FormInput({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={type === "number" ? "numeric" : undefined}
        style={{
          width: "100%",
          padding: "12px 14px",
          fontSize: "16px", // iOSズーム防止
          border: "1px solid rgba(255,255,255,0.13)",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.07)",
          color: "#fff",
          outline: "none",
          boxSizing: "border-box",
          WebkitAppearance: "none",
        }}
      />
    </div>
  );
}

// ============================================================
// 汎用タップボタン
// ============================================================
function TapBtn({ children, onClick, color = "#63b3ed", disabled = false, accent = false, small = false, full = false }) {
  const bg = accent
    ? "linear-gradient(135deg,#63b3ed,#4299e1)"
    : disabled ? "rgba(255,255,255,0.04)" : `${color}18`;
  const borderColor = disabled ? "rgba(255,255,255,0.05)" : accent ? "transparent" : `${color}45`;
  const textColor = disabled ? "rgba(255,255,255,0.2)" : accent ? "#fff" : color;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: "8px",
        padding: small ? "6px 10px" : "7px 11px",
        color: textColor,
        fontSize: small ? "14px" : "13px",
        fontWeight: "700",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 0.1s",
        WebkitTapHighlightColor: "transparent",
        minWidth: full ? "auto" : "36px",
        width: full ? "100%" : undefined,
        boxShadow: accent ? "0 3px 12px rgba(66,153,225,0.3)" : "none",
      }}
      onPointerDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.92)"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {children}
    </button>
  );
}

// ============================================================
// スタイル定数
// ============================================================
const labelStyle = {
  display: "block",
  color: "rgba(255,255,255,0.6)",
  fontSize: "13px",
  fontWeight: "600",
  marginBottom: "6px",
};
