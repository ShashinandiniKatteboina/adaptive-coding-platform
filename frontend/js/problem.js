// Shared navbar is handled by api.js renderNavbar

let editor;
let currentProblemId;
let currentExamples = [];
let currentProblemLabels =[];
let currentSubmissions =[];
let currentViewingSubmission = null;

const defaultCode = {
  python: '# Write your solution here\n\n',
  java: `import java.util.Scanner;\n\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    // Write your solution here\n  }\n}`,
  javascript: '// Write your solution here\n\n',
  cpp: `#include<iostream>\nusing namespace std;\n\nint main() {\n  // Write your solution here\n  return 0;\n}`
};

function getProblemId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// LEFT TAB SWITCHING
function switchLeftTab(tab) {
  document.querySelectorAll('.problem-left-section .section-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.problem-left-section .tab-pane').forEach(p => p.classList.remove('active'));

  event.target.classList.add('active');
  document.getElementById(`tab-content-${tab}`).classList.add('active');
}

// CONSOLE TAB SWITCHING
function switchConsoleTab(tab) {
  document.querySelectorAll('.console-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.console-pane').forEach(p => p.classList.remove('active'));

  const clickedTab = document.querySelector(`.console-tab[onclick*="${tab}"]`);
  if(clickedTab) clickedTab.classList.add('active');
  
  document.getElementById(`console-${tab}`).classList.add('active');
}

function toggleConsole() {
  const consoleBody = document.querySelector('.console-body');
  const currentDisplay = window.getComputedStyle(consoleBody).display;
  consoleBody.style.display = currentDisplay === 'none' ? 'block' : 'none';
  setTimeout(() => { if (editor) editor.layout(); }, 50);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.style.background = type === 'success' ? '#dcfce7' : '#fee2e2';
  toast.style.color = type === 'success' ? '#15803d' : '#b91c1c';
  toast.style.border = type === 'success' ? '1px solid #86efac' : '1px solid #fca5a5';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.marginBottom = '10px';
  toast.style.fontWeight = '600';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s, transform 0.3s';
  toast.style.transform = 'translateY(-10px)';
  toast.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
  toast.textContent = message;

  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Monaco Editor
require.config({
  paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }
});

require(['vs/editor/editor.main'], function () {
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: defaultCode.python,
    language: 'python',
    theme: 'vs',
    fontSize: 14,
    minimap: { enabled: false },
    automaticLayout: true
  });

  loadProblem();
});

function changeLanguage() {
  const lang = document.getElementById('language-select').value;
  monaco.editor.setModelLanguage(editor.getModel(), lang);
  editor.setValue(defaultCode[lang]);
}

async function loadProblem() {
  const id = getProblemId();
  if (!id) return;

  currentProblemId = id;

  try {
    const problem = await problems.getById(id);

    document.title = `Random — ${problem.title}`;
    document.getElementById('problem-title').textContent = problem.title;
    document.getElementById('problem-description').textContent = problem.description;

    // FIX 1: Show the content and hide loading!
    const loadingEl = document.getElementById('problem-loading');
    if (loadingEl) loadingEl.style.display = 'none';
    const contentEl = document.getElementById('problem-content');
    if (contentEl) contentEl.style.display = 'block';

    const diffBadge = document.getElementById('problem-difficulty');
    if (diffBadge) {
      diffBadge.textContent = problem.difficulty;
      diffBadge.className = `badge badge-${(problem.difficulty || '').toLowerCase()}`;
    }

    const topicBadge = document.getElementById('problem-topic');
    if (topicBadge) {
      topicBadge.textContent = problem.topic;
    }

    // Safety check: filter out empty DB joins where examples = [null]
    currentExamples = Array.isArray(problem.examples) 
      ? problem.examples.filter(ex => ex && ex.input != null) 
      : [];
    currentProblemLabels = problem.input_labels
      ? problem.input_labels.split(',').map(l => l.trim())
      :[];

    renderExamples();
    
    // CHECK FOR PENDING RESTORE (from Dashboard)
    const pendingCode = sessionStorage.getItem('pending_restore_code');
    const pendingLang = sessionStorage.getItem('pending_restore_language');
    
    if (pendingCode && pendingLang && editor) {
      document.getElementById('language-select').value = pendingLang;
      monaco.editor.setModelLanguage(editor.getModel(), pendingLang);
      editor.setValue(pendingCode);
      
      // Clear after applying
      sessionStorage.removeItem('pending_restore_code');
      sessionStorage.removeItem('pending_restore_language');
      
      showToast('Restored from submission history', 'success');
    }

    loadMySubmissions(id);

  } catch (err) {
    console.error(err);
    document.getElementById('problem-loading').textContent = 'Error loading problem.';
  }
}

function renderExamples() {
  const examplesDiv = document.getElementById('problem-examples');
  examplesDiv.innerHTML = '';

  if (currentExamples.length === 0) {
    examplesDiv.innerHTML = '<p style="color:#64748b;">No examples provided.</p>';
    return;
  }

  currentExamples.forEach((ex, i) => {
    examplesDiv.innerHTML += `
      <div class="example-box" style="margin-bottom:12px; padding:14px; background:#f8fafc; border-radius:8px; border-left:3px solid #6366f1;">
        <strong style="color:#64748b; font-size:12px; text-transform:uppercase;">Example ${i + 1}</strong>
        <pre style="margin-top:8px; background:#f1f5f9; padding:8px; border-radius:4px; font-size:13px; white-space:pre-wrap;">Input: ${ex.input}\n\nOutput: ${ex.expected_output}</pre>
      </div>
    `;
  });
}

async function loadMySubmissions(problemId) {
  try {
    const data = await submissions.getMySubmissions();
    currentSubmissions = data.filter(s => String(s.problem_id) === String(problemId));

    const container = document.getElementById('submissions-list');
    if (currentSubmissions.length === 0) {
      container.innerHTML = '<p class="empty-state">No submissions yet.</p>';
      return;
    }

    let html = '';
    currentSubmissions.forEach((s) => {
      const dateStr = new Date(s.submitted_at).toLocaleString();
      // Added onclick and title for better UX
      html += `
        <div class="submission-item" 
             onclick="showSubmissionCode('${s.id}')" 
             title="Click to view code"
             style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f1f5f9; font-size:14px;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span class="status-badge-${s.status.toLowerCase()}" style="font-weight:600;">${s.status.replace(/_/g, ' ').toUpperCase()}</span>
            <span style="color:#64748b; font-size:12px;">Runtime: ${s.execution_time || 'N/A'}s</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; text-align:right;">
            <span style="color:#64748b; text-transform:capitalize; font-weight:500;">${s.language}</span>
            <span style="color:#94a3b8; font-size:12px;">${dateStr}</span>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.log(err);
  }
}

// FIX 2: Bullet-proof RUN Code execution
async function runCode() {
  const language = document.getElementById('language-select').value;
  const code = editor.getValue();
  const resultContent = document.getElementById('result-content');

  if (!code.trim()) {
    resultContent.innerHTML = 'Write code first.';
    return;
  }

  // Switch to output tab automatically
  switchConsoleTab('output');
  resultContent.innerHTML = 'Running...';
  switchConsoleTab('output');

  try {
    let resultsHTML = '';
    
    // Check for custom input first
    const customInputArea = document.getElementById('custom-input-area');
    const customInput = customInputArea ? customInputArea.value.trim() : '';

    if (customInput) {
      const data = await submissions.run(language, code, customInput);
      
      let isTLE = false;
      let errData = data.stderr || data.compile_output || '';
      
      // Catch infinite loops in Python which hit file size limits
      if (errData && errData.includes('File too large')) {
         data.status = 'Time Limit Exceeded';
         errData = 'Your code produced too much output. This is likely due to an infinite loop causing a Time/Output Limit Exceeded.';
         isTLE = true;
      }

      if (data.error && !isTLE) {
         resultsHTML = `
          <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #fca5a5; border-radius: 8px; background: #fee2e2;">
            <strong>Custom Input:</strong> ❌ Server Error<br/>
            <span style="color: #b91c1c;">${data.error}</span>
          </div>`;
      } else if (errData && !isTLE) {
        resultsHTML = `
          <div style="margin-bottom: 16px;">
            <strong style="color:#ef4444;">Custom Input: ❌ Error</strong><br/>
            <pre style="background:#fee2e2; color:#dc2626; padding:8px; border-radius:4px; margin-top:4px; white-space:pre-wrap;">${errData}</pre>
          </div>
        `;
      } else if ((data.status && data.status !== 'Accepted') || isTLE) {
        resultsHTML = `
          <div style="margin-bottom: 16px;">
            <strong style="color:#ef4444;">Custom Input: ❌ ${data.status}</strong><br/>
            <pre style="background:#fee2e2; color:#dc2626; padding:8px; border-radius:4px; margin-top:4px; white-space:pre-wrap;">${isTLE ? errData : `Execution Time: ${data.time || 'N/A'}s`}</pre>
          </div>
        `;
      } else {
        const actual = String(data.stdout || '').trim();
        resultsHTML = `
          <div style="margin-bottom: 16px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <strong style="color: #3b82f6; font-size: 15px;">Custom Input Result</strong>
            <div style="margin-top: 8px; font-size: 13px;">
              <strong style="color:#64748b;">Input:</strong> <span style="font-family: monospace; white-space:pre-wrap;">${customInput}</span><br/>
              <strong style="color:#64748b;">Output:</strong> <span style="font-family: monospace; white-space:pre-wrap;">${actual}</span>
            </div>
          </div>
        `;
      }
      resultContent.innerHTML = resultsHTML;
      return;
    }

    if (currentExamples.length === 0) {
      resultContent.innerHTML = 'No example test cases available to run.';
      return;
    }

    for (let i = 0; i < currentExamples.length; i++) {
      const ex = currentExamples[i];
      const data = await submissions.run(language, code, ex.input);

      // Catch API/Server Errors directly
      if (data.error) {
         resultsHTML += `
          <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #fca5a5; border-radius: 8px; background: #fee2e2;">
            <strong>Case ${i + 1}:</strong> ❌ Server Error<br/>
            <span style="color: #b91c1c;">${data.error}</span>
          </div>`;
         continue;
      }

      let isTLE = false;
      let errData = data.stderr || data.compile_output || '';
      
      // Catch infinite loops in Python which hit file size limits
      if (errData && errData.includes('File too large')) {
         data.status = 'Time Limit Exceeded';
         errData = 'Your code produced too much output. This is likely due to an infinite loop causing a Time/Output Limit Exceeded.';
         isTLE = true;
      }

      // Catch Code Execution Syntax/Compilation Errors
      if (errData && !isTLE) {
        resultsHTML += `
          <div style="margin-bottom: 16px;">
            <strong style="color:#ef4444;">Case ${i + 1}: ❌ Error</strong><br/>
            <pre style="background:#fee2e2; color:#dc2626; padding:8px; border-radius:4px; margin-top:4px;">${errData}</pre>
          </div>
        `;
        break; // Stop execution on syntax error
      }

      if ((data.status && data.status !== 'Accepted') || isTLE) {
        resultsHTML += `
          <div style="margin-bottom: 16px; padding: 12px; border: 1px solid #fca5a5; border-radius: 8px; background: #fee2e2;">
            <strong style="color:#b91c1c; font-size: 15px;">Case ${i + 1}: ❌ ${data.status}</strong><br/>
            <div style="margin-top: 8px; font-size: 13px; color: #7f1d1d;">
              ${isTLE ? `<strong>Reason:</strong> ${errData}` : `<strong>Execution Time:</strong> ${data.time || 'N/A'}s`}
            </div>
          </div>
        `;
        break; // Stop execution on TLE or other errors
      }

      // Safely cast to string to avoid `.trim()` TypeError on numbers/null
      const actual = String(data.stdout || '').trim();
      const expected = String(ex.expected_output || '').trim();
      const passed = actual === expected;
      const errorOutput = data.stderr || data.compile_output || '';

      resultsHTML += `
        <div style="margin-bottom: 16px; padding: 12px; background: ${passed ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${passed ? '#bbf7d0' : '#fecaca'}; border-radius: 8px;">
          <strong style="color: ${passed ? '#15803d' : '#b91c1c'}; font-size: 15px;">Case ${i + 1}: ${passed ? '✅ Passed' : '❌ Failed'}</strong>
          <div style="margin-top: 8px; font-size: 13px;">
            <strong style="color:#64748b;">Input:</strong> <span style="font-family: monospace;">${String(ex.input).replace(/\n/g, ' ')}</span><br/>
            <strong style="color:#64748b;">Expected:</strong> <span style="font-family: monospace;">${expected}</span><br/>
            <strong style="color:#64748b;">Output:</strong> <span style="font-family: monospace;">${actual}</span>
          </div>
        </div>
      `;
    }

    resultContent.innerHTML = resultsHTML;

  } catch (err) {
    resultContent.innerHTML = 'Error running code: ' + err.message;
  }
}

async function submitCode() {
  const language = document.getElementById('language-select').value;
  const code = editor.getValue();

  const resultContent = document.getElementById('result-content');

  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  resultContent.innerHTML = 'Submitting...';
  switchConsoleTab('output');

  try {
    const data = await submissions.submit(currentProblemId, language, code);
    let statusText = data.status.replace(/_/g, ' ').toUpperCase();
    let errorDetails = data.error || '';

    // Catch the python specific infinite loop output error
    if (errorDetails.includes('File too large')) {
      data.status = 'time_limit_exceeded';
      statusColor = '#ef4444';
      statusText = 'TIME LIMIT EXCEEDED';
      errorDetails = 'Your code produced too much output. This is likely due to an infinite loop causing a Time/Output Limit Exceeded.';
      showToast('Time Limit Exceeded', 'error');
    } else {
      if (data.status === 'accepted') {
        showToast('Accepted!', 'success');
      } else {
        showToast(statusText || 'Wrong Answer', 'error');
      }
    }
    
    let html = `
      <div style="font-size:20px; font-weight:800; color:${statusColor}; margin-bottom:16px;">
        ${statusText}
      </div>
      
      <div style="display:flex; gap:12px; margin-bottom:20px;">
        <div style="background:#f1f5f9; padding:8px 16px; border-radius:8px; border:1px solid #e2e8f0; font-size:14px; color:#475569;">
          <strong>Runtime:</strong> <span style="color:#1e293b; font-weight:600;">${data.execution_time || 'N/A'}s</span>
        </div>
        <div style="background:#f1f5f9; padding:8px 16px; border-radius:8px; border:1px solid #e2e8f0; font-size:14px; color:#475569;">
          <strong>Language:</strong> <span style="color:#1e293b; font-weight:600; text-transform:capitalize;">${language}</span>
        </div>
      </div>
    `;

    if (errorDetails) {
      html += `
        <div style="margin-top:16px;">
          <h4 style="margin-bottom:8px; color:#ef4444; font-size:14px; text-transform:uppercase;">Error Details</h4>
          <pre style="background:#fee2e2; color:#dc2626; padding:12px; border-radius:8px; border:1px solid #fca5a5; font-size:13px; white-space:pre-wrap; font-family:'JetBrains Mono', 'Fira Code', monospace;">${errorDetails}</pre>
        </div>
      `;
    }

    resultContent.innerHTML = html;
    loadMySubmissions(currentProblemId);
  } catch {
    showToast('Submission failed', 'error');
  }
}

function resetCode() {
  const lang = document.getElementById('language-select').value;
  editor.setValue(defaultCode[lang]);
}

// SUBMISSION MODAL LOGIC
function showSubmissionCode(submissionId) {
  const submission = currentSubmissions.find(s => String(s.id) === String(submissionId));
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
  document.body.style.overflow = 'hidden'; // Prevent background scroll
}

function closeSubmissionModal() {
  const modal = document.getElementById('submission-modal');
  modal.style.display = 'none';
  document.body.style.overflow = 'auto'; // Restore scroll
  currentViewingSubmission = null;
}

function restoreToEditor() {
  if (!currentViewingSubmission || !editor) return;

  const { code, language } = currentViewingSubmission;
  
  // 1. Update the language select
  const langSelect = document.getElementById('language-select');
  if (langSelect) {
    langSelect.value = language;
    // Trigger Monaco language update
    monaco.editor.setModelLanguage(editor.getModel(), language);
  }

  // 2. Set the code in editor
  editor.setValue(code);

  // 3. Notify user and close modal
  showToast('Code restored to editor!', 'success');
  closeSubmissionModal();
}

// Close modal on click outside content
window.addEventListener('click', function(event) {
  const modal = document.getElementById('submission-modal');
  if (event.target === modal) {
    closeSubmissionModal();
  }
});