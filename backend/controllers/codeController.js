const axios = require("axios");
const pool  = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// Judge0 language IDs — add more if needed
const LANGUAGE_IDS = {
  python:     71,
  cpp:        54,
  c:          48,
  java:       62,
  javascript: 63,
};

// ── Core function: send code to Judge0 Docker ─────────────────────────────────
async function runOnJudge0(language, code, input) {
  const langId = LANGUAGE_IDS[language.toLowerCase()];
  if (!langId) throw new Error(`Language "${language}" not supported`);

  const response = await axios.post(
    `${process.env.JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
    {
      source_code: code,
      language_id: langId,
      stdin:       input || "",
    },
    { headers: { "Content-Type": "application/json" } }
  );

  const data = response.data;

  const statusMap = {
    3:  "Accepted",
    4:  "Wrong Answer",
    5:  "Time Limit Exceeded",
    6:  "Compilation Error",
    11: "Runtime Error",
    12: "Runtime Error",
    13: "Runtime Error",
  };

  return {
    output:  data.stdout || "",
    status:  statusMap[data.status?.id] || "Error",
    time_ms: data.time ? Math.round(parseFloat(data.time) * 1000) : null,
    error:   data.stderr || data.compile_output || null,
  };
}

// ── POST /api/code/run ────────────────────────────────────────────────────────
// "Run" button — test against sample inputs only, NOT saved to DB
exports.runCode = async (req, res) => {
  try {
    const { code, language, input } = req.body;

    if (!code || !language) {
      return res.status(400).json({ message: "code and language are required" });
    }

    const result = await runOnJudge0(language, code, input);
    res.json(result);

  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({ message: "Judge0 Docker is not running. Start it with: docker-compose up -d" });
    }
    console.error("runCode error:", err.message);
    res.status(500).json({ message: "Execution error: " + err.message });
  }
};

// ── POST /api/code/submit ─────────────────────────────────────────────────────
// "Submit" button — runs ALL test cases and saves result to DB
exports.submitCode = async (req, res) => {
  try {
    const { user_id, problem_id, language, code } = req.body;

    if (!user_id || !problem_id || !language || !code) {
      return res.status(400).json({ message: "user_id, problem_id, language, code are required" });
    }

    // Get all test cases for this problem from DB
    const problemRes = await pool.query(
      "SELECT test_cases FROM problems WHERE id = $1",
      [problem_id]
    );

    if (!problemRes.rows.length) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const testCases = problemRes.rows[0].test_cases || [];

    if (!testCases.length) {
      return res.status(400).json({ message: "No test cases found for this problem" });
    }

    // Run code against every test case
    let allPassed   = true;
    let totalTime   = 0;
    let errorMsg    = null;
    const results   = [];

    for (const tc of testCases) {
      const result = await runOnJudge0(language, code, tc.input);

      const actual   = result.output.trim();
      const expected = String(tc.output).trim();
      const passed   = actual === expected;

      if (!passed)          allPassed = false;
      if (result.time_ms)   totalTime += result.time_ms;
      if (result.error && !errorMsg) errorMsg = result.error;

      results.push({
        input:    tc.input,
        expected,
        actual,
        passed,
        time_ms:  result.time_ms,
      });
    }

    const finalStatus = allPassed ? "Accepted" : "Wrong Answer";
    const avgTime     = totalTime / testCases.length;

    // Save submission to PostgreSQL
    const subRes = await pool.query(
      `INSERT INTO submissions (id, user_id, problem_id, language, code, status, execution_time, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [uuidv4(), user_id, problem_id, language, code, finalStatus, avgTime]
    );

    res.status(201).json({
      submission_id:    subRes.rows[0].id,
      status:           finalStatus,
      passed_cases:     results.filter(r => r.passed).length,
      total_cases:      testCases.length,
      execution_time_ms: Math.round(avgTime),
      test_results:     results,
      error:            errorMsg,
    });

  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({ message: "Judge0 Docker is not running. Start it with: docker-compose up -d" });
    }
    console.error("submitCode error:", err.message);
    res.status(500).json({ message: "Execution error: " + err.message });
  }
};