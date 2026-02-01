// ───── CONSTANTS ─────
const GROK_PROXY_URL = '/api/grok-proxy'; // Your Vercel proxy path (change if custom domain)

// ───── AUTH FUNCTIONS ─────
async function signup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('auth-message');

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    msg.textContent = "Account created & logged in!";
    msg.style.color = "green";
    localStorage.clear(); // Clear guest junk
    setTimeout(goToPlanner, 800);
  } catch (error) {
    msg.textContent = error.message.replace("Firebase: ", "").replace(/\(auth\/.*?\)/g, "").trim();
    msg.style.color = "red";
  }
}

async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('auth-message');

  try {
    await signInWithEmailAndPassword(auth, email, password);
    msg.textContent = "Logged in successfully!";
    msg.style.color = "green";
    localStorage.clear(); // Prevent guest data leak
    setTimeout(goToPlanner, 800);
  } catch (error) {
    msg.textContent = error.message.replace("Firebase: ", "").replace(/\(auth\/.*?\)/g, "").trim();
    msg.style.color = "red";
  }
}

function continueAsGuest() {
  document.getElementById('current-user').textContent = "Guest (local only)";
  goToPlanner();
}

function logout() {
  signOut(auth);
}

// ───── MAIN PLANNER ENTRY ─────
function goToPlanner() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('user-info').style.display = 'block';
  loadAllUserData(); // Load everything after auth confirmed
}

// ───── AUTH LISTENER ─────
onAuthStateChanged(auth, async (user) => {
  console.log("Auth changed:", user ? user.email : "Logged out");

  if (user) {
    document.getElementById('current-user').textContent = user.email;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('user-info').style.display = 'block';
    await loadAllUserData();
  } else {
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('input-screen').style.display = 'none';
    document.getElementById('plan-screen').style.display = 'none';
    document.getElementById('daily-view').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'none';
  }
});

// ───── LOAD ALL DATA AFTER LOGIN ─────
async function loadAllUserData() {
  const months = await loadUserData('months');
  const plan = await loadUserData('plan');
  const startDate = await loadUserData('startDate');

  if (plan && months) {
    displayPlan(plan, months);
    document.getElementById('input-screen').style.display = 'none';
    document.getElementById('plan-screen').style.display = 'block';
  } else {
    document.getElementById('input-screen').style.display = 'block';
  }

  if (startDate) {
    showDailyView();
  }
}

// ───── SAVE / LOAD ─────
async function saveUserData(key, value) {
  if (!auth.currentUser) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  try {
    const userRef = doc(db, "users", auth.currentUser.uid);
    await setDoc(userRef, { [key]: value }, { merge: true });
    console.log(`Saved ${key}`);
  } catch (e) {
    console.error("Save failed:", e);
  }
}

async function loadUserData(key) {
  if (!auth.currentUser) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }
  try {
    const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (snap.exists() && snap.data()[key] !== undefined) {
      return snap.data()[key];
    }
  } catch (e) {
    console.error("Load failed for " + key + ":", e);
  }
  return null;
}

function displayPlan(dailyTopics, months) {
  let html = '';
  dailyTopics.forEach(item => {
    html += `<div class="day-card">
      <strong>${item.day}</strong><br>
      Topics: ${item.topics.join(' + ')}
    </div>`;
  });
  document.getElementById('daily-plan').innerHTML = html;
  document.getElementById('summary').innerHTML = `Your saved plan (${months} months)`;
  document.getElementById('input-screen').style.display = 'none';
  document.getElementById('plan-screen').style.display = 'block';
}

// ───── GENERATE INITIAL PLAN (once) ─────
function generatePlan() {
  const months = parseInt(document.getElementById('months').value);
  if (!months || months < 1) return alert("Enter months (1+).");

  const totalDays = months * 30;
  const prepDays = Math.floor(totalDays * 0.8);
  const revisionDays = totalDays - prepDays;

  let topicIndex = 0;
  let dailyTopics = [];

  for (let d = 1; d <= prepDays; d++) {
    const t1 = sscFocusTopics[topicIndex % sscFocusTopics.length];
    const t2 = d % 2 === 0 ? sscFocusTopics[(topicIndex + 1) % sscFocusTopics.length] : null;
    dailyTopics.push({ day: `Day ${d} (Prep)`, topics: t2 ? [t1, t2] : [t1] });
    topicIndex++;
  }

  for (let d = 1; d <= revisionDays; d++) {
    dailyTopics.push({ day: `Day ${prepDays + d} (Revision)`, topics: [sscFocusTopics[d % sscFocusTopics.length]] });
  }

  let html = '';
  dailyTopics.forEach(item => {
    html += `<div class="day-card">
      <strong>${item.day}</strong><br>
      Topics: ${item.topics.join(' + ')}
    </div>`;
  });

  document.getElementById('daily-plan').innerHTML = html;
  document.getElementById('summary').innerHTML = `
    <strong>${months} months (~${totalDays} days)</strong><br>
    Prep: ${prepDays} days • Revision: ${revisionDays} days
  `;

  document.getElementById('input-screen').style.display = 'none';
  document.getElementById('plan-screen').style.display = 'block';

  saveUserData('plan', dailyTopics);
  saveUserData('months', months);
}

// ───── START TODAY ─────
async function startToday() {
  const today = new Date().toISOString().split('T')[0];
  saveUserData('startDate', today);
  alert("Preparation started today! Open daily after 6 AM IST.");
  showDailyView();
}

// ───── DAILY VIEW (dynamic via API) ─────
async function showDailyView() {
  document.getElementById('plan-screen').style.display = 'none';
  document.getElementById('daily-view').style.display = 'block';

  const startDateStr = await loadUserData('startDate');
  if (!startDateStr) return alert("Click 'Start Today' first.");

  const startDate = new Date(startDateStr);
  const now = new Date();
  const currentDay = Math.floor((now - startDate) / 86400000) + 1;

  // Dynamic daily task from API
  const prompt = `For SSC CGL GA Day ${currentDay}, generate today's focused study topic/chapter. 
  Title + full detailed content (800-1500 words) from Lucent GK/NCERT. Include facts, examples, PYQ trends. 
  Return JSON: {title: "...", content: "..."}`;

  const jsonStr = await callGrokAPI(prompt);
  const todayTask = JSON.parse(jsonStr);

  document.getElementById('current-day').innerText = currentDay;
  document.getElementById('today-topic').innerHTML = `<strong>Day ${currentDay}:</strong> ${todayTask.title}`;
  document.getElementById('today-content').innerHTML = todayTask.content.replace(/\n/g, '<br>');

  // Save today's task
  saveUserData(`day_${currentDay}`, todayTask);
}

// ───── QUIZ ─────
async function startQuiz() {
  document.getElementById('daily-view').style.display = 'none';
  document.getElementById('quiz-screen').style.display = 'block';

  const currentDay = document.getElementById('current-day').innerText;
  const todayTask = await loadUserData(`day_${currentDay}`);
  const topic = todayTask.title;

  const prompt = `Generate 20 SSC CGL GA questions on "${topic}". 4 options, correct answer, explanation, difficulty. JSON array: [{q, options, a, explanation, difficulty, attempts:0, correct:0}]`;

  const jsonStr = await callGrokAPI(prompt);
  let questions = JSON.parse(jsonStr);
  questions.forEach(q => { q.attempts = 0; q.correct = 0; });

  let html = '';
  questions.forEach((q, i) => {
    html += `<p><strong>Q${i+1} (${q.difficulty}):</strong> ${q.q}</p>`;
    q.options.forEach(opt => html += `<label><input type="radio" name="q${i}" value="${opt}">${opt}</label><br>`);
  });
  document.getElementById('quiz-questions').innerHTML = html;

  window.currentQuiz = questions;
}

async function submitQuiz() {
  let score = 0;
  window.currentQuiz.forEach((q, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`)?.value;
    q.attempts = (q.attempts || 0) + 1;
    if (selected === q.a) {
      q.correct = (q.correct || 0) + 1;
      score++;
    }
  });

  document.getElementById('quiz-score').innerHTML = `Score: ${score} / ${window.currentQuiz.length}`;

  const today = new Date().toISOString().split('T')[0];
  const scores = await loadUserData('quizScores') || {};
  scores[today] = score;
  saveUserData('quizScores', scores);

  alert("Quiz submitted! Check progress tomorrow.");
  finishDay();
}

function finishDay() {
  document.getElementById('quiz-screen').style.display = 'none';
  document.getElementById('daily-view').style.display = 'block';
}

// ───── GROK API CALL ─────
async function callGrokAPI(prompt) {
  try {
    const response = await fetch(GROK_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model: "grok-4-latest",
        temperature: 0.7,
        stream: false
      })
    });
    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (e) {
    console.error("API failed:", e);
    return "Error generating content.";
  }
}

// ───── LOAD ON PAGE ─────
window.onload = async () => {
  const startDate = await loadUserData('startDate');
  if (startDate) {
    const now = new Date();
    if (now.getHours() >= 6) {
      showDailyView();
    } else {
      alert("New day starts at 6 AM IST. Come back then.");
    }
  }
};
