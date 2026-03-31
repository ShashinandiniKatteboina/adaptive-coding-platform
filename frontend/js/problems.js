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
    let userSubmissions =[];
    if (isLoggedIn()) {
      userSubmissions = await submissions.getMySubmissions();
      
      // 👇 THIS IS THE NEW LINE WE ADDED 👇
      // It triggers the smart banner at the top of the page based on your submissions!
      loadSmartRecommendations(userSubmissions);
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
    // Dynamic Topics Sidebar logic
    const topicListEl = document.getElementById('topic-list');
    if (topicListEl) {
      const allTopics = [...new Set(data.map(p => p.topic).filter(Boolean))];
      allTopics.sort();
      
      let topicHtml = `<div class="topic-item ${currentTopic === '' ? 'active' : ''}" onclick="filterByTopic('')">All Topics</div>`;
      allTopics.forEach(t => {
        const isActive = currentTopic === t ? 'active' : '';
        topicHtml += `<div class="topic-item ${isActive}" onclick="filterByTopic('${t}')">${t}</div>`;
      });
      topicListEl.innerHTML = topicHtml;
    }

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

  // Show the menu for more options
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
    
    // If viewing a specific collection, add Delete option
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('collection');
    if (collectionId) {
       html += `<hr><div class="menu-item delete" style="color:#ef4444; font-weight:600;" onclick="handleRemoveFromCollection('${collectionId}', '${problemId}')">Delete from Collection</div>`;
    }

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

async function handleRemoveFromCollection(collectionId, problemId) {
  if (!confirm('Are you sure you want to remove this problem from the collection?')) return;
  try {
    const res = await wishlist.removeItem(collectionId, problemId);
    if (res.message) {
      document.getElementById('wishlist-popup')?.remove();
      loadProblems(); // Refresh the list
    } else {
      alert(res.error || 'Failed to remove problem');
    }
  } catch (err) {
    alert('Something went wrong');
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


async function loadSmartRecommendations(userSubmissions) {
  if (!isLoggedIn()) return;
  const banner = document.getElementById('smart-recommendation-banner');
  
  try {
    const recs = await progress.getRecommendations();
    if (!recs || recs.length === 0) return;

    let message = "Based on your progress, we recommend:";
    let bannerBg = "#f8fafc"; 
    let borderColor = "#e2e8f0";

    // Analyze recent submission context
    if (userSubmissions && userSubmissions.length > 0) {
      const lastSub = userSubmissions[0]; // The most recent submission
      
      if (lastSub.status === 'accepted') {
        message = `🎉 Awesome job solving <b>${lastSub.title}</b>! Ready to level up? Try this next:`;
        bannerBg = "#f0fdf4"; // Light green
        borderColor = "#86efac";
      } else {
        message = `💡 Looks like you had trouble with <b>${lastSub.title}</b>. Let's brush up on the basics:`;
        bannerBg = "#fffbeb"; // Light yellow/orange
        borderColor = "#fde047";
      }
    }

    const topRec = recs[0];
    const diffColor = topRec.difficulty.toLowerCase() === 'easy' ? '#16a34a' : topRec.difficulty.toLowerCase() === 'medium' ? '#d97706' : '#dc2626';

    banner.style.display = "block";
    banner.innerHTML = `
      <div style="background: ${bannerBg}; border: 1px solid ${borderColor}; padding: 20px 24px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div>
          <p style="color: #475569; font-size: 14px; margin-bottom: 8px;">${message}</p>
          <h3 style="color: #1e293b; font-size: 18px; font-weight: 700;">${topRec.title}</h3>
          <div style="margin-top: 6px; font-size: 13px;">
            <span style="color: ${diffColor}; font-weight: 700; margin-right: 12px; text-transform: capitalize;">${topRec.difficulty}</span>
            <span style="color: #64748b; background: rgba(255,255,255,0.6); padding: 2px 10px; border-radius: 12px; text-transform: capitalize;">Topic: ${topRec.topic}</span>
          </div>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-outline" style="background: #ffffff; border-color: ${borderColor};" onclick="window.location.href='courses.html'">Review Course</button>
          <button class="btn btn-primary" onclick="window.location.href='problem.html?id=${topRec.id}'">Solve Now</button>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Failed to load smart recommendations", err);
  }
}

// load problems when page opens
loadProblems();