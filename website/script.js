// Auth functions
async function signup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('auth-message');

  if (!email || !password) {
    msg.textContent = "Please enter email and password";
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    msg.textContent = "Account created! Logging in...";
    msg.style.color = "green";
    // User is auto-logged in
  } catch (error) {
    msg.textContent = error.message.replace("Firebase: ", "");
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
    msg.textContent = error.message.replace("Firebase: ", "");
  }
}

function logout() {
  signOut(auth);
}

function continueAsGuest() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('input-screen').style.display = 'block';
  // Optionally show a note: guest mode, data local only
}

function showLoggedIn(email) {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('user-info').style.display = 'block';
  document.getElementById('current-user').textContent = email || "Guest";
  document.getElementById('input-screen').style.display = 'block';
  loadUserData();  // Try to load saved plan
}

// Real-time auth listener
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
// Sample topics array (later load from your JSON file or hardcode more)
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

// For SSC CGL focus - you can expand with your full JSON later
const sscFocusTopics = topics.slice(0, 7); // Prioritize non-banking for SSC

function generatePlan() {
  const monthsInput = document.getElementById('months').value;
  const months = parseInt(monthsInput);

  if (!months || months < 1) {
    alert("Please enter a valid number of months (1 or more).");
    return;
  }

  // Save to localStorage
  localStorage.setItem('prepMonths', months);

  // Calculate days
  const totalDays = months * 30; // approx
  const prepDays = Math.floor(totalDays * 0.8); // 80% prep, 20% revision
  const revisionDays = totalDays - prepDays;

  // Shuffle or sort topics (simple round-robin for now)
  let topicIndex = 0;
  let dailyTopics = [];

  // Preparation phase
  for (let day = 1; day <= prepDays; day++) {
    const topic1 = sscFocusTopics[topicIndex % sscFocusTopics.length];
    const topic2 = (day % 2 === 0) ? sscFocusTopics[(topicIndex + 1) % sscFocusTopics.length] : null;
    dailyTopics.push({ day: `Day ${day} (Prep)`, topics: topic2 ? [topic1, topic2] : [topic1] });
    topicIndex++;
  }

  // Revision phase (lighter - repeat high-weight topics)
  for (let day = 1; day <= revisionDays; day++) {
    const topic = sscFocusTopics[day % sscFocusTopics.length];
    dailyTopics.push({ day: `Day ${prepDays + day} (Revision)`, topics: [topic] });
  }

  // Display summary
  document.getElementById('summary').innerHTML = `
    You have <strong>${months} months (~${totalDays} days)</strong>.<br>
    Preparation: ${prepDays} days • Revision: ${revisionDays} days.<br>
    Daily: 1–2 topics (focus on SSC CGL GA).
  `;

  // Display daily plan
  let html = '';
  dailyTopics.forEach(item => {
    html += `<div class="day-card">
      <strong>${item.day}</strong><br>
      Topics: ${item.topics.join(' + ')}
    </div>`;
  });
  document.getElementById('daily-plan').innerHTML = html;

  // Toggle screens
  document.getElementById('input-screen').style.display = 'none';
  document.getElementById('plan-screen').style.display = 'block';
}

function resetPlan() {
  localStorage.removeItem('prepMonths');
  document.getElementById('months').value = '';
  document.getElementById('input-screen').style.display = 'block';
  document.getElementById('plan-screen').style.display = 'none';
}

// On page load: auto-load if previous plan exists
window.onload = function() {
  const savedMonths = localStorage.getItem('prepMonths');
  if (savedMonths) {
    document.getElementById('months').value = savedMonths;
    generatePlan(); // regenerate
  }
};
