// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBSjJPXQZPi88oBvI2S5r3t_hSNLUZGJ60",
  authDomain: "scratch-game-3d100.firebaseapp.com",
  projectId: "scratch-game-3d100",
  storageBucket: "scratch-game-3d100.firebasestorage.app",
  messagingSenderId: "956097266408",
  appId: "1:956097266408:web:a0d91d311399a896887f5d",
  measurementId: "G-6EG7BVVGYZ"
};

// Initialize Firebase
const analytics = getAnalytics(app);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const grid = document.getElementById("grid");
const startBtn = document.getElementById("startBtn");
const userNumberEl = document.getElementById("userNumber");
const statusEl = document.getElementById("status");

const CARD = 74;
const RADIUS = 11;
const SCRATCH_RADIUS = 11;

let numbers = [];
let opened = new Set();

function todayTaipei() {
  // Daily lock should follow user's timezone; using Asia/Taipei explicitly.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function hasPlayedToday() {
  return localStorage.getItem("playedDate") === todayTaipei();
}

function markPlayedToday() {
  localStorage.setItem("playedDate", todayTaipei());
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function buildGrid() {
  grid.innerHTML = "";
  opened = new Set();

  numbers = Array.from({ length: 10 }, (_, i) => i + 1);
  shuffle(numbers);

  numbers.forEach((n, idx) => {
    const card = document.createElement("div");
    card.className = "card";

    const num = document.createElement("div");
    num.className = "number";
    num.textContent = String(n);

    const canvas = document.createElement("canvas");
    canvas.width = CARD;
    canvas.height = CARD;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Overlay
    ctx.fillStyle = "#9a9a9a";
    ctx.fillRect(0, 0, CARD, CARD);

    // (Optional) add a subtle pattern text
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.font = "bold 12px Arial";
    ctx.fillText("刮開", 22, 42);

    // Scratch mode
    ctx.globalCompositeOperation = "destination-out";

    let scratching = false;

    const getXY = (e) => {
      const rect = canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return {
        x: p.clientX - rect.left,
        y: p.clientY - rect.top,
      };
    };

    const scratchAt = (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, SCRATCH_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    };

    const revealIfEnough = () => {
      // Simple heuristic: check scratched area ratio.
      const img = ctx.getImageData(0, 0, CARD, CARD).data;
      let cleared = 0;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] === 0) cleared++;
      }
      const ratio = cleared / (CARD * CARD);
      if (ratio >= 0.55 && !opened.has(idx)) {
        opened.add(idx);
        // fully clear
        ctx.clearRect(0, 0, CARD, CARD);
        if (opened.size === 10) finishGame();
      }
    };

    const onDown = (e) => {
      scratching = true;
      const { x, y } = getXY(e);
      scratchAt(x, y);
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!scratching) return;
      const { x, y } = getXY(e);
      scratchAt(x, y);
      e.preventDefault();
    };

    const onUp = (e) => {
      scratching = false;
      revealIfEnough();
      e.preventDefault();
    };

    // Mouse
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    // Touch
    canvas.addEventListener("touchstart", onDown, { passive: false });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    canvas.addEventListener("touchend", onUp, { passive: false });

    card.appendChild(num);
    card.appendChild(canvas);
    grid.appendChild(card);
  });
}

async function finishGame() {
  const picked = Number.parseInt(userNumberEl.value, 10);
  const win = numbers.includes(picked);

  statusEl.textContent = win ? "🎉 恭喜中獎！" : "😢 沒中獎";
  startBtn.disabled = true;
  userNumberEl.disabled = true;

  // Record to Firestore
  try {
    await addDoc(collection(db, "records"), {
      pickedNumber: picked,
      win,
      createdAt: serverTimestamp(),
      clientDate: todayTaipei(),
    });
  } catch (err) {
    console.error(err);
    statusEl.textContent += "（⚠️ 記錄寫入失敗，請檢查 Firebase 設定/規則）";
  }

  markPlayedToday();
}

function lockUIIfPlayed() {
  if (!hasPlayedToday()) return;

  statusEl.textContent = `你今天（${todayTaipei()}）已經玩過了。`;
  startBtn.disabled = true;
  userNumberEl.disabled = true;
}

startBtn.addEventListener("click", () => {
  if (hasPlayedToday()) {
    lockUIIfPlayed();
    return;
  }

  const n = Number.parseInt(userNumberEl.value, 10);
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    alert("請輸入 1~10 的整數");
    return;
  }

  statusEl.textContent = "開始刮吧！刮開全部 10 格會自動結算。";
  buildGrid();
});

lockUIIfPlayed();
