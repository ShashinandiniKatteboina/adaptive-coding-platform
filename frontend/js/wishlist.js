let selectedCollectionId = null;

async function loadCollections() {
  const cardsContainer = document.getElementById('collections-cards-container');
  const tableBody = document.getElementById('collections-table-body');

  if (!isLoggedIn()) {
    cardsContainer.innerHTML = `
      <div style="text-align:center; padding:48px 24px;">
        <div style="font-size:48px; margin-bottom:16px;">🔒</div>
        <h3 style="color:#1e293b; margin-bottom:8px;">Login to view your collections</h3>
        <p style="color:#64748b; font-size:14px; margin-bottom:24px;">Create and manage your personal problem collections.</p>
        <a href="index.html" class="btn btn-primary" style="display:inline-block; text-decoration:none; width:auto;">Login to Continue</a>
      </div>`;
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">Login to see shared collections.</td></tr>';
    return;
  }

  // Load Notifications first
  loadNotifications();

  try {
    let data = await wishlist.getCollections();
    const currentUser = getUser() || { id: null };

    if (!Array.isArray(data)) data = [];

    const myCollections = data.filter(c => c.user_id === currentUser.id);
    const otherCollections = data.filter(c => c.user_id !== currentUser.id);

    // Render Cards
    if (myCollections.length === 0) {
      cardsContainer.innerHTML = '<p class="empty-state">No personal collections yet. Click "+ Create Collection" to start.</p>';
    } else {
      let cardsHTML = '';
      myCollections.forEach((c, i) => {
        const accentClass = i % 2 === 0 ? 'accent-orange' : 'accent-purple';
        const statusClass = i % 2 === 0 ? 'status-orange' : 'status-purple';
        const statusText = c.is_public ? 'Public' : 'Private';
        const btnClass = i % 2 === 0 ? 'btn-green-solid' : 'btn-purple-solid';

        cardsHTML += `
          <div class="collection-card ${accentClass}" id="coll-${c.id}">
            <div class="dots-menu" onclick="toggleDotsMenu(event, '${c.id}')">
              <span class="dots-icon">⋮</span>
              <div class="dropdown-menu" id="dropdown-${c.id}">
                <div class="dropdown-item" onclick="openShareModal('${c.id}', '${c.name}')">Share</div>
                <div class="dropdown-item delete" onclick="handleDeleteCollection('${c.id}')">Delete</div>
              </div>
            </div>
            <div class="collection-info-group">
              <span class="status-badge ${statusClass}">${statusText}</span>
              <div class="collection-title">${c.name}</div>
              <div class="collection-meta">${c.item_count || 0} problems saved</div>
            </div>
            <div class="collection-actions">
              <button class="collection-action-btn ${btnClass}" onclick="viewCollection('${c.id}')">View Collection</button>
            </div>
          </div>
        `;
      });
      cardsContainer.innerHTML = cardsHTML;
    }

    // Render Table
    if (otherCollections.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No shared collections available yet.</td></tr>';
    } else {
      let tableHTML = '';
      otherCollections.forEach(c => {
        tableHTML += `
          <tr>
            <td style="padding-left:24px; font-weight:600; color:#1e293b;">${c.name}</td>
            <td style="color:#64748b;">${c.owner_name || 'System'}</td>
            <td style="color:#64748b;">${c.item_count || 0} items</td>
            <td style="padding-right:24px;">
              <a href="#" style="color:#6366f1; text-decoration:none; font-weight:500; font-size:14px;" onclick="viewCollection('${c.id}')">View Items</a>
            </td>
          </tr>
        `;
      });
      tableBody.innerHTML = tableHTML;
    }
  } catch (err) {
    if (cardsContainer) cardsContainer.innerHTML = '<p class="error-msg">Failed to load collections.</p>';
  }
}

async function loadNotifications() {
  const container = document.getElementById('notifications-container');
  const list = document.getElementById('notifications-list');
  if (!container || !list) return;

  try {
    const data = await wishlist.getNotifications();
    if (data && data.length > 0) {
      container.style.display = 'block';
      list.innerHTML = data.map(n => `
        <div class="notification-card">
          <div class="notification-info">
            <b>${n.sender_name}</b> shared <b>"${n.collection_name}"</b> with you
          </div>
          <div style="display:flex; gap:12px;">
            <button class="btn btn-sm" style="background:#dcfce7; color:#15803d; border:none;" onclick="handleRespondToShare('${n.share_id}', 'accept')">Accept</button>
            <button class="btn btn-sm" style="background:#f1f5f9; color:#475569; border:none;" onclick="handleRespondToShare('${n.share_id}', 'reject')">Reject</button>
          </div>
        </div>
      `).join('');
    } else {
      container.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to load notifications');
  }
}

async function handleRespondToShare(shareId, action) {
  try {
    const res = await wishlist.respondToShare(shareId, action);
    if (res.message) {
      loadCollections(); // Refresh
    }
  } catch (err) {
    alert('Failed to respond to invitation');
  }
}

async function handleDeleteCollection(id) {
  if (!confirm('Are you sure you want to delete this collection?')) return;
  try {
    const res = await wishlist.deleteCollection(id);
    if (res.message) {
      loadCollections();
    } else {
      alert(res.error || 'Failed to delete');
    }
  } catch (err) {
    alert('Something went wrong');
  }
}

function toggleDotsMenu(event, id) {
  event.stopPropagation();
  // Close all other menus first
  document.querySelectorAll('.dropdown-menu').forEach(m => {
    if (m.id !== `dropdown-${id}`) m.classList.remove('show');
  });
  document.getElementById(`dropdown-${id}`).classList.toggle('show');
}

function openNewCollectionModal() {
  if (!isLoggedIn()) { window.location.href = 'index.html'; return; }
  document.getElementById('collection-modal').style.display = 'block';
}

function openShareModal(id, name) {
  selectedCollectionId = id;
  const infoEl = document.getElementById('sharing-collection-info');
  if (infoEl) infoEl.textContent = `Sharing "${name}"`;
  document.getElementById('share-modal').style.display = 'block';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

async function handleCreateCollection() {
  if (!isLoggedIn()) { window.location.href = 'index.html'; return; }
  const nameEl = document.getElementById('collection-name');
  const name = nameEl ? nameEl.value.trim() : '';
  const isPublicEl = document.getElementById('is-public');
  const isPublic = isPublicEl ? isPublicEl.checked : false;

  if (!name) return;

  try {
    const res = await wishlist.createCollection(name, isPublic);
    const collectionId = res.id || (res.collection && res.collection.id);
    
    if (collectionId) {
      closeModal('collection-modal');
      loadCollections();
      if (nameEl) nameEl.value = '';
    } else {
      alert(res.error || res.message || 'Failed to create collection');
    }
  } catch (err) {
    alert('Failed to create collection');
  }
}

async function handleShareCollection() {
  const usernameEl = document.getElementById('share-username');
  const username = usernameEl ? usernameEl.value.trim() : '';
  if (!username || !selectedCollectionId) return;

  try {
    const res = await wishlist.share(selectedCollectionId, username);
    if (res.message) {
      alert(res.message);
      closeModal('share-modal');
    } else {
      alert(res.error || 'User not found');
    }
  } catch (err) {
    alert('Something went wrong');
  }
}

function viewCollection(id) {
  window.location.href = `problems.html?collection=${id}`;
}

window.onclick = (event) => {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
  // Close dropdowns if clicking outside
  if (!event.target.closest('.dots-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
  }
};

loadCollections();
