const axios = require('axios');
require('dotenv').config();

const LANGUAGE_MAP = {
  python: 71,
  java: 62,
  c: 50,
  cpp: 54
};

exports.runCode = async (code, language, stdin) => {
  try {
    const response = await axios.post(
      `${process.env.JUDGE0_URL}/submissions?base64_encoded=true&wait=true`,
      {
        language_id: LANGUAGE_MAP[language],
        source_code: Buffer.from(code).toString('base64'),
        stdin: Buffer.from(stdin || '').toString('base64'),
        cpu_time_limit: 2,
        memory_limit: 128000
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data;

    return {
      stdout: data.stdout
        ? Buffer.from(data.stdout, 'base64').toString().trim()
        : '',
      stderr: data.stderr
        ? Buffer.from(data.stderr, 'base64').toString().trim()
        : '',
      compile_output: data.compile_output
        ? Buffer.from(data.compile_output, 'base64').toString().trim()
        : '',
      statusDescription: data.status?.description || 'Unknown',
      time: data.time,
      memory: data.memory
    };

  } catch (err) {
    console.error('Judge0 error:', err.message);
    return {
      stdout: '',
      stderr: err.message,
      compile_output: '',
      statusDescription: 'Error',
      time: 0,
      memory: 0
    };
  }
};