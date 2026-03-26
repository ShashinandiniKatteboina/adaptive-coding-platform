const API_URL = 'https://adaptive-coding-platform.onrender.com/api';

// save token to localStorage
function saveToken(token) {
  localStorage.setItem('token', token);
}

// get token from localStorage
function getToken() {
  return localStorage.getItem('token');
}

// remove token (logout)
function removeToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// save user info
function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// get user info
function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

// check if logged in
function isLoggedIn() {
  return getToken() !== null;
}

// redirect to login if not logged in
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
  }
}

// AUTH API calls
const auth = {
  register: async (name, email, password) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    return res.json();
  },

  login: async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  }
};

// PROBLEMS API calls
const problems = {
  getAll: async (topic = '', difficulty = '') => {
    let url = `${API_URL}/problems?`;
    if (topic) url += `topic=${topic}&`;
    if (difficulty) url += `difficulty=${difficulty}`;
    const res = await fetch(url);
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_URL}/problems/${id}`);
    return res.json();
  }
};

// SUBMISSIONS API calls
const submissions = {
   run: async (language, code, input) => {
    const res = await fetch(`${API_URL}/submissions/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, code, input })
    });
    return res.json();
   },
  submit: async (problem_id, language, code) => {
    const res = await fetch(`${API_URL}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ problem_id, language, code })
    });
    return res.json();
  },

  getMySubmissions: async () => {
    const res = await fetch(`${API_URL}/submissions`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return res.json();
  }
};

// PROGRESS API calls
const progress = {
  getProgress: async () => {
    const res = await fetch(`${API_URL}/progress`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return res.json();
  },

  getRecommendations: async () => {
    const res = await fetch(`${API_URL}/progress/recommendations`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return res.json();
  }
};
