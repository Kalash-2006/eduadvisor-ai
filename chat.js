/* ══ EduAdvisor AI — chat.js ══
   Flow: Welcome → Name → Marks → Attendance → Study Hours → Assignments → Result → Continue?
*/

const messagesEl    = document.getElementById('messages');
const chatArea      = document.getElementById('chat-area');
const userInput     = document.getElementById('user-input');
const sendBtn       = document.getElementById('send-btn');
const historyList   = document.getElementById('history-list');
const themeToggle   = document.getElementById('theme-toggle');
const sunIcon       = document.getElementById('sun-icon');
const moonIcon      = document.getElementById('moon-icon');
const sidebar       = document.getElementById('sidebar');
const overlay       = document.getElementById('overlay');
const sidebarToggle = document.getElementById('sidebar-toggle');
const newChatBtn    = document.getElementById('new-chat-btn');
const newChatTop    = document.getElementById('new-chat-top');

const STEPS = ['greeting', 'name', 'marks', 'attendance', 'study_hours', 'assignments', 'result', 'continue', 'done'];
let step = 0;
let collected = {};
let studentName = '';
let isBusy = false;
let sessions = JSON.parse(localStorage.getItem('eduSessions') || '[]');
let currentSessionId = null;
let msgLog = [];

(function init() {
  applyTheme(localStorage.getItem('eduTheme') || 'dark');
  renderHistory();
  startGreeting();
})();

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('eduTheme', t);
  sunIcon.style.display  = t === 'dark'  ? 'block' : 'none';
  moonIcon.style.display = t === 'light' ? 'block' : 'none';
}
themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
});
overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
});

function newChat() {
  step = 0; collected = {}; currentSessionId = null; studentName = '';
  messagesEl.innerHTML = '';
  removeChips();
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  startGreeting();
}
newChatBtn.addEventListener('click', newChat);
newChatTop.addEventListener('click', newChat);

function renderHistory() {
  historyList.innerHTML = '';
  [...sessions].reverse().forEach(s => {
    const li = document.createElement('li');
    li.dataset.id = s.id;
    li.innerHTML = `
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="opacity:.4;flex-shrink:0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="hi-label">${esc(s.title)}</span>`;
    if (s.id === currentSessionId) li.classList.add('active');
    li.addEventListener('click', () => loadSession(s.id));
    historyList.appendChild(li);
  });
}

function saveToHistory(title, msgList) {
  if (!currentSessionId) {
    currentSessionId = 'es_' + Date.now();
    sessions.push({ id: currentSessionId, title, messages: msgList });
  } else {
    const s = sessions.find(x => x.id === currentSessionId);
    if (s) s.messages = msgList;
  }
  localStorage.setItem('eduSessions', JSON.stringify(sessions));
  renderHistory();
}

function loadSession(id) {
  const s = sessions.find(x => x.id === id);
  if (!s) return;
  currentSessionId = id;
  step = 0; collected = {}; studentName = '';
  messagesEl.innerHTML = '';
  removeChips();
  s.messages.forEach(m => {
    if (m.role === 'user') appendUser(m.text, false);
    else if (m.role === 'ai-text') appendAI(m.text, false);
    else if (m.role === 'ai-result') appendResult(m.data, false);
  });
  scrollBottom();
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  renderHistory();
}

userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 180) + 'px';
  sendBtn.disabled = userInput.value.trim() === '' || isBusy;
});
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) handleSend(); }
});
sendBtn.addEventListener('click', handleSend);

function handleSend() {
  const text = userInput.value.trim();
  if (!text || isBusy) return;
  userInput.value = ''; userInput.style.height = 'auto'; sendBtn.disabled = true;
  removeChips();
  appendUser(text);
  msgLog.push({ role: 'user', text });
  processStep(text);
}

function processStep(input) {
  const s = STEPS[step];

  if (s === 'name') {
    studentName = input.trim();
    step++;
    setTimeout(() => {
      const msg = `Nice to meet you, **${studentName}**! 👋\n\nI'll ask you **4 quick questions** about your studies and give you a personalized performance report at the end. 📊\n\nLet's begin!`;
      appendAI(msg);
      msgLog.push({ role: 'ai-text', text: msg });
      setTimeout(() => askMarks(), 800);
    }, 400);
    return;
  }

  if (s === 'marks') {
    const n = extractNumber(input);
    if (n === null || n < 0 || n > 100) {
      aiSay("Hmm, I need a number between **0 and 100** for your marks. What score did you get? 🤔");
      return;
    }
    collected.marks = n;
    step++;
    askAttendance();
    return;
  }

  if (s === 'attendance') {
    const n = extractNumber(input);
    if (n === null || n < 0 || n > 100) {
      aiSay("Please give me a percentage between 0 and 100. For example: **72** or **72%**");
      return;
    }
    collected.attendance = n;
    step++;
    askStudyHours();
    return;
  }

  if (s === 'study_hours') {
    const n = extractNumber(input);
    if (n === null || n < 0 || n > 24) {
      aiSay("Please tell me how many hours you study per day. Example: **2** or **3 hours**");
      return;
    }
    collected.study_hours = n;
    step++;
    askAssignments();
    return;
  }

  if (s === 'assignments') {
    const yes = /yes|haan|ha|sure|done|complete|submit|karta|yep|yeah|do|1|true/i.test(input);
    const no  = /no|nahi|nope|miss|skip|0|false|don't|dont/i.test(input);
    if (!yes && !no) {
      aiSay("Please answer **yes** or **no** — do you regularly complete and submit your assignments?");
      showChips(['Yes ✓', 'No ✗']);
      return;
    }
    collected.assignments = yes ? 'yes' : 'no';
    step++;
    submitAnalysis();
    return;
  }

  if (s === 'continue') {
    const yes = /yes|haan|ha|sure|ok|okay|continue|haan|yep|yeah|1|true/i.test(input);
    if (yes) {
      // Reset collected, restart questions only (keep name)
      collected = {};
      step = 2; // back to marks step
      const msg = `Great! Let's do another round. 🔄\n\nSame questions, new answers — let's see how you're doing!`;
      aiSay(msg);
      setTimeout(() => askMarks(), 900);
    } else {
      step++;
      showThankYou();
    }
    return;
  }
}

function startGreeting() {
  msgLog = [];
  isBusy = true;
  const typing = appendSpinner();
  setTimeout(() => {
    typing.remove();
    const greet = getGreeting();
    const welcome = `${greet}\n\n🎓 **Welcome to your Smart Academic Advisor!**\n\nI'm here to help you understand your academic performance and guide you towards better results. 💡`;
     appendAI(welcome);
    msgLog.push({ role: 'ai-text', text: welcome });
    setTimeout(() => {
      const typing2 = appendSpinner();
      setTimeout(() => {
        typing2.remove();
        const askName = `First, may I know your **name**? 😊`;
        appendAI(askName);
        msgLog.push({ role: 'ai-text', text: askName });
        step = 1;
        userInput.placeholder = "Enter your name...";
        isBusy = false;
        sendBtn.disabled = false;
      }, 800);
    }, 600);
  }, 1200);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "🌅 Good Morning!";
  if (h >= 12 && h < 17) return "☀️ Good Afternoon!";
  if (h >= 17 && h < 21) return "🌆 Good Evening!";
  return "🌙 Good Night!";
}

function askMarks() {
  const msg = `Okay **${studentName}**! Let's start. 📝\n\n**Question 1 of 4:** What are your current marks out of 100?\n*(Type a number like: 65)*`;
  aiSay(msg);
  userInput.placeholder = "Enter your marks (0–100)...";
}

function askAttendance() {
  const msg = `Marks **${collected.marks}/100** noted! ✅\n\n**Question 2 of 4:** What is your attendance percentage?\n*(Example: 75 or 75%)*`;
  aiSay(msg);
  userInput.placeholder = "Enter your attendance %...";
}

function askStudyHours() {
  const msg = `Attendance **${collected.attendance}%** noted! ✅\n\n**Question 3 of 4:** How many hours do you study per day on average?\n*(Example: 2 or 3 hours)*`;
  aiSay(msg);
  userInput.placeholder = "Enter study hours per day...";
}

function askAssignments() {
  const msg = `Study hours **${collected.study_hours}h/day** noted! ✅\n\n**Question 4 of 4 — Last one!** Do you regularly complete and submit your assignments?`;
  aiSay(msg);
  showChips(['Yes ✓', 'No ✗']);
  userInput.placeholder = "Type yes or no...";
}

async function submitAnalysis() {
  userInput.placeholder = "Please wait...";
  isBusy = true;
  sendBtn.disabled = true;

  // Step 1 — Show graph first
  const graphRow = appendGraphOnly(collected);
  scrollBottom();

  await sleep(1000);

  // Step 2 — Show spinner while fetching
  const spinner = appendSpinner();

  try {
    const query = `marks: ${collected.marks}, attendance: ${collected.attendance}, study_hours: ${collected.study_hours}, assignments: ${collected.assignments}`;
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query })
    });
    const data = await res.json();
    spinner.remove();

    await sleep(300);
    appendResult(data, studentName);
    msgLog.push({ role: 'ai-result', data });

    const title = `${studentName} — Marks ${collected.marks}, Att. ${collected.attendance}%`;
    saveToHistory(title, [...msgLog]);

    // Step 3 — Ask continue
    await sleep(800);
    askContinue();

  } catch (e) {
    spinner.remove();
    const errData = {
      status: 'warning',
      summary: 'Could not reach the server. Make sure Flask (app.py) is running on port 5000.',
      issues: [],
      advice: ['Run: python app.py in your terminal', 'Then refresh this page'],
      scores: []
    };
    appendResult(errData, studentName);
    msgLog.push({ role: 'ai-result', data: errData });
    await sleep(800);
    askContinue();
  }

  isBusy = false;
  sendBtn.disabled = false;
  userInput.placeholder = "Type your answer here...";
}

function askContinue() {
  step = 7; // 'continue' step
  const msg = `Would you like to **continue this session** and enter new data, **${studentName}**? 🔄`;
  aiSay(msg);
  setTimeout(() => {
    showChips(['Yes, continue 🔄', 'No, I am done ✓']);
  }, 800);
}

function showThankYou() {
  // Hide input bar
  document.querySelector('.input-bar-wrapper').style.display = 'none';
  removeChips();

  const row = document.createElement('div');
  row.className = 'msg-row ai';
  row.innerHTML = `
    <div class="msg-inner" style="justify-content:center;padding:20px 48px">
      <div class="thankyou-screen">
        <div class="thankyou-icon">🎓</div>
        <h2>Thank You, ${esc(studentName)}!</h2>
        <p>Great job completing your academic review. Keep working hard and you'll see improvement soon. All the best for your studies! 💪</p>
        <button class="thankyou-btn" onclick="newChat()">Start New Session</button>
      </div>
    </div>`;
  messagesEl.appendChild(row);
  scrollBottom();
}

// ── Graph only (shown before result) ──
function appendGraphOnly(data) {
  const row = document.createElement('div');
  row.className = 'msg-row ai';

  const scores = [
    { label: 'Marks',      value: `${data.marks}/100`,    pct: Math.min(data.marks, 100) },
    { label: 'Attendance', value: `${data.attendance}%`,  pct: Math.min(data.attendance, 100) },
    { label: 'Study Hrs',  value: `${data.study_hours}h/day`, pct: Math.min((data.study_hours / 8) * 100, 100) },
    { label: 'Assignments',value: data.assignments === 'yes' ? 'Done ✓' : 'Missed ✗', pct: data.assignments === 'yes' ? 100 : 10 },
  ];

  let barsHtml = '<div class="score-bar-wrap">';
  scores.forEach(s => {
    const color = s.pct < 40 ? '#ef4444' : s.pct < 70 ? '#f59e0b' : '#43e97b';
    barsHtml += `
      <div class="score-row">
        <span class="score-label">${esc(s.label)}</span>
        <div class="score-bar-bg">
          <div class="score-bar-fill" style="width:0%;background:${color};transition:width 1s ease" data-width="${s.pct}"></div>
        </div>
        <span class="score-val">${esc(s.value)}</span>
      </div>`;
  });
  barsHtml += '</div>';

  const msg = `Here's a quick look at your data, **${studentName}**: 📊`;
  row.innerHTML = `
    <div class="msg-inner">
      <div class="ai-avatar">A</div>
      <div class="msg-bubble">
        <p style="margin-bottom:12px;font-size:14.5px">${mdToHtml(msg)}</p>
        ${barsHtml}
      </div>
    </div>`;

  messagesEl.appendChild(row);
  scrollBottom();

  // Animate bars after render
  setTimeout(() => {
    row.querySelectorAll('.score-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  }, 100);

  return row;
}

function appendUser(text, animate = true) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  if (!animate) row.style.animation = 'none';
  row.innerHTML = `<div class="msg-inner"><div class="msg-bubble">${esc(text).replace(/\n/g,'<br>')}</div></div>`;
  messagesEl.appendChild(row);
  scrollBottom();
}

function appendAI(text, animate = true) {
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  if (!animate) row.style.animation = 'none';
  const html = mdToHtml(text);
  row.innerHTML = `<div class="msg-inner"><div class="ai-avatar">A</div><div class="msg-bubble">${html}</div></div>`;
  messagesEl.appendChild(row);
  scrollBottom();
  return row;
}

function aiSay(text) {
  isBusy = true;
  sendBtn.disabled = true;
  const spinner = appendSpinner();
  setTimeout(() => {
    spinner.remove();
    appendAI(text);
    msgLog.push({ role: 'ai-text', text });
    isBusy = false;
    sendBtn.disabled = userInput.value.trim() === '';
  }, 700);
}

// Spinner instead of typing dots
function appendSpinner() {
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  row.innerHTML = `
    <div class="msg-inner">
      <div class="ai-avatar">A</div>
      <div class="msg-bubble">
        <div class="thinking-spinner">
          <div class="spinner-ring"></div>
          <span>Thinking...</span>
        </div>
      </div>
    </div>`;
  messagesEl.appendChild(row);
  scrollBottom();
  return row;
}

function appendResult(data, name = '') {
  const row = document.createElement('div');
  row.className = 'msg-row ai';

  const badgeClass = { critical: 'critical', warning: 'warning', good: 'good' }[data.status] || 'warning';
  const badgeLabel = { critical: '⚠ Needs Urgent Attention', warning: '📋 Needs Improvement', good: '✅ Good Performance' }[data.status] || 'Review';

  const nameTag = name ? `<p style="font-size:15px;font-weight:600;margin-bottom:10px">Here is your report, <span style="color:var(--accent)">${esc(name)}</span>! 📋</p>` : '';

  let html = nameTag + `<span class="status-badge ${badgeClass}">${badgeLabel}</span>`;
  if (data.summary) html += `<p style="font-size:14px;color:var(--text-secondary);margin-bottom:12px">${esc(data.summary)}</p>`;

  if (data.issues && data.issues.length) {
    html += '<ul class="issues-list">';
    data.issues.forEach(i => {
      const dot = i.severity === 'high' ? 'red' : i.severity === 'medium' ? 'yellow' : 'green';
      html += `<li><span class="issue-dot ${dot}"></span>${esc(i.text)}</li>`;
    });
    html += '</ul>';
  }

  if (data.advice && data.advice.length) {
    html += `<p class="advice-title">Recommendations</p><ul class="advice-list">`;
    data.advice.forEach(t => { html += `<li>${esc(t)}</li>`; });
    html += '</ul>';
  }

  row.innerHTML = `<div class="msg-inner"><div class="ai-avatar">A</div><div class="msg-bubble">${html}</div></div>`;
  messagesEl.appendChild(row);
  scrollBottom();
}

function showChips(labels) {
  removeChips();
  const wrapper = document.createElement('div');
  wrapper.className = 'input-bar-wrapper';
  wrapper.id = 'chip-wrapper';
  wrapper.style.paddingTop = '0';
  wrapper.style.borderTop = 'none';
  const row = document.createElement('div');
  row.className = 'quick-chips';
  labels.forEach(label => {
    const btn = document.createElement('button');
    btn.className = 'qchip';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      userInput.value = label.replace(/[✓✗🚀🔄]/g, '').trim();
      removeChips();
      handleSend();
    });
    row.appendChild(btn);
  });
  wrapper.appendChild(row);
  const inputWrapper = document.querySelector('.input-bar-wrapper');
  inputWrapper.parentNode.insertBefore(wrapper, inputWrapper);
}

function removeChips() {
  const el = document.getElementById('chip-wrapper');
  if (el) el.remove();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractNumber(text) {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function esc(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function mdToHtml(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function scrollBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}