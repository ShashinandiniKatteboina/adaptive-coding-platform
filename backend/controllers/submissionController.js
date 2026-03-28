const pool = require('../config/db');
const { runCode: executeCode } = require('../services/judge0');

exports.runCode = async (req, res) => {
  const { language, code, input } = req.body;

  try {
    // FIX: Safely cast code and input to Strings so Buffer.from() in judge0.js never crashes
    const safeCode = String(code || '');
    const safeInput = String(input || '');

    const result = await executeCode(safeCode, language, safeInput);
    
    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      compile_output: result.compile_output,
      status: result.statusDescription,
      time: result.time
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Run failed', error: err.message });
  }
};

exports.submitCode = async (req, res) => {
  const { problem_id, language, code } = req.body;
  const user_id = req.user.id;

  try {
    const testCases = await pool.query(
      'SELECT * FROM test_cases WHERE problem_id = $1',[problem_id]
    );

    if (testCases.rows.length === 0) {
      return res.status(404).json({ message: 'No test cases found for this problem' });
    }

    let allPassed = true;
    let finalStatus = 'accepted';
    let totalTime = 0;
    let errorDetail = '';

    // FIX: Cast code to string once
    const safeCode = String(code || '');

    for (const tc of testCases.rows) {
      // FIX: Cast DB input to string so it never passes an Integer to Judge0
      const safeInput = String(tc.input || '');
      
      const result = await executeCode(safeCode, language, safeInput);

      if (result.stderr || result.compile_output) {
        allPassed = false;
        finalStatus = 'error';
        errorDetail = result.stderr || result.compile_output;
        break;
      }

      // Safely compare outputs by converting both to strings
      const expectedOut = String(tc.expected_output || '').trim();
      const actualOut = String(result.stdout || '').trim();

      if (actualOut !== expectedOut) {
        allPassed = false;
        finalStatus = 'wrong_answer';
        break;
      }

      if (result.time) totalTime += parseFloat(result.time);
    }

    const submission = await pool.query(
      `INSERT INTO submissions
       (user_id, problem_id, language, code, status, execution_time)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,[user_id, problem_id, language, code, finalStatus, totalTime]
    );

    if (allPassed) {
      // Logic: Only increment solved count if NOT already solved
      const alreadySolved = await pool.query(
        'SELECT id FROM submissions WHERE user_id = $1 AND problem_id = $2 AND status = \'accepted\' AND id != $3 LIMIT 1',[user_id, problem_id, submission.rows[0].id]
      );

      const problem = await pool.query(
        'SELECT topic, difficulty FROM problems WHERE id = $1',
        [problem_id]
      );
      const { topic, difficulty } = problem.rows[0];
      const col = `${difficulty.toLowerCase()}_solved`;

      if (alreadySolved.rows.length === 0) {
        // First time solving! Increase the count for the specific difficulty
        await pool.query(
          `INSERT INTO user_progress (user_id, topic, ${col}, total_attempts)
           VALUES ($1, $2, 1, 1)
           ON CONFLICT (user_id, topic)
           DO UPDATE SET
             ${col} = user_progress.${col} + 1,
             total_attempts = user_progress.total_attempts + 1,
             last_active = NOW()`,[user_id, topic]
        );
      } else {
        // Already solved, just increment total attempts
        await pool.query(
          `INSERT INTO user_progress (user_id, topic, ${col}, total_attempts)
           VALUES ($1, $2, 0, 1)
           ON CONFLICT (user_id, topic)
           DO UPDATE SET
             total_attempts = user_progress.total_attempts + 1,
             last_active = NOW()`,
          [user_id, topic]
        );
      }
    }

    res.json({
      status: finalStatus,
      error: errorDetail || undefined,
      execution_time: totalTime,
      submission: submission.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Submission failed', error: err.message });
  }
};

exports.getUserSubmissions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, p.title, s.language, s.status,
       s.execution_time, s.submitted_at, s.problem_id, s.code
       FROM submissions s
       JOIN problems p ON s.problem_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.submitted_at DESC`, [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};