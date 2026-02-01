// ───── CONSTANTS ─────
const sscFocusTopics = [
  "Current Affairs (National/International, Schemes, Awards)",
  "History (Ancient, Medieval, Modern)",
  "Geography (Physical, India & World)",
  "Polity & Constitution",
  "Economy (Basics, Budget, RBI)",
  "General Science (Biology, Physics, Chemistry)",
  "Static GK (Days, Organizations, Culture)"
];

// ───── AUTH FUNCTIONS ─────
async function signup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('auth-message');

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    msg.textContent = "Account created & logged in!";
    msg.style.color = "green";
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
    setTimeout(goToPlanner, 800);
  } catch (error) {
    msg.textContent = error.message.replace("Firebase: ", "").replace(/\(auth\/.*?\)/g, "").trim();
    msg.style.color = "red";
  }
}

function continueAsGuest() {
  document.getElementById('current-user').textContent = "Guest (local save only)";
  goToPlanner();
}

function logout() {
  signOut(auth);
}

// ───── MAIN PLANNER ENTRY ─────
function goToPlanner() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('user-info').style.display = 'block';
  document.getElementById('input-screen').style.display = 'block';
  loadUserData();
}

// ───── AUTH STATE LISTENER ─────
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('current-user').textContent = user.email;
    goToPlanner();
  } else {
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('input-screen').style.display = 'none';
    document.getElementById('plan-screen').style.display = 'none';
    document.getElementById('daily-view').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'none';
  }
});

// ───── SAVE / LOAD ─────
async function saveUserData(key, value) {
  if (!auth.currentUser) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  try {
    const userRef = doc(db, "users", auth.currentUser.uid);
    await setDoc(userRef, { [key]: value }, { merge: true });
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
    if (snap.exists()) {
      return snap.data()[key];
    }
  } catch (e) {
    console.error("Load failed:", e);
  }
  return null;
}

// ───── PLAN GENERATION ─────
function generatePlan() {
  const months = parseInt(document.getElementById('months').value);
  if (!months || months < 1) {
    alert("Enter a valid number of months (1 or more)");
    return;
  }

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
    Preparation: ${prepDays} days • Revision: ${revisionDays} days<br>
    Daily: 1–2 topics
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
  alert("Preparation started from today! Check daily at 6AM IST.");
  showDailyView();
}

// ───── SHOW DAILY VIEW ─────
async function showDailyView() {
  document.getElementById('plan-screen').style.display = 'none';
  document.getElementById('daily-view').style.display = 'block';

  const startDateStr = await loadUserData('startDate');
  if (!startDateStr) {
    alert("Start your preparation with 'Start Today' button.");
    return;
  }

  const startDate = new Date(startDateStr);
  const now = new Date();
  const currentDay = Math.floor((now - startDate) / (1000 * 60 * 60 * 24)) + 1;

  const plan = await loadUserData('plan');
  if (!plan || currentDay > plan.length) {
    alert("Preparation complete or no plan found.");
    return;
  }

  const todayItem = plan[currentDay - 1];
  document.getElementById('current-day').innerText = currentDay;
  document.getElementById('today-topic').innerHTML = `<strong>Today's Topic(s):</strong> ${todayItem.topics.join(' + ')}`;

  // Generate full content via Grok API (proxy)
  let contentHtml = '';
  for (const topic of todayItem.topics) {
    const content = await callGrokAPI(`Generate full detailed chapter on "${topic}" for SSC CGL General Awareness from Lucent GK and NCERT books. Include all key facts, examples, diagrams descriptions, PYQ trends, and important points. Full content, no summaries - 800-1500 words.`);
    contentHtml += `<h3>${topic}</h3><p>${content}</p>`;
  }
  document.getElementById('today-content').innerHTML = contentHtml;
}

// ───── QUIZ FUNCTIONS ─────
async function startQuiz() {
  document.getElementById('daily-view').style.display = 'none';
  document.getElementById('quiz-screen').style.display = 'block';

  const todayTopic = document.getElementById('today-topic').textContent.split(':')[1].trim();
  const progress = await loadUserData('quizProgress') || {};
  const wrongQ = progress[todayTopic] || [];

  // Generate fresh questions via API
  const prompt = `Generate 20 SSC CGL Tier-1 GA questions on "${todayTopic}" (2016-2025 style). Include 4 options, correct answer, short explanation, difficulty (Easy/Medium/Hard). Format as JSON array of objects: {q, options, a, explanation, difficulty, attempts:0, correct:0}.`;
  const jsonStr = await callGrokAPI(prompt);
  let newQuestions = JSON.parse(jsonStr);
  newQuestions.forEach(q => { q.attempts = 0; q.correct = 0; });

  // Mix 60% new + 40% wrong
  const quizQ = [...newQuestions.slice(0, 12), ...wrongQ.slice(0, 8)];

  let html = '';
  quizQ.forEach((q, i) => {
    html += `<p>${i+1}. ${q.q} (Difficulty: ${q.difficulty})</p>`;
    q.options.forEach(opt => {
      html += `<label><input type="radio" name="q${i}" value="${opt}">${opt}</label><br>`;
    });
  });
  document.getElementById('quiz-questions').innerHTML = html;

  window.currentQuiz = quizQ;
  window.currentTopic = todayTopic;
}

async function submitQuiz() {
  const progress = await loadUserData('quizProgress') || {};
  const wrongQ = progress[window.currentTopic] || [];
  let score = 0;

  window.currentQuiz.forEach((q, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`)?.value;
    q.attempts = (q.attempts || 0) + 1;
    if (selected === q.a) {
      q.correct = (q.correct || 0) + 1;
      score++;
    } else {
      wrongQ.push(q);
    }
  });

  document.getElementById('quiz-score').innerHTML = `Score: ${score} / ${window.currentQuiz.length}`;

  // Update wrong questions (keep if <80%)
  const updatedWrong = window.currentQuiz.filter(q => (q.correct / q.attempts) < 0.8);
  progress[window.currentTopic] = updatedWrong;
  saveUserData('quizProgress', progress);

  // Save daily score
  const today = new Date().toISOString().split('T')[0];
  const scores = await loadUserData('quizScores') || {};
  scores[today] = score;
  saveUserData('quizScores', scores);

  document.getElementById('repeat-wrong').style.display = updatedWrong.length > 0 ? 'block' : 'none';

  // Adaptive next day difficulty
  const scorePct = (score / window.currentQuiz.length) * 100;
  const nextDifficulty = scorePct < 60 ? 'Easy' : scorePct < 80 ? 'Medium' : 'Hard';
  saveUserData('nextDifficulty', nextDifficulty);
}

function repeatWrongQuestions() {
  startQuiz();
}

function finishDay() {
  document.getElementById('quiz-screen').style.display = 'none';
  alert("Day complete! See you tomorrow after 6AM.");
}

// ───── GROK API CALL (via proxy) ─────
async function callGrokAPI(prompt) {
  try {
    const response = await fetch('/api/grok-proxy', {
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
    console.error("Grok API failed:", e);
    return "Error: Could not generate content. Try again later.";
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
      alert("New day starts at 6AM IST. Come back then.");
    }
  }
};
