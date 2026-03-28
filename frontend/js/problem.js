// Shared navbar is handled by api.js renderNavbar

let editor;
let currentProblemId;
let currentExamples = [];
let currentProblemLabels = []; 
let currentSubmissions =[]; 

const defaultCode = {
  python: '# Write your solution here\n\n',
  java: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n', // Changed Solution to Main for Judge0 compatibility
  javascript: '// Write your solution here\n\n',
  cpp: '#include<iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n'
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
  
  event.target.classList.add('active');
  document.getElementById(`console-${tab}`).classList.add('active');
}

function toggleConsole() {
  const consoleEl = document.querySelector('.fixed-console');
  if (consoleEl.style.display === 'none') {
    consoleEl.style.display = 'flex';
  } else {
    consoleEl.style.display = 'none';
  }
  // Let layout adjust for editor resize
  setTimeout(() => { if (editor) editor.layout(); }, 50);
}

function showToast(message, type='success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.style.background = type === 'success' ? '#dcfce7' : '#fee2e2';
  toast.style.color = type === 'success' ? '#15803d' : '#b91c1c';
  toast.style.border = type === 'success' ? '1px solid #86efac' : '1px solid #fca5a5';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
  toast.style.marginBottom = '10px';
  toast.style.fontWeight = '600';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s, transform 0.3s';
  toast.style.transform = 'translateY(-10px)';
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

// initialize Monaco Editor
require.config({
  paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }
});

require(['vs/editor/editor.main'], function () {
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: defaultCode.python,
    language: 'python',
    theme: 'vs', // Light theme for editor
    fontSize: 14,
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    roundedSelection: true,
    padding: { top: 12 }
  });

  loadProblem();
});

function changeLanguage() {
  const lang = document.getElementById('language-select').value;
  const monacoLang = lang === 'cpp' ? 'cpp' : lang === 'java' ? 'java' : lang === 'javascript' ? 'javascript' : lang;
  monaco.editor.setModelLanguage(editor.getModel(), monacoLang);
  editor.setValue(defaultCode[lang]);
}

async function loadProblem() {
  const id = getProblemId();
  if (!id) {
    window.location.href = 'problems.html';
    return;
  }

  currentProblemId = id;

  try {
    const problem = await problems.getById(id);
    if (!problem) {
      document.getElementById('problem-loading').textContent = 'Problem not found.';
      return;
    }

    document.title = `Random — ${problem.title}`;
    document.getElementById('problem-title').textContent = problem.title;
    document.getElementById('problem-description').textContent = problem.description;

    const diffBadge = document.getElementById('problem-difficulty');
    diffBadge.textContent = problem.difficulty;
    diffBadge.className = `badge badge-${problem.difficulty.toLowerCase()}`;

    document.getElementById('problem-topic').textContent = problem.topic;

    currentExamples = Array.isArray(problem.examples) ? problem.examples : [];
    currentProblemLabels = problem.input_labels ? problem.input_labels.split(',').map(l => l.trim()) : [];

    const examplesDiv = document.getElementById('problem-examples');
    examplesDiv.innerHTML = '';
    if (currentExamples.length > 0) {
      currentExamples.forEach((ex, i) => {
        examplesDiv.innerHTML += `
          <div class="example-box" style="margin-bottom:12px; padding:14px; background:#f8fafc; border-radius:8px; border-left:3px solid #6366f1;">
            <strong style="color:#64748b; font-size:12px; text-transform:uppercase;">Example ${i + 1}</strong>
            <pre style="margin-top:8px; background:#f1f5f9; padding:8px; border-radius:4px; font-size:13px;">Input: ${ex.input}\nOutput: ${ex.expected_output}</pre>
          </div>
        `;
      });
    }

    document.getElementById('problem-loading').style.display = 'none';
    document.getElementById('problem-content').style.display = 'block';

    loadMySubmissions(id);
    updateConsoleTestCases();

  } catch (err) {
    document.getElementById('problem-loading').textContent = 'Failed to load problem.';
  }
}

function updateConsoleTestCases() {
  const container = document.getElementById('testcases-content');
  if (currentExamples.length > 0) {
    container.innerHTML = `<pre class="console-text">Input: ${currentExamples[0].input}\nExpected: ${currentExamples[0].expected_output}</pre>`;
  }
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
      html += `
        <div class="submission-item" style="display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid #f1f5f9; font-size:14px;">
          <span class="status-badge-${s.status.toLowerCase()}">${s.status}</span>
          <span style="color:#64748b;">${s.language}</span>
          <span style="color:#94a3b8; font-size:12px;">${dateStr}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.log('Could not load submissions');
  }
}

async function runCode() {
  const language = document.getElementById('language-select').value;
  const code = editor.getValue();
  const resultContent = document.getElementById('result-content');

  if (!code.trim()) {
    resultContent.innerHTML = 'Please write some code first.';
    return;
  }

  resultContent.innerHTML = 'Running...';
  switchConsoleTab('output');

  try {
    const ex = currentExamples[0] || { input: '' };
    const data = await submissions.run(language, code, ex.input);
    
    if (data.stderr || data.compile_output) {
      resultContent.innerHTML = `<span style="color:#ef4444;">${data.stderr || data.compile_output}</span>`;
    } else {
      const passed = data.stdout?.trim() === ex.expected_output?.trim();
      resultContent.innerHTML = `
        <div style="color:${passed ? '#22c55e' : '#ef4444'}; font-weight:700; margin-bottom:8px;">
          ${passed ? 'Passed' : 'Failed'}
        </div>
        <div>Your Output:</div>
        <pre>${data.stdout || 'No output'}</pre>
        ${!passed ? `<div>Expected:</div><pre>${ex.expected_output}</pre>` : ''}
      `;
    }
  } catch (err) {
    resultContent.innerHTML = 'Run failed. Check backend.';
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
    
    if (data.status === 'accepted') {
      showToast('Accepted!', 'success');
    } else {
      showToast('Wrong Answer', 'error');
    }

    const statusColor = data.status === 'accepted' ? '#22c55e' : '#ef4444';
    const statusText = data.status.replace(/_/g, ' ').toUpperCase();
    
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

    if (data.error) {
      html += `
        <div style="margin-top:16px;">
          <h4 style="margin-bottom:8px; color:#ef4444; font-size:14px; text-transform:uppercase;">Error Details</h4>
          <pre style="background:#fee2e2; color:#dc2626; padding:12px; border-radius:8px; border:1px solid #fca5a5; font-size:13px; white-space:pre-wrap; font-family:'JetBrains Mono', 'Fira Code', monospace;">${data.error}</pre>
        </div>
      `;
    }

    resultContent.innerHTML = html;
    
    loadMySubmissions(currentProblemId);
  } catch (err) {
    resultContent.innerHTML = 'Submission failed.';
  }
}

function resetCode() {
  const lang = document.getElementById('language-select').value;
  editor.setValue(defaultCode[lang]);
}