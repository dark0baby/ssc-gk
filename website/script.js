// ───── CONSTANTS ─────
const GROK_PROXY_URL = '/api/grok-proxy';

// ───── AUTH FUNCTIONS ─────
async function signup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('auth-message');
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    msg.textContent = "Account created & logged in!";
    msg.style.color = "green";
    localStorage.clear();
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
    localStorage.clear();
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
async function goToPlanner() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('user-info').style.display = 'block';

  // Show loading immediately
  document.getElementById('input-screen').innerHTML = '<p>Loading your data...</p>';
  document.getElementById('input-screen').style.display = 'block';

  // Load data in background
  loadAllUserData();
}

// ───── AUTH LISTENER ─────
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

// ───── LOAD ALL DATA ─────
async function loadAllUserData() {
  const months = await loadUserData('months');
  const plan = await loadUserData('plan');
  const startDate = await loadUserData('startDate');

  // Hide loading message
  document.getElementById('input-screen').innerHTML = `
    <h2>How many months until your exam?</h2>
    <p>Enter a number (1–36)</p>
    <input type="number" id="months" min="1" max="36" placeholder="e.g. 6" required />
    <button onclick="generatePlan()">Generate My Plan</button>
  `;

  if (plan && months && startDate) {
    displayPlan(plan, months);
    showDailyView();
  } else if (plan && months) {
    displayPlan(plan, months);
  } else {
    // Input screen already shown
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
    if (snap.exists()) return snap.data()[key];
  } catch (e) {
    console.error("Load failed:", e);
  }
  return null;
}

// ───── DISPLAY SAVED PLAN ─────
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
  document.getElementById('plan-screen').style.display = 'block';
}

// ───── GENERATE PLAN ─────
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

// Rest of your code (startToday, showDailyView, startQuiz, submitQuiz, callGrokAPI, etc.) remains unchanged
