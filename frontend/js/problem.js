requireAuth();
let editor;
let currentProblemId;
let currentExamples = [];
let currentSubmissions =[]; // Add this new variable to store past submissions

const defaultCode = {
  python: '# Write your solution here\n\n',
  java: 'import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n',
  cpp: '#include<iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  c: '#include<stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n'
};

function logout() {
  removeToken();
  window.location.href = 'index.html';
}

function getProblemId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// tab switching
function showTab(tab) {
  document.getElementById('panel-result').style.display = tab === 'result' ? 'block' : 'none';
  document.getElementById('panel-testcases').style.display = tab === 'testcases' ? 'block' : 'none';
  document.getElementById('tab-result').style.color = tab === 'result' ? '#6366f1' : '#a0a0b0';
  document.getElementById('tab-result').style.borderBottom = tab === 'result' ? '2px solid #6366f1' : 'none';
  document.getElementById('tab-testcases').style.color = tab === 'testcases' ? '#6366f1' : '#a0a0b0';
  document.getElementById('tab-testcases').style.borderBottom = tab === 'testcases' ? '2px solid #6366f1' : 'none';
}

// initialize Monaco Editor
require.config({
  paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }
});

require(['vs/editor/editor.main'], function () {
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: defaultCode.python,
    language: 'python',
    theme: 'vs-dark',
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

document.getElementById('language-select').addEventListener('change', function () {
  const lang = this.value;
  const monacoLang = lang === 'cpp' ? 'cpp' : lang === 'c' ? 'c' : lang;
  monaco.editor.setModelLanguage(editor.getModel(), monacoLang);
  editor.setValue(defaultCode[lang]);
});

async function loadProblem() {
  const id = getProblemId();
  if (!id) {
    window.location.href = 'problems.html';
    return;
  }

  currentProblemId = id;

  try {
    const problem = await problems.getById(id);

    document.title = `DSA Platform — ${problem.title}`;
    document.getElementById('problem-title').textContent = problem.title;
    document.getElementById('problem-description').textContent = problem.description;

    const diffBadge = document.getElementById('problem-difficulty');
    diffBadge.textContent = problem.difficulty;
    diffBadge.className = `badge badge-${problem.difficulty}`;

    document.getElementById('problem-topic').textContent = problem.topic;

    // store examples for run button
    currentExamples = problem.examples || [];

    // show examples
    const examplesDiv = document.getElementById('problem-examples');
    if (currentExamples.length > 0) {
      currentExamples.forEach((ex, i) => {
        examplesDiv.innerHTML += `
          <div class="example-box" style="margin-bottom:10px;">
            <strong style="color:#a0a0b0;">Example ${i + 1}</strong><br><br>
            <strong style="color:#6366f1;">Input:</strong>
            <span style="font-family:monospace;">${ex.input.replace(/\\n/g, ' | ')}</span><br>
            <strong style="color:#22c55e;">Expected Output:</strong>
            <span style="font-family:monospace;">${ex.expected_output}</span>
          </div>
        `;
      });
    }

    document.getElementById('problem-loading').style.display = 'none';
    document.getElementById('problem-content').style.display = 'block';

    loadMySubmissions(id);

  } catch (err) {
    document.getElementById('problem-loading').textContent = 'Failed to load problem.';
  }
}

async function loadMySubmissions(problemId) {
  try {
    const data = await submissions.getMySubmissions();
    // Save to our global variable so we can access the code when clicked
    currentSubmissions = data.filter(s => String(s.problem_id) === String(problemId));

    const container = document.getElementById('submissions-list');
    if (currentSubmissions.length === 0) {
      container.innerHTML = '<p style="color:#555; font-size:14px;">No submissions yet.</p>';
      return;
    }

    let html = '';
    currentSubmissions.slice(0, 5).forEach((s, index) => {
      // Changed to toLocaleString() to show both Date AND Time
      const dateAndTime = new Date(s.submitted_at).toLocaleString(); 
      
      // Added cursor:pointer, hover effects, and onclick="viewPastSubmission(index)"
      html += `
        <div onclick="viewPastSubmission(${index})" 
             style="display:flex; justify-content:space-between; align-items:center;
             padding:8px 12px; background:#0f0f23; border-radius:8px; margin-bottom:8px; 
             cursor:pointer; border: 1px solid transparent; transition: border 0.2s;"
             onmouseover="this.style.border='1px solid #6366f1'" 
             onmouseout="this.style.border='1px solid transparent'">
          <span class="badge badge-${s.status}">${s.status}</span>
          <span style="color:#a0a0b0; font-size:13px;">${s.language}</span>
          <span style="color:#555; font-size:12px;">${dateAndTime}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.log('Could not load submissions');
  }
}
// RUN against visible example test cases only
async function runCode() {
  const language = document.getElementById('language-select').value;
  const code = editor.getValue();
  const resultContent = document.getElementById('result-content');

  if (!code.trim()) {
    resultContent.innerHTML = '<span style="color:#f87171;">Please write some code first.</span>';
    return;
  }

  if (currentExamples.length === 0) {
    resultContent.innerHTML = '<span style="color:#a0a0b0;">No example test cases available.</span>';
    return;
  }

  resultContent.innerHTML = '<span style="color:#fbbf24;">Running against example test cases...</span>';
  showTab('result');

  try {
    let allPassed = true;
    let resultsHTML = '';

    for (let i = 0; i < currentExamples.length; i++) {
      const ex = currentExamples[i];

      const res = await fetch('https://adaptive-coding-platform.onrender.com/api/submissions/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ language, code, input: ex.input })
      });

      const data = await res.json();
      const actualOutput = data.stdout ? data.stdout.trim() : '';
      const expectedOutput = ex.expected_output.trim();
      const passed = actualOutput === expectedOutput;
      if (!passed) allPassed = false;

      resultsHTML += `
        <div style="margin-bottom:12px; padding:12px; background:#0f0f23;
          border-radius:8px; border-left:3px solid ${passed ? '#22c55e' : '#ef4444'};">
          <div style="margin-bottom:8px;">
            <span style="color:#a0a0b0; font-size:12px; text-transform:uppercase;">Case ${i + 1}</span>
            <span style="float:right; color:${passed ? '#4ade80' : '#f87171'};
              font-size:13px; font-weight:bold;">
              ${passed ? 'Passed' : 'Failed'}
            </span>
          </div>
          <div style="font-family:monospace; font-size:13px; margin-bottom:4px;">
            <span style="color:#6366f1;">Input: </span>
            <span style="color:#e0e0e0;">${ex.input.replace(/\\n/g, ' | ')}</span>
          </div>
          <div style="font-family:monospace; font-size:13px; margin-bottom:4px;">
            <span style="color:#22c55e;">Expected: </span>
            <span style="color:#e0e0e0;">${expectedOutput}</span>
          </div>
          <div style="font-family:monospace; font-size:13px;">
            <span style="color:#fbbf24;">Your output: </span>
            <span style="color:#e0e0e0;">${actualOutput || (data.stderr ? data.stderr : 'No output')}</span>
          </div>
        </div>
      `;
    }

    resultContent.innerHTML = `
      <div style="margin-bottom:14px; padding:10px 14px; border-radius:8px;
        background:${allPassed ? '#052e16' : '#3b0000'};
        color:${allPassed ? '#4ade80' : '#f87171'};
        font-size:16px; font-weight:bold;">
        ${allPassed ? 'All example cases passed! Now click Submit.' : 'Some cases failed. Fix your code.'}
      </div>
      ${resultsHTML}
    `;

  } catch (err) {
    resultContent.innerHTML = '<span style="color:#f87171;">Run failed. Make sure backend is running.</span>';
  }
}

// SUBMIT against all hidden test cases
async function submitCode() {
  const language = document.getElementById('language-select').value;
  const code = editor.getValue();
  const resultContent = document.getElementById('result-content');

  if (!code.trim()) {
    resultContent.innerHTML = '<span style="color:#f87171;">Please write some code first.</span>';
    return;
  }

  resultContent.innerHTML = '<span style="color:#fbbf24;">Submitting... running against all test cases...</span>';
  showTab('result');

  try {
    const data = await submissions.submit(currentProblemId, language, code);

    if (data.status === 'accepted') {
      resultContent.innerHTML = `
        <div style="color:#4ade80; font-size:20px; font-weight:bold; margin-bottom:8px;">
          Accepted
        </div>
        <div style="color:#a0a0b0; font-size:14px;">
          All test cases passed! Execution time: ${data.execution_time}s
        </div>
      `;
    } else if (data.status === 'wrong_answer') {
      resultContent.innerHTML = `
        <div style="color:#f87171; font-size:20px; font-weight:bold; margin-bottom:8px;">
          Wrong Answer
        </div>
        <div style="color:#a0a0b0; font-size:14px;">
          Your output did not match the expected output. Check your logic and use Run to debug.
        </div>
      `;
    } else if (data.status === 'error') {
      resultContent.innerHTML = `
        <div style="color:#c084fc; font-size:20px; font-weight:bold; margin-bottom:8px;">
          Error
        </div>
        <div style="color:#a0a0b0; font-size:14px; font-family:monospace;">
          ${data.error || 'Runtime error in your code.'}
        </div>
      `;
    }

    loadMySubmissions(currentProblemId);

  } catch (err) {
    resultContent.innerHTML = '<span style="color:#f87171;">Submission failed. Make sure backend is running.</span>';
  }
}

function resetCode() {
  const lang = document.getElementById('language-select').value;
  editor.setValue(defaultCode[lang]);
}
// Function to load a past submission back into the Monaco Editor
function viewPastSubmission(index) {
  const submission = currentSubmissions[index];
  
  if (!submission || !submission.code) return;

  // 1. Change the dropdown menu to match the language they submitted in
  const langSelect = document.getElementById('language-select');
  langSelect.value = submission.language;

  // 2. Tell Monaco Editor to switch its syntax highlighting to that language
  const monacoLang = submission.language === 'cpp' ? 'cpp' : submission.language === 'c' ? 'c' : submission.language;
  monaco.editor.setModelLanguage(editor.getModel(), monacoLang);

  // 3. Paste their old code into the editor
  editor.setValue(submission.code);

  // 4. Show a friendly message in the result box
  const resultContent = document.getElementById('result-content');
  resultContent.innerHTML = `<span style="color:#6366f1;">Loaded past ${submission.status} submission from ${new Date(submission.submitted_at).toLocaleString()}</span>`;
  showTab('result');
}