/* scripts.js — Bible Sorting Game wired to Flask routes
   Back-end expectations:
     GET  /api/highscores?limit=25  -> returns array of { name, score, timestamp, location }
     POST /api/submit-score         -> body { name, score }, returns { status:'ok', rank, percentile }
*/

/* =========================
   0) Config & Helpers
   ========================= */

const API = {
  highscores: "/api/highscores",
  submitScore: "/api/submit-score",
};

async function getJSON(url) {
  const r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) throw new Error(`GET ${url} failed: ${r.status}`);
  return r.json();
}

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`POST ${url} failed: ${r.status} ${msg}`);
  }
  return r.json().catch(() => ({}));
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fmtDateTime(dtStr) {
  try {
    const d = new Date(dtStr);
    if (!isNaN(d)) return d.toLocaleString();
  } catch {}
  return dtStr ?? "";
}

function ordinal(n) {
  if (n == null || isNaN(n)) return "";
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* =========================
   1) Game Data
   ========================= */

const candidateCards = [
  { description: "Genesis", value: 1, display: "1st book" },
  { description: "Exodus", value: 2, display: "2nd book" },
  { description: "Leviticus", value: 3, display: "3rd book" },
  { description: "Numbers", value: 4, display: "4th book" },
  { description: "Deuteronomy", value: 5, display: "5th book" },
  { description: "Joshua", value: 6, display: "6th book" },
  { description: "Judges", value: 7, display: "7th book" },
  { description: "Ruth", value: 8, display: "8th book" },
  { description: "1 Samuel", value: 9, display: "9th book" },
  { description: "2 Samuel", value: 10, display: "10th book" },
  { description: "1 Kings", value: 11, display: "11th book" },
  { description: "2 Kings", value: 12, display: "12th book" },
  { description: "1 Chronicles", value: 13, display: "13th book" },
  { description: "2 Chronicles", value: 14, display: "14th book" },
  { description: "Ezra", value: 15, display: "15th book" },
  { description: "Nehemiah", value: 16, display: "16th book" },
  { description: "Esther", value: 17, display: "17th book" },
  { description: "Job", value: 18, display: "18th book" },
  { description: "Psalms", value: 19, display: "19th book" },
  { description: "Proverbs", value: 20, display: "20th book" },
  { description: "Ecclesiastes", value: 21, display: "21st book" },
  { description: "Song of Solomon", value: 22, display: "22nd book" },
  { description: "Isaiah", value: 23, display: "23rd book" },
  { description: "Jeremiah", value: 24, display: "24th book" },
  { description: "Lamentations", value: 25, display: "25th book" },
  { description: "Ezekiel", value: 26, display: "26th book" },
  { description: "Daniel", value: 27, display: "27th book" },
  { description: "Hosea", value: 28, display: "28th book" },
  { description: "Joel", value: 29, display: "29th book" },
  { description: "Amos", value: 30, display: "30th book" },
  { description: "Obadiah", value: 31, display: "31st book" },
  { description: "Jonah", value: 32, display: "32nd book" },
  { description: "Micah", value: 33, display: "33rd book" },
  { description: "Nahum", value: 34, display: "34th book" },
  { description: "Habakkuk", value: 35, display: "35th book" },
  { description: "Zephaniah", value: 36, display: "36th book" },
  { description: "Haggai", value: 37, display: "37th book" },
  { description: "Zechariah", value: 38, display: "38th book" },
  { description: "Malachi", value: 39, display: "39th book" },
  { description: "Matthew", value: 40, display: "40th book" },
  { description: "Mark", value: 41, display: "41st book" },
  { description: "Luke", value: 42, display: "42nd book" },
  { description: "John", value: 43, display: "43rd book" },
  { description: "Acts", value: 44, display: "44th book" },
  { description: "Romans", value: 45, display: "45th book" },
  { description: "1 Corinthians", value: 46, display: "46th book" },
  { description: "2 Corinthians", value: 47, display: "47th book" },
  { description: "Galatians", value: 48, display: "48th book" },
  { description: "Ephesians", value: 49, display: "49th book" },
  { description: "Philippians", value: 50, display: "50th book" },
  { description: "Colossians", value: 51, display: "51st book" },
  { description: "1 Thessalonians", value: 52, display: "52nd book" },
  { description: "2 Thessalonians", value: 53, display: "53rd book" },
  { description: "1 Timothy", value: 54, display: "54th book" },
  { description: "2 Timothy", value: 55, display: "55th book" },
  { description: "Titus", value: 56, display: "56th book" },
  { description: "Philemon", value: 57, display: "57th book" },
  { description: "Hebrews", value: 58, display: "58th book" },
  { description: "James", value: 59, display: "59th book" },
  { description: "1 Peter", value: 60, display: "60th book" },
  { description: "2 Peter", value: 61, display: "61st book" },
  { description: "1 John", value: 62, display: "62nd book" },
  { description: "2 John", value: 63, display: "63rd book" },
  { description: "3 John", value: 64, display: "64th book" },
  { description: "Jude", value: 65, display: "65th book" },
  { description: "Revelation", value: 66, display: "66th book" },
];

/* =========================
   2) DOM Elements
   ========================= */

const els = {
  source: document.getElementById("source-container"),
  target: document.getElementById("card-container"),
  score: document.getElementById("score"),
  message: document.getElementById("message"),
  timer: document.getElementById("timer"),
  btnCheck: document.getElementById("check-order-btn"),
  btnRestart: document.getElementById("restart-btn"),
  highScoresBody: document.querySelector("#high-scores-table tbody"),
  year: document.getElementById("current-year"),
  // Modal & stats
  modal: document.getElementById("name-modal"),
  modalScoreText: document.getElementById("final-score-text"),
  modalInput: document.getElementById("player-name-input"),
  modalSubmit: document.getElementById("submit-score-btn"),
  modalCancel: document.getElementById("cancel-score-btn"),
  modalError: document.getElementById("submit-score-error"),
  scoreStats: document.getElementById("score-stats"),
};

/* =========================
   3) Game State
   ========================= */

let gameState = {
  running: false,
  score: 0,
  timerSeconds: 60,
  timerId: null,
  deck: [],
};

function setScore(n) {
  gameState.score = n;
  els.score.textContent = `Score: ${n}`;
}

function setMessage(html, cls = "") {
  els.message.className = "";
  if (cls) els.message.classList.add(cls);
  els.message.innerHTML = html;
}

function setStatsMessage(html) {
  els.scoreStats.innerHTML = html || "";
}

/* =========================
   4) Card Rendering & DnD
   ========================= */

function createCardNode(card) {
  const el = document.createElement("div");
  el.className = "card";
  el.draggable = true;
  el.dataset.value = String(card.value);

  const title = document.createElement("div");
  title.textContent = card.description;

  const val = document.createElement("div");
  val.className = "card-value";
  val.textContent = card.display;

  el.appendChild(title);
  el.appendChild(val);

  el.addEventListener("dragstart", (e) => {
    el.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", el.dataset.value);
  });

  el.addEventListener("dragend", () => {
    el.classList.remove("dragging");
  });

  return el;
}

function clearContainer(container) {
  while (container.firstChild) container.removeChild(container.firstChild);
}

function renderDeck() {
  clearContainer(els.source);
  gameState.deck.forEach((c) => els.source.appendChild(createCardNode(c)));
}

function setupDropZones() {
  [els.source, els.target].forEach((zone) => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      if (!dragging) return;

      const afterEl = getDragAfterElement(zone, e.clientX);
      if (!afterEl) zone.appendChild(dragging);
      else zone.insertBefore(dragging, afterEl);
    });

    zone.addEventListener("drop", (e) => e.preventDefault());
  });
}

// Determine insertion position (horizontal lane)
function getDragAfterElement(container, x) {
  const others = [...container.querySelectorAll(".card:not(.dragging)")];
  return others.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

/* =========================
   5) Game Flow
   ========================= */

function startGame() {
  setScore(0);
  setMessage("");
  setStatsMessage("");
  gameState.running = true;

  // New shuffled deck
  gameState.deck = shuffleInPlace([...candidateCards]);
  renderDeck();

  // Clear target lane
  clearContainer(els.target);

  // Timer
  gameState.timerSeconds = 60;
  updateTimerLabel();
  if (gameState.timerId) clearInterval(gameState.timerId);
  gameState.timerId = setInterval(tick, 1000);

  els.btnRestart.style.display = "none";
  els.btnCheck.classList.add("pulse");

  // Load Top 25 from DB at the start (and on every new game)
  refreshHighScores(25).catch((e) => console.error(e));
}

function endGame(reason = "") {
  if (gameState.timerId) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
  gameState.running = false;
  els.btnCheck.classList.remove("pulse");
  els.btnRestart.style.display = "inline-block";

  if (reason) {
    setMessage(`<b>Game Over:</b> ${reason}<br>Final Score: <b>${gameState.score}</b>`);
  }

  openNameModal(gameState.score);
}

function tick() {
  if (!gameState.running) return;
  gameState.timerSeconds -= 1;
  updateTimerLabel();
  if (gameState.timerSeconds <= 0) endGame("Time’s up!");
}

function updateTimerLabel() {
  els.timer.textContent = `Time Left: ${gameState.timerSeconds}s`;
}

function checkOrder() {
  if (!gameState.running) return;

  const values = [...els.target.querySelectorAll(".card")].map((c) =>
    Number(c.dataset.value)
  );
  if (values.length === 0) {
    setMessage("Drag some cards into the sorting lane first.");
    return;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const ok = values.every((v, i) => v === sorted[i]);
  if (!ok) {
    setMessage(
      `Not quite! The order isn’t correct. You placed: <code>[${values.join(", ")}]</code>`
    );
    endGame("Incorrect order.");
    return;
  }

  const gained = values.length;
  setScore(gameState.score + gained);
  setMessage(`✅ Nice! Correct order. You earned <b>${gained}</b> points.`, "flash-ef-correct");

  // Clear target lane so gameplay continues
  clearContainer(els.target);
}

/* =========================
   6) High Scores UI (Top 25)
   ========================= */

async function refreshHighScores(limit = 25) {
  try {
    const url = `${API.highscores}?limit=${encodeURIComponent(limit)}`;
    const data = await getJSON(url);
    const items = Array.isArray(data) ? data : [];

    // Clear table body
    while (els.highScoresBody.firstChild) {
      els.highScoresBody.removeChild(els.highScoresBody.firstChild);
    }

    items.forEach((row) => {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      const tdScore = document.createElement("td");
      const tdDate = document.createElement("td");

      tdName.textContent = row.name ?? "";
      tdScore.textContent = row.score ?? "";
      tdDate.textContent = fmtDateTime(row.timestamp);

      tr.appendChild(tdName);
      tr.appendChild(tdScore);
      tr.appendChild(tdDate);
      els.highScoresBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load highscores:", err);
  }
}

/* =========================
   7) Name Modal + Score Submit
   ========================= */

function openNameModal(finalScore) {
  els.modalScoreText.textContent = String(finalScore);
  els.modalInput.value = "";
  els.modalError.style.display = "none";
  els.modal.style.display = "flex";
  els.modalInput.focus();
}

function closeNameModal() {
  els.modal.style.display = "none";
}

async function handleSubmitScore() {
  const name = (els.modalInput.value || "").trim();
  if (!name) {
    els.modalError.textContent = "Please enter a name.";
    els.modalError.style.display = "block";
    return;
  }

  try {
    const payload = { name, score: gameState.score };
    const res = await postJSON(API.submitScore, payload);
    closeNameModal();

    // Show rank & percentile if backend provides them
    if (typeof res.rank === "number" && typeof res.percentile === "number") {
      const rankStr = ordinal(res.rank);
      const pct = Math.max(0, Math.min(100, Math.round(res.percentile)));
      setStatsMessage(
        `Your score is the <b>${rankStr}</b> highest score. That’s the <b>${pct}%</b> percentile.`
      );
    } else {
      // Generic success if stats not returned
      setStatsMessage(
        `Your score has been saved to the leaderboard.`
      );
    }

    // Refresh Top 25 after saving
    await refreshHighScores(25);
  } catch (err) {
    console.error(err);
    els.modalError.textContent = "Failed to submit score. Please try again.";
    els.modalError.style.display = "block";
  }
}

/* =========================
   8) Wire Up Events
   ========================= */

function wireEvents() {
  els.btnCheck.addEventListener("click", checkOrder);
  els.btnRestart.addEventListener("click", startGame);

  // Modal buttons
  els.modalSubmit.addEventListener("click", handleSubmitScore);
  els.modalCancel.addEventListener("click", () => {
    closeNameModal();
    // Still refresh Top 25 (score not saved)
    refreshHighScores(25).catch(() => {});
  });

  // Submit on Enter
  els.modalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmitScore();
    }
  });

  // Optional: close on overlay click
  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) {
      closeNameModal();
      refreshHighScores(25).catch(() => {});
    }
  });
}

/* =========================
   9) Init
   ========================= */

function init() {
  if (els.year) {
    els.year.textContent = new Date().getFullYear();
  }
  setupDropZones();
  wireEvents();
  startGame();
}

document.addEventListener("DOMContentLoaded", init);
