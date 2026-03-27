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

// render navbar based on auth status
function renderNavbar() {
  const navActions = document.getElementById('nav-actions');
  if (!navActions) return;

  const currentPath = window.location.pathname;
  const isProblems = currentPath.includes('problems.html');
  const isCourses = currentPath.includes('courses.html');
  const isWishlist = currentPath.includes('wishlist.html');

  // Inject center nav links beside the logo
  let navCenter = document.getElementById('nav-center');
  if (!navCenter) {
    navCenter = document.createElement('div');
    navCenter.id = 'nav-center';
    navCenter.className = 'nav-center';
    const logo = document.querySelector('.main-nav .logo, nav .logo');
    if (logo) logo.after(navCenter);
  }
  navCenter.innerHTML = `
    <a href="problems.html" class="nav-center-link ${isProblems ? 'active' : ''}">Problems</a>
    <a href="courses.html" class="nav-center-link ${isCourses ? 'active' : ''}">Courses</a>
    <a href="wishlist.html" class="nav-center-link ${isWishlist ? 'active' : ''}">Wishlist</a>
  `;

  if (isLoggedIn()) {
    const user = getUser();
    navActions.innerHTML = `
      <div class="user-nav-top">
        <div class="profile-icon" onclick="window.location.href='dashboard.html'" title="Profile">
          <img src="${user.profile_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name)}" alt="${user.name}">
        </div>
        <a href="#" onclick="logout()" class="logout-link">Logout</a>
      </div>
    `;
  } else {
    navActions.innerHTML = `
      <a href="index.html">Login</a>
      <a href="register.html">Sign Up</a>
    `;
  }

  // Remove old secondary nav if present
  const secondaryNav = document.getElementById('secondary-nav');
  if (secondaryNav) secondaryNav.remove();
}

function logout() {
  removeToken();
  window.location.href = 'index.html';
}

// init navbar on load
document.addEventListener('DOMContentLoaded', renderNavbar);

async function safeJson(res) {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await res.json();
  }
  return res.ok ? { success: true } : { error: `Server error: ${res.status}` };
}

// AUTH API calls
const auth = {
  register: async (name, email, password) => {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      return await safeJson(res);
    } catch (e) { return { error: "Network error" }; }
  },

  login: async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return await safeJson(res);
    } catch (e) { return { error: "Network error" }; }
  }
};

// PROBLEMS API calls
const problems = {
  getAll: async (topic = '', difficulty = '') => {
    try {
      let url = `${API_URL}/problems?`;
      if (topic) url += `topic=${topic}&`;
      if (difficulty) url += `difficulty=${difficulty}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await safeJson(res);
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  },

  getById: async (id) => {
    try {
      const res = await fetch(`${API_URL}/problems/${id}`);
      if (!res.ok) return null;
      return await safeJson(res);
    } catch (e) { return null; }
  }
};

// SUBMISSIONS API calls
const submissions = {
   run: async (language, code, input) => {
    try {
      const res = await fetch(`${API_URL}/submissions/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, input })
      });
      return await safeJson(res);
    } catch (e) { return { error: "Run failed" }; }
   },
  submit: async (problem_id, language, code) => {
    try {
      const res = await fetch(`${API_URL}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ problem_id, language, code })
      });
      return await safeJson(res);
    } catch (e) { return { error: "Submit failed" }; }
  },

  getMySubmissions: async () => {
    try {
      const res = await fetch(`${API_URL}/submissions`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) return [];
      const data = await safeJson(res);
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }
};

// PROGRESS API calls
const progress = {
  getProgress: async () => {
    try {
      const res = await fetch(`${API_URL}/progress`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) return [];
      const data = await safeJson(res);
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  },

  getRecommendations: async () => {
    try {
      const res = await fetch(`${API_URL}/progress/recommendations`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) return [];
      const data = await safeJson(res);
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }
};

// WISHLIST API calls
const wishlist = {
  getCollections: async () => {
    try {
      const res = await fetch(`${API_URL}/wishlist/collections`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) return [];
      const data = await safeJson(res);
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  },
  getCollectionItems: async (collection_id) => {
    try {
      const res = await fetch(`${API_URL}/wishlist/collections/${collection_id}/items`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) return [];
      const data = await safeJson(res);
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  },
  createCollection: async (name, is_public = false) => {
    try {
      const res = await fetch(`${API_URL}/wishlist/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ name, is_public })
      });
      return await safeJson(res);
    } catch (e) { return { error: "Create failed" }; }
  },
  addItem: async (collection_id, problem_id) => {
    try {
      const res = await fetch(`${API_URL}/wishlist/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ collection_id, problem_id })
      });
      return await safeJson(res);
    } catch (e) { return { error: "Add failed" }; }
  },
  share: async (collection_id, username) => {
    try {
      const res = await fetch(`${API_URL}/wishlist/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ collection_id, username })
      });
      return await safeJson(res);
    } catch (e) { return { error: "Share failed" }; }
  },
  deleteCollection: async (id) => {
    try {
      const res = await fetch(`${API_URL}/wishlist/collections/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      return await safeJson(res);
    } catch (e) { return { error: "Delete failed" }; }
  },
  getNotifications: async () => {
    try {
      const res = await fetch(`${API_URL}/wishlist/notifications`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) return [];
      const data = await safeJson(res);
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  },
  respondToShare: async (id, action) => {
    try {
      const res = await fetch(`${API_URL}/wishlist/notifications/${id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ action })
      });
      return await safeJson(res);
    } catch (e) { return { error: "Response failed" }; }
  }
};
