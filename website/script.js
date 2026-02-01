// ────────────────────────────────────────────────
// Firebase Auth & Firestore functions
// ────────────────────────────────────────────────

async function signup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('auth-message');

  if (!email || !password) {
    msg.textContent = "Please enter email and password";
    msg.style.color = "red";
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    msg.textContent = "Account created! You are now logged in.";
    msg.style.color = "green";
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
  } catch (error) {
    msg.textContent = error.message.replace("Firebase: ", "").replace(/\(auth\/.*?\)/g, "").trim();
    msg.style.color = "red";
  }
}

function logout() {
  signOut(auth);
}

function continueAsGuest() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('input-screen').style.display = 'block';
  document.getElementById('auth-message').textContent = "Guest mode: progress saved only in this browser";
  document.getElementById('auth-message').style.color = "#555";
  loadLocalPlan(); // load any previous guest data
}

function showLoggedIn(email) {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('user-info').style.display = 'block';
  document.getElementById('current-user').textContent = email || "Guest";
  document.getElementById('input-screen').style.display = 'block';
  loadUserData(); // load from Firestore if logged in
}

// Auth state listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    showLoggedIn(user.email);
  } else {
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('input-screen').style.display = 'none';
    document.getElementById('plan-screen').style.display = 'none';
  }
});

// ────────────────────────────────────────────────
// Save plan (Firestore for logged-in users)
// ────────────────────────────────────────────────
async function saveUserData(months, dailyTopics) {
  if (!auth.currentUser) {
    // Guest → save to localStorage only
    localStorage.setItem('prepMonths', months);
    localStorage.setItem('guestPlan', JSON.stringify(dailyTopics));
    return;
  }

  try {
    const userRef = doc(db, "users", auth.currentUser.uid);
    await setDoc(userRef, {
      months,
      plan: dailyTopics,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    console.log("Plan saved to Firestore");
  } catch (err) {
    console.error("Save failed:", err);
    alert("Failed to save plan. Check your internet.");
  }
}

// ────────────────────────────────────────────────
// Load saved plan
// ────────────────────────────────────────────────
async function loadUserData() {
  if (!auth.currentUser) return;

  try {
    const userRef = doc(db, "users", auth.currentUser.uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById('months').value = data.months || "";
      
      if (data.plan && data.plan.length > 0) {
        let html = '';
        data.plan.forEach(item => {
          html += `<div class="day-card">
            <strong>${item.day}</strong><br>
            Topics: ${item.topics.join(' + ')}
          </div>`;
        });
        document.getElementById('daily-plan').innerHTML = html;
        document.getElementById('summary').innerHTML = `
          Loaded your saved plan (${data.months} months)<br>
          Last updated: ${new Date(data.lastUpdated).toLocaleString()}
        `;
        document.getElementById('input-screen').style.display = 'none';
        document.getElementById('plan-screen').style.display = 'block';
      }
    }
  } catch (err) {
    console.error("Load failed:", err);
  }
}

// Fallback: load guest/local plan
function loadLocalPlan() {
  const savedMonths = localStorage.getItem('prepMonths');
  const savedPlan = localStorage.getItem('guestPlan');

  if (savedMonths) {
    document.getElementById('months').value = savedMonths;
  }

  if (savedPlan) {
    const plan = JSON.parse(savedPlan);
    let html = '';
    plan.forEach(item => {
      html += `<div class="day-card">
        <strong>${item.day}</strong><br>
        Topics: ${item.topics.join(' + ')}
      </div>`;
    });
    document.getElementById('daily-plan').innerHTML = html;
    document.getElementById('summary').innerHTML = `Loaded your previous guest plan (${savedMonths} months)`;
    document.getElementById('input-screen').style.display = 'none';
    document.getElementById('plan-screen').style.display = 'block';
  }
}

// ────────────────────────────────────────────────
// Your existing topics & plan generation
// ────────────────────────────────────────────────

const topics = [
  "Current Affairs (National/International, Schemes, Awards)",
  "History (Ancient, Medieval, Modern)",
  "Geography (Physical, India & World)",
  "Polity & Constitution",
  "Economy (Basics, Budget, RBI)",
  "General Science (Biology, Physics, Chemistry)",
  "Static GK (Days, Organizations, Culture)",
  "Banking/Financial Awareness (for banking exams)",
  "Environmental & Social Issues"
];

const sscFocusTopics = topics.slice(0, 7);

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

  for (let day = 1; day <= prepDays; day++) {
    const topic1 = sscFocusTopics[topicIndex % sscFocusTopics.length];
    const topic2 = (day % 2 === 0) ? sscFocusTopics[(topicIndex + 1) % sscFocusTopics.length] : null;
    dailyTopics.push({ day: `Day ${day} (Prep)`, topics: topic2 ? [topic1, topic2] : [topic1] });
    topicIndex++;
  }

  for (let day = 1; day <= revisionDays; day++) {
    const topic = sscFocusTopics[day % sscFocusTopics.length];
    dailyTopics.push({ day: `Day ${prepDays + day} (Revision)`, topics: [topic] });
  }

  document.getElementById('summary').innerHTML = `
    You have <strong>${months} months (~${totalDays} days)</strong>.<br>
    Preparation: ${prepDays} days • Revision: ${revisionDays} days.<br>
    Daily: 1–2 topics (focus on SSC CGL GA).
  `;

  let html = '';
  dailyTopics.forEach(item => {
    html += `<div class="day-card">
      <strong>${item.day}</strong><br>
      Topics: ${item.topics.join(' + ')}
    </div>`;
  });
  document.getElementById('daily-plan').innerHTML = html;

  document.getElementById('input-screen').style.display = 'none';
  document.getElementById('plan-screen').style.display = 'block';

  // Save (Firestore or localStorage)
  saveUserData(months, dailyTopics);
}

function resetPlan() {
  localStorage.removeItem('prepMonths');
  localStorage.removeItem('guestPlan');
  document.getElementById('months').value = '';
  document.getElementById('input-screen').style.display = 'block';
  document.getElementById('plan-screen').style.display = 'none';
}

// On page load
window.onload = function() {
  // Will be handled by onAuthStateChanged for logged-in users
  // For guests, loadLocalPlan() is called when they choose guest
};
