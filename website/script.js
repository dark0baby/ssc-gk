// ───── AUTH FUNCTIONS ─────
async function signup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('auth-message');

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    msg.textContent = "Account created & logged in!";
    msg.style.color = "green";
    setTimeout(goToPlanner, 800); // small delay to see success message
  } catch (error) {
    msg.textContent = error.message.replace("Firebase: ", "").replace(/\(auth\/.*?\)/g, "");
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
    msg.textContent = error.message.replace("Firebase: ", "").replace(/\(auth\/.*?\)/g, "");
    msg.style.color = "red";
  }
}

function continueAsGuest() {
  goToPlanner();
  document.getElementById('current-user').textContent = "Guest (local save only)";
}

function logout() {
  signOut(auth);
}

// ───── MAIN FUNCTION THAT SHOWS THE PLANNER ─────
function goToPlanner() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('user-info').style.display = 'block';
  document.getElementById('input-screen').style.display = 'block';
  loadUserData(); // will load saved plan if any
}

// ───── AUTH STATE LISTENER (MOST IMPORTANT) ─────
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is logged in → show planner directly
    document.getElementById('current-user').textContent = user.email;
    goToPlanner();
  } else {
    // Not logged in → show login screen
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('input-screen').style.display = 'none';
    document.getElementById('plan-screen').style.display = 'none';
  }
});

// ───── REST OF YOUR CODE (SAVE, LOAD, GENERATE PLAN) ─────
async function saveUserData(months, dailyTopics) {
  if (!auth.currentUser) {
    localStorage.setItem('prepMonths', months);
    localStorage.setItem('guestPlan', JSON.stringify(dailyTopics));
    return;
  }
  try {
    await setDoc(doc(db, "users", auth.currentUser.uid), {
      months, plan: dailyTopics, lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (e) { console.error(e); }
}

async function loadUserData() {
  if (!auth.currentUser) {
    loadLocalPlan();
    return;
  }
  const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
  if (snap.exists()) {
    const data = snap.data();
    document.getElementById('months').value = data.months || "";
    if (data.plan) {
      displayPlan(data.plan, data.months);
    }
  }
}

function loadLocalPlan() {
  const months = localStorage.getItem('prepMonths');
  const plan = localStorage.getItem('guestPlan');
  if (months) document.getElementById('months').value = months;
  if (plan) displayPlan(JSON.parse(plan), months);
}

function displayPlan(dailyTopics, months) {
  let html = '';
  dailyTopics.forEach(item => {
    html += `<div class="day-card"><strong>${item.day}</strong><br>Topics: ${item.topics.join(' + ')}</div>`;
  });
  document.getElementById('daily-plan').innerHTML = html;
  document.getElementById('summary').innerHTML = `Loaded your saved plan (${months} months)`;
  document.getElementById('input-screen').style.display = 'none';
  document.getElementById('plan-screen').style.display = 'block';
}

// ───── PLAN GENERATION (same as before) ─────
const sscFocusTopics = [
  "Current Affairs (National/International, Schemes, Awards)",
  "History (Ancient, Medieval, Modern)",
  "Geography (Physical, India & World)",
  "Polity & Constitution",
  "Economy (Basics, Budget, RBI)",
  "General Science (Biology, Physics, Chemistry)",
  "Static GK (Days, Organizations, Culture)"
];

function generatePlan() {
  const monthsInput = document.getElementById('months').value;
  const months = parseInt(monthsInput);

  if (!months || months < 1) {
    alert("Please enter a valid number of months (1 or more).");
    return;
  }

  const totalDays = months * 30;
  const prepDays = Math.floor(totalDays * 0.8);
  const revisionDays = totalDays - prepDays;

  let topicIndex = 0;
  let dailyTopics = [];

  // Preparation phase
  for (let day = 1; day <= prepDays; day++) {
    const topic1 = sscFocusTopics[topicIndex % sscFocusTopics.length];
    const topic2 = (day % 2 === 0) ? sscFocusTopics[(topicIndex + 1) % sscFocusTopics.length] : null;
    dailyTopics.push({ day: `Day ${day} (Prep)`, topics: topic2 ? [topic1, topic2] : [topic1] });
    topicIndex++;
  }

  // Revision phase
  for (let day = 1; day <= revisionDays; day++) {
    const topic = sscFocusTopics[day % sscFocusTopics.length];
    dailyTopics.push({ day: `Day ${prepDays + day} (Revision)`, topics: [topic] });
  }

  // Build HTML for daily plan cards
  let html = '';
  dailyTopics.forEach(item => {
    html += `<div class="day-card">
      <strong>${item.day}</strong><br>
      Topics: ${item.topics.join(' + ')}
    </div>`;
  });

  // Update UI
  document.getElementById('summary').innerHTML = `
    You have <strong>${months} months (~${totalDays} days)</strong>.<br>
    Preparation: ${prepDays} days • Revision: ${revisionDays} days.<br>
    Daily: 1–2 topics (focus on SSC CGL GA).
  `;

  document.getElementById('daily-plan').innerHTML = html;

  // Switch to plan view
  document.getElementById('input-screen').style.display = 'none';
  document.getElementById('plan-screen').style.display = 'block';

  // Save the plan
  saveUserData(months, dailyTopics);
}

function resetPlan() {
  localStorage.clear();
  document.getElementById('months').value = '';
  document.getElementById('input-screen').style.display = 'block';
  document.getElementById('plan-screen').style.display = 'none';
}
