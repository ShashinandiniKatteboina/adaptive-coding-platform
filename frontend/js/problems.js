// remove redundant welcome-msg and logout as handled by api.js renderNavbar

let currentTopic = '';

// load problems from backend
async function loadProblems() {
  const searchTerm = document.getElementById('problem-search').value.toLowerCase();
  const container = document.getElementById('problems-container');

  container.innerHTML = '<div class="loading">Loading problems...</div>';

  try {
    // Get collection ID from URL if present
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('collection');
    
    let data;
    if (collectionId) {
        data = await wishlist.getCollectionItems(collectionId);
        document.querySelector('.page-title').textContent = 'Collection Items';
    } else {
        data = await problems.getAll(currentTopic);
    }

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="loading">No problems found.</div>';
      return;
    }

    // Local search filter
    const filteredData = data.filter(p => (p.title || '').toLowerCase().includes(searchTerm));

    if (filteredData.length === 0) {
      container.innerHTML = '<div class="loading">No problems match your search.</div>';
      return;
    }

    // Merge submissions
    let userSubmissions = [];
    if (isLoggedIn()) {
      userSubmissions = await submissions.getMySubmissions();
    }
    const statusMap = {};
    for (const sub of userSubmissions) {
      if (sub.status === 'accepted') {
        statusMap[sub.problem_id] = 'accepted';
      } else if (statusMap[sub.problem_id] !== 'accepted') {
        if (sub.status === 'partial') statusMap[sub.problem_id] = 'partial';
        else statusMap[sub.problem_id] = sub.status;
      }
    }

    filteredData.forEach(p => {
      if (statusMap[p.id]) {
        p.status = statusMap[p.id];
      }
    });

    let html = `
      <table class="problems-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Title</th>
            <th>Topic</th>
            <th>Difficulty</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    filteredData.forEach((problem) => {
      // Status mapping
      let statusHtml = '<span class="status-icon" style="border:none;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg></span>';
      
      if (problem.status === 'accepted') {
        statusHtml = '<span class="status-icon" style="border:none;"><svg width="20" height="20" viewBox="0 0 24 24" fill="#22c55e" stroke="none"><circle cx="12" cy="12" r="10"></circle><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 13l3 3 7-7"></path></svg></span>';
      } else if (problem.status === 'wrong_answer' || problem.status === 'wrong') {
        statusHtml = '<span class="status-icon" style="border:none;"><svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><circle cx="12" cy="12" r="10"></circle><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 9l-6 6M9 9l6 6"></path></svg></span>';
      } else if (problem.status === 'partial') {
        statusHtml = '<span class="status-icon" style="border:none;"><svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><circle cx="12" cy="12" r="10"></circle><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 8v4M12 16h.01"></path></svg></span>';
      }

      html += `
        <tr onclick="window.location.href='problem.html?id=${problem.id}'">
          <td>${statusHtml}</td>
          <td>${problem.title}</td>
          <td><span class="topic-badge">${problem.topic}</span></td>
          <td><span class="badge badge-${problem.difficulty.toLowerCase()}">${problem.difficulty}</span></td>
          <td onclick="event.stopPropagation(); handleWishlistClick(event, '${problem.id}')">
            <span style="cursor:pointer; font-weight:bold; padding: 4px 8px;">⋮</span>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = '<div class="loading">Failed to load problems. Make sure backend is running.</div>';
  }
}

function filterByTopic(topic) {
  currentTopic = topic;
  
  // Update active state in sidebar
  const items = document.querySelectorAll('.topic-item');
  items.forEach(item => item.classList.remove('active'));
  
  // Find the item that matches the topic
  items.forEach(item => {
    if (item.onclick.toString().includes(`'${topic}'`)) {
      item.classList.add('active');
    }
  });

  loadProblems();
}

async function handleWishlistClick(event, problemId) {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  // 1. Add to default "Wishlist" collection first
  try {
    const collections = await wishlist.getCollections();
    if (Array.isArray(collections)) {
      let wishlistCol = collections.find(c => c.name.toLowerCase() === 'wishlist');
      if (!wishlistCol) {
        wishlistCol = await wishlist.createCollection('Wishlist');
      }
      await wishlist.addItem(wishlistCol.id, problemId);
    }
  } catch (err) {
    console.error('Failed to add to default wishlist', err);
  }

  // 2. Show the menu for more options
  showWishlistMenu(event, problemId);
}

async function showWishlistMenu(event, problemId) {
  const existingMenu = document.getElementById('wishlist-popup');
  if (existingMenu) existingMenu.remove();

  const rect = event.target.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'wishlist-popup';
  menu.className = 'wishlist-popup';
  menu.style.top = `${rect.bottom + window.scrollY}px`;
  menu.style.left = `${rect.left + window.scrollX - 150}px`;

  menu.innerHTML = '<div class="loading">Loading collections...</div>';
  document.body.appendChild(menu);

  try {
    const collections = await wishlist.getCollections();
    let html = '<h4>Collections</h4>';
    
    if (collections.length === 0) {
      html += '<p style="font-size:12px; padding:10px;">No collections found.</p>';
    } else {
      collections.forEach(c => {
        html += `<div class="menu-item" onclick="addToCollection('${c.id}', '${problemId}')">${c.name}</div>`;
      });
    }
    
    html += '<hr><div class="menu-item" style="color:#6366f1; font-weight:600;" onclick="createNewCollectionAndAdd(\'' + problemId + '\')">+ Create Collection</div>';
    menu.innerHTML = html;

  } catch (err) {
    menu.innerHTML = '<div class="menu-item">Failed to load</div>';
  }

  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 10);
}

async function addToCollection(collectionId, problemId) {
  try {
    await wishlist.addItem(collectionId, problemId);
    alert('Added to wishlist!');
    document.getElementById('wishlist-popup').remove();
  } catch (err) {
    alert('Failed to add to wishlist');
  }
}

async function createNewCollectionAndAdd(problemId) {
  const name = prompt('Enter collection name:');
  if (!name) return;
  try {
    const newCol = await wishlist.createCollection(name);
    await wishlist.addItem(newCol.id, problemId);
    alert('Created and added to collection: ' + name);
    document.getElementById('wishlist-popup').remove();
  } catch (err) {
    alert('Failed to create/add');
  }
}

// TOPIC SEARCH LOGIC
function filterTopicsList() {
  const term = document.getElementById('topic-search-input').value.toLowerCase();
  const items = document.querySelectorAll('.topic-item');
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(term) ? 'block' : 'none';
  });
}

// load problems when page opens
loadProblems();