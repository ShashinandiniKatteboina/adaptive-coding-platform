// Shared navbar is handled by api.js renderNavbar

let editor;
let currentProblemId;
let currentExamples = [];
let currentProblemLabels =[];
let currentSubmissions =[];

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
  const consoleEl = document.querySelector('.fixed-console');
  consoleEl.style.display = consoleEl.style.display === 'none' ? 'flex' : 'none';
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
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
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

    // Populate problem details
    document.getElementById('problem-title').textContent = problem.title;
    document.getElementById('problem-description').textContent = problem.description;

    // FIX 1: Show the content and hide loading!
    document.getElementById('problem-loading').style.display = 'none';
    document.getElementById('problem-content').style.display = 'block';

    // Populate the topic and difficulty badges
    const difficultyBadge = document.getElementById('problem-difficulty');
    if (difficultyBadge) {
      difficultyBadge.textContent = problem.difficulty;
      difficultyBadge.className = `badge badge-${(problem.difficulty || '').toLowerCase()}`;
    }
    const topicBadge = document.getElementById('problem-topic');
    if (topicBadge) {
      topicBadge.textContent = problem.topic;
    }

    // Safety check: filter out empty DB joins where examples = [null]
    currentExamples = Array.isArray(problem.examples) 
      ? problem.examples.filter(ex => ex && ex.input != null) 
      :[];
      
    currentProblemLabels = problem.input_labels
      ? problem.input_labels.split(',').map(l => l.trim())
      :[];

    renderExamples();
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
      <div class="example-box" style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
        <strong style="color: #1e293b; display: block; margin-bottom: 8px;">Example ${i + 1}</strong>
        <pre style="font-family: monospace; font-size: 13px; color: #475569; white-space: pre-wrap; margin:0;">Input: ${ex.input}\nOutput: ${ex.expected_output}</pre>
      </div>
    `;
  });
}

async function loadMySubmissions(problemId) {
  try {
    const data = await submissions.getMySubmissions();
    currentSubmissions = data.filter(s => String(s.problem_id) === String(problemId));

    const container = document.getElementById('submissions-list');
    container.innerHTML = currentSubmissions.length === 0
      ? '<p class="empty-state">No submissions yet.</p>'
      : currentSubmissions.map(s => `
          <div style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
            <span style="font-weight:bold; color: ${s.status === 'accepted' ? '#16a34a' : '#dc2626'}">${s.status.toUpperCase()}</span> | ${s.language}
          </div>
        `).join('');
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

  try {
    let resultsHTML = '';

    if (currentExamples.length === 0) {
      resultContent.innerHTML = 'No example test cases available to run.';
      return;
    }

    for (let i = 0; i < currentExamples.length; i++) {
      const ex = currentExamples[i];

      const data = await submissions.run(language, code, ex.input);

      if (data.error) {
         resultsHTML += `
          <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #fca5a5; border-radius: 8px; background: #fee2e2;">
            <strong>Case ${i + 1}:</strong> ❌ Server Error<br/>
            <span style="color: #b91c1c;">${data.error}</span>
          </div>`;
         continue;
      }

      // Safely cast to string to avoid `.trim()` TypeError on numbers/null
      const actual = String(data.stdout || '').trim();
      const expected = String(ex.expected_output || '').trim();
      const passed = actual === expected;
      const errorOutput = data.stderr || data.compile_output || '';

      resultsHTML += `
        <div style="margin-bottom: 12px; padding: 12px; border: 1px solid ${passed ? '#86efac' : '#fca5a5'}; border-radius: 8px; background: ${passed ? '#dcfce7' : '#fee2e2'};">
          <strong>Case ${i + 1}:</strong> ${passed ? '✅ Passed' : '❌ Failed'}<br/>
          <div style="margin-top: 8px; font-family: monospace; font-size: 13px; color: #1e293b;">
            <strong>Input:</strong> ${ex.input}<br/>
            <strong>Expected:</strong> ${expected}<br/>
            <strong>Output:</strong> ${actual || errorOutput}
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

  try {
    const data = await submissions.submit(currentProblemId, language, code);
    showToast(data.status === 'accepted' ? 'Accepted' : 'Wrong Answer', data.status === 'accepted' ? 'success' : 'error');
    loadMySubmissions(currentProblemId);
  } catch {
    showToast('Submission failed', 'error');
  }
}

function resetCode() {
  const lang = document.getElementById('language-select').value;
  editor.setValue(defaultCode[lang]);
}