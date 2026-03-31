// Dashboard logic

async function loadDashboard() {
  requireAuth();
  initProfile();
  await Promise.all([loadProgress(), loadRecentSubmissions(), loadRecommendations()]);
}

function initProfile() {
  const user = getUser();
  if (!user) return;
  
  const photoEl = document.getElementById('user-photo');
  const nameEl = document.getElementById('display-username');
  const rankEl = document.getElementById('user-rank-val');
  
  if (nameEl) nameEl.textContent = user.name || 'User';
  
  // Mock rank if not in user object
  if (rankEl) rankEl.textContent = user.rank || '889,402';

  if (photoEl && user.profile_url) {
    photoEl.src = user.profile_url;
  } else if (photoEl) {
    photoEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=6366f1&color=fff`;
  }
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const user = getUser();
      user.profile_url = e.target.result;
      saveUser(user);
      initProfile();
      if (typeof renderNavbar === 'function') renderNavbar();
    };
    reader.readAsDataURL(file);
  }
}

function toggleEditProfileDialog() {
  const dialog = document.getElementById('edit-profile-dialog');
  if (dialog.style.display === 'none') {
    const user = getUser();
    document.getElementById('edit-username-input').value = user.name || '';
    document.getElementById('edit-email-input').value = user.email || '';
    dialog.style.display = 'block';
  } else {
    dialog.style.display = 'none';
  }
}

function saveProfileDetails() {
  const newName = document.getElementById('edit-username-input').value.trim();
  const newEmail = document.getElementById('edit-email-input').value.trim();
  
  if (newName) {
    const user = getUser();
    user.name = newName;
    if (newEmail) {
      user.email = newEmail;
    }
    saveUser(user);
    initProfile();
    if (typeof renderNavbar === 'function') renderNavbar();
  }
  
  toggleEditProfileDialog();
}

// ── Progress / ring / heatmap ──────────────────────────────
async function loadProgress() {
  try {
    const data = await progress.getProgress();
    if (!data) return;

    const { stats, platformTotals, topicProgress } = data;

    // 1. TOPIC PROGRESS (Dynamic)
    let topicHTML = '';
    if (!topicProgress || topicProgress.length === 0) {
      document.getElementById('topic-progress').innerHTML =
        '<p style="color:#475569; font-size:13px; text-align:center; padding: 20px;">No progress yet. Start solving!</p>';
    } else {
      topicProgress.forEach(p => {
        const totalSolved = parseInt(p.easy_solved || 0) + parseInt(p.medium_solved || 0) + parseInt(p.hard_solved || 0);
        // Estimate % against a target of 10 for each topic for the visual bar
        const percent = Math.min(Math.round((totalSolved / 10) * 100), 100);

        topicHTML += `
          <div style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <span style="text-transform:capitalize; font-size:14px; font-weight:700; color:#1e293b;">${p.topic}</span>
              <span style="color:#64748b; font-size:12px;">${p.easy_solved || 0}E · ${p.medium_solved || 0}M · ${p.hard_solved || 0}H</span>
            </div>
            <div style="background:#f1f5f9; height:8px; border-radius:8px; overflow:hidden;">
              <div style="width:${percent}%; background:#6366f1; height:100%; border-radius:8px;"></div>
            </div>
          </div>`;
      });
      document.getElementById('topic-progress').innerHTML = topicHTML;
    }

    // 2. TOTAL COUNTS (System Dynamic)
    const totalSolved = (stats.easy || 0) + (stats.medium || 0) + (stats.hard || 0);
    const totalPlatform = (platformTotals.easy || 0) + (platformTotals.medium || 0) + (platformTotals.hard || 0);
    const circ = 2 * Math.PI * 50;

    document.getElementById('ring-total-num').textContent = totalSolved;
    document.getElementById('ring-total-max').textContent = totalPlatform;

    // Difficulty labels
    document.getElementById('d-easy').textContent = stats.easy || 0;
    document.getElementById('d-medium').textContent = stats.medium || 0;
    document.getElementById('d-hard').textContent = stats.hard || 0;

    document.getElementById('d-easy-total').textContent = platformTotals.easy || 0;
    document.getElementById('d-medium-total').textContent = platformTotals.medium || 0;
    document.getElementById('d-hard-total').textContent = platformTotals.hard || 0;

    // Ring animation
    const easyFrac = ((stats.easy || 0) / (totalPlatform || 1)) * circ;
    const medFrac = ((stats.medium || 0) / (totalPlatform || 1)) * circ;
    const hardFrac = ((stats.hard || 0) / (totalPlatform || 1)) * circ;
    
    setTimeout(() => {
      setArc('ring-easy', easyFrac || 0, circ, 0);
      setArc('ring-medium', medFrac || 0, circ, easyFrac);
      setArc('ring-hard', hardFrac || 0, circ, easyFrac + medFrac);
    }, 100);

    // Badge
    const badgeName = totalSolved >= 20 ? 'Gold Badge' : totalSolved >= 10 ? 'Silver Badge' : 'Active Solver';
    document.getElementById('badge-name').textContent = badgeName;

  } catch (err) {
    console.error('Topic progress load error:', err);
    document.getElementById('topic-progress').innerHTML = '<p style="color:#ef4444; font-size:13px; text-align:center; padding: 20px;">Nothing found yet. Pick a problem to start!</p>';
  }
}

function setArc(id, filled, total, offset) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.strokeDasharray = `${filled} ${total - filled}`;
  el.style.strokeDashoffset = -offset;
}

// ── Recent Submissions + Heatmap ──────────────────────────
// ── Recent Submissions + Heatmap ──────────────────────────
let allSubmissions = [];

async function loadRecentSubmissions() {
  try {
    const data = await submissions.getMySubmissions();
    allSubmissions = data || [];
    const container = document.getElementById('recent-submissions');

    if (!allSubmissions.length) {
      container.innerHTML = '<p style="color:#475569; font-size:13px;">No submissions yet.</p>';
      buildHeatmap([], 'last-year');
      return;
    }

    // Default: Past year
    buildHeatmap(allSubmissions, 'last-year');

    // Recent 5 for the list
    const recent = allSubmissions.slice(0, 5);
    let html = '';
    recent.forEach(s => {
      const date = new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const statusClass = `status-badge-${s.status.toLowerCase()}`;
      
      html += `
        <div class="sub-row submission-item" onclick="showSubmissionCode('${s.id}')" title="Click to view code" style="cursor:pointer; transition:all 0.2s; padding:12px 8px; border-radius:8px; display: flex; justify-content: space-between; align-items: center;">
          <span class="sub-title" style="flex: 1; font-weight: 600; color: #1e293b;">${s.title || 'Problem #' + s.problem_id}</span>
          <div style="width: 130px; text-align: center;">
            <span class="${statusClass}" style="transform: scale(0.9); font-size: 10px;">${s.status.toUpperCase()}</span>
          </div>
          <span class="sub-date" style="width: 70px; text-align: right; color: #64748b; font-size: 12px;">${date}</span>
        </div>`;
    });
    container.innerHTML = html;

    // Stats (Global)
    const activeDays = new Set(allSubmissions.map(s => new Date(s.submitted_at).toDateString())).size;
    document.getElementById('heatmap-total').textContent = allSubmissions.length;
    document.getElementById('active-days').textContent = activeDays;
    document.getElementById('max-streak').textContent = calcMaxStreak(allSubmissions);

    // Year select listener
    const yearSelect = document.getElementById('heatmap-year-select');
    if (yearSelect) {
      yearSelect.onchange = (e) => buildHeatmap(allSubmissions, e.target.value);
    }

  } catch (err) {
    document.getElementById('recent-submissions').innerHTML = '<p style="color:#ef4444;">Failed to load submissions.</p>';
    buildHeatmap([], 'last-year');
  }
}

function calcMaxStreak(data) {
  if (!data.length) return 0;
  const days = [...new Set(data.map(s => new Date(s.submitted_at).toDateString()))].map(d => new Date(d)).sort((a, b) => a - b);
  let max = 1, cur = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (days[i] - days[i-1]) / 86400000;
    if (diff === 1) { cur++; max = Math.max(max, cur); }
    else cur = 1;
  }
  return max;
}

function buildHeatmap(data, filterYear) {
  const grid = document.getElementById('heatmap-grid');
  const months = document.getElementById('heatmap-months');
  if (!grid) return;

  const counts = {};
  data.forEach(s => {
    const d = new Date(s.submitted_at).toISOString().split('T')[0];
    counts[d] = (counts[d] || 0) + 1;
  });

  let startDate, weeksToShow;
  if (filterYear === 'last-year') {
    const today = new Date();
    weeksToShow = 53;
    startDate = new Date(today);
    startDate.setDate(today.getDate() - (weeksToShow * 7) + 1);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start on Sunday
  } else {
    const yearNum = parseInt(filterYear);
    startDate = new Date(yearNum, 0, 1); // Jan 1st
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Align to weekly start
    weeksToShow = 53; // Calendar year usually fits in 53 weekly columns
  }

  let gridHTML = '';
  let monthsHTML = '';
  let lastMonth = -1;
  let yearSubmissions = 0;

  for (let w = 0; w < weeksToShow; w++) {
    // Add extra margin if it's the first column of a new month (but not the very first column)
    const colDate = new Date(startDate.getTime() + w * 7 * 86400000);
    const prevColDate = new Date(startDate.getTime() + (w - 1) * 7 * 86400000);
    const isNewMonth = w > 0 && colDate.getMonth() !== prevColDate.getMonth();
    const marginClass = isNewMonth ? 'style="margin-left: 10px;"' : '';

    gridHTML += `<div class="heatmap-col" ${marginClass}>`;
    for (let d = 0; d < 7; d++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + w * 7 + d);
      
      // If filterYear is specific, only count days in that year
      const isInYear = filterYear === 'last-year' || day.getFullYear() === parseInt(filterYear);
      const key = day.toISOString().split('T')[0];
      const cnt = isInYear ? (counts[key] || 0) : 0;
      if (isInYear) yearSubmissions += cnt;

      const heat = cnt === 0 ? 0 : cnt <= 1 ? 1 : cnt <= 3 ? 2 : cnt <= 5 ? 3 : 4;
      
      const formattedDate = day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      const ordinalSuffix = (n) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };
      // Format as target like "December 17th"
      const dayStr = day.getDate();
      const monthStr = day.toLocaleDateString('en-US', { month: 'long' });
      const fancyDate = `${monthStr} ${ordinalSuffix(dayStr)}`;
      
      let tooltipText = "No submissions";
      if (cnt === 1) tooltipText = `1 submission on ${fancyDate}.`;
      else if (cnt > 1) tooltipText = `${cnt} submissions on ${fancyDate}.`;
      else tooltipText = `No submissions on ${fancyDate}.`;

      gridHTML += `<div class="heatmap-cell heat-${heat}" title="${tooltipText}"></div>`;
    }
    gridHTML += '</div>';

    // Improved Month alignment
    const colDateMo = new Date(startDate);
    colDateMo.setDate(startDate.getDate() + w * 7);
    const mo = colDateMo.getMonth();
    
    if (mo !== lastMonth) {
      lastMonth = mo;
      const label = colDate.toLocaleDateString('en-US', { month: 'short' });
      // To match the gap in the grid, we give min-width instead of flex: 1 when it's just starting, 
      // but the months display flex already spaces them out. We'll adjust the padding/margin easily here.
      const mmargin = isNewMonth ? 'margin-left: 10px;' : '';
      monthsHTML += `<div style="flex: 1; min-width: 0; font-size: 11px; color: #64748b; ${mmargin}">${label}</div>`;
    }
  }

  grid.innerHTML = gridHTML;
  months.innerHTML = monthsHTML;
  document.getElementById('heatmap-total').textContent = yearSubmissions;
}

// ── Recommendations ────────────────────────────────────────
async function loadRecommendations() {
  try {
    const data = await progress.getRecommendations();
    const container = document.getElementById('recommendations');

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color:#475569; font-size:13px;">Solve more problems to get recommendations.</p>';
      return;
    }

    let html = '';
    data.slice(0, 3).forEach(problem => {
      const color = problem.difficulty === 'Easy' ? '#16a34a' : problem.difficulty === 'Medium' ? '#d97706' : '#dc2626';
      html += `
        <div onclick="window.location.href='problem.html?id=${problem.id}'"
          style="padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;
          margin-bottom:10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;
          transition:border-color 0.2s;" onmouseover="this.style.borderColor='#6366f1'" onmouseout="this.style.borderColor='#e2e8f0'">
          <span style="font-weight:600; color:#1e293b;">${problem.title}</span>
          <span style="color:${color}; font-size:12px; font-weight:700;">${problem.difficulty}</span>
        </div>`;
    });
    container.innerHTML = html;

  } catch (err) {
    document.getElementById('recommendations').innerHTML = '<p style="color:#ef4444;">Failed to load recommendations.</p>';
  }
}

loadDashboard();

// SUBMISSION MODAL LOGIC
let currentViewingSubmission = null;

function showSubmissionCode(submissionId) {
  const submission = allSubmissions.find(s => String(s.id) === String(submissionId));
  if (!submission) return;
  
  currentViewingSubmission = submission;

  const modal = document.getElementById('submission-modal');
  const codeEl = document.getElementById('modal-code');
  const statusEl = document.getElementById('modal-status');
  const langEl = document.getElementById('modal-language');
  const runtimeEl = document.getElementById('modal-runtime');
  const dateEl = document.getElementById('modal-date');

  // Set Content
  codeEl.textContent = submission.code || '// No code found for this submission';
  
  statusEl.textContent = submission.status.replace(/_/g, ' ').toUpperCase();
  statusEl.className = `badge status-badge-${submission.status.toLowerCase()}`;
  
  langEl.textContent = submission.language;
  runtimeEl.textContent = (submission.execution_time || '0.00') + 's';
  dateEl.textContent = new Date(submission.submitted_at).toLocaleString();

  // Show Modal
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden'; 
}

function closeSubmissionModal() {
  const modal = document.getElementById('submission-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = 'auto';
  currentViewingSubmission = null;
}

function restoreToEditor() {
  if (!currentViewingSubmission) return;

  const { code, language, problem_id } = currentViewingSubmission;
  
  // Store code in sessionStorage to be picked up by problem.html
  sessionStorage.setItem('pending_restore_code', code);
  sessionStorage.setItem('pending_restore_language', language);

  // Redirect to the problem page
  window.location.href = `problem.html?id=${problem_id}`;
}

// Close modal on click outside
window.addEventListener('click', function(event) {
  const modal = document.getElementById('submission-modal');
  if (event.target === modal) {
    closeSubmissionModal();
  }
});
