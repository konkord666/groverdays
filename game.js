let player = null;
let plants = [];
let equipment = {};

// Переключение табов авторизации
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
  });
});

// Регистрация
async function register() {
  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      player = data.player;
      showGame();
    } else {
      showError(data.error);
    }
  } catch (err) {
    showError('Ошибка соединения');
  }
}

// Вход
async function login() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      player = data.player;
      showGame();
    } else {
      showError(data.error);
    }
  } catch (err) {
    showError('Ошибка соединения');
  }
}

// Выход
async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('auth-screen').classList.add('active');
  player = null;
}

function showError(message) {
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = message;
  setTimeout(() => errorEl.textContent = '', 3000);
}

function showGame() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
  updatePlayerUI();
  loadPlants();
  loadEquipment();
  loadLeaderboard();
  
  setInterval(() => {
    loadPlants();
    loadLeaderboard();
  }, 5000);
}

function updatePlayerUI() {
  document.getElementById('player-name').textContent = player.username;
  document.getElementById('player-level').textContent = player.level;
  document.getElementById('player-money').textContent = Math.floor(player.money);
  document.getElementById('player-exp').textContent = player.experience;
}

async function loadPlants() {
  const res = await fetch('/api/plants');
  plants = await res.json();
  renderPlants();
}

function renderPlants() {
  const grid = document.getElementById('plants-grid');
  grid.innerHTML = '';
  
  const maxSlots = 6;
  for (let i = 0; i < maxSlots; i++) {
    const plant = plants[i];
    const slot = document.createElement('div');
    slot.className = 'plant-slot';
    
    if (plant) {
      slot.classList.add('has-plant');
      slot.innerHTML = `
        <div class="plant-icon">${getPlantIcon(plant.growth_stage)}</div>
        <div class="plant-stage">${getStageText(plant.growth_stage)}</div>
        <div class="plant-stats">
          <div class="stat-bar">
            <div class="stat-label">
              <span>❤️ Здоровье</span>
              <span>${plant.health}%</span>
            </div>
            <div class="bar">
              <div class="bar-fill health" style="width: ${plant.health}%"></div>
            </div>
          </div>
          <div class="stat-bar">
            <div class="stat-label">
              <span>💧 Вода</span>
              <span>${Math.floor(plant.water_level)}%</span>
            </div>
            <div class="bar">
              <div class="bar-fill water" style="width: ${plant.water_level}%"></div>
            </div>
          </div>
          <div class="stat-bar">
            <div class="stat-label">
              <span>✨ Качество</span>
              <span>${plant.quality}%</span>
            </div>
            <div class="bar">
              <div class="bar-fill quality" style="width: ${plant.quality}%"></div>
            </div>
          </div>
        </div>
        <div class="plant-actions">
          <button class="btn-action btn-water" onclick="waterPlant(${plant.id})">💧</button>
          <button class="btn-action btn-light" onclick="lightPlant(${plant.id})">💡</button>
          ${plant.growth_stage >= 5 ? 
            `<button class="btn-action btn-harvest" onclick="harvestPlant(${plant.id})">🌿 Собрать</button>` : 
            ''}
        </div>
      `;
    } else {
      slot.innerHTML = '<div style="font-size: 48px; opacity: 0.3;">➕</div>';
    }
    
    grid.appendChild(slot);
  }
}

function getPlantIcon(stage) {
  const icons = ['🌱', '🌿', '🪴', '🌳', '🌲', '🎄'];
  return icons[stage] || '🌱';
}

function getStageText(stage) {
  const stages = ['Семя', 'Росток', 'Молодое', 'Растущее', 'Зрелое', 'Готово!'];
  return stages[stage] || 'Семя';
}

async function plantNew() {
  const res = await fetch('/api/plant', { method: 'POST' });
  const data = await res.json();
  
  if (res.ok) {
    showNotification('🌱 Растение посажено!');
    loadPlants();
  } else {
    showNotification('❌ ' + data.error);
  }
}

async function waterPlant(id) {
  const res = await fetch(`/api/plant/${id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'water' })
  });
  
  if (res.ok) {
    showNotification('💧 Растение полито');
    loadPlants();
  }
}

async function lightPlant(id) {
  const res = await fetch(`/api/plant/${id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'light' })
  });
  
  if (res.ok) {
    showNotification('💡 Свет включен');
    loadPlants();
  }
}

async function harvestPlant(id) {
  const res = await fetch(`/api/plant/${id}/harvest`, { method: 'POST' });
  const data = await res.json();
  
  if (res.ok) {
    showNotification(`🎉 Собрано! +${data.reward}$ +${data.exp} XP`);
    player = data.player;
    updatePlayerUI();
    loadPlants();
  }
}

async function loadEquipment() {
  const res = await fetch('/api/equipment');
  const items = await res.json();
  
  equipment = {};
  items.forEach(item => {
    equipment[item.type] = item.level;
  });
  
  document.getElementById('light-level').textContent = equipment.light || 0;
  document.getElementById('ventilation-level').textContent = equipment.ventilation || 0;
  document.getElementById('fertilizer-level').textContent = equipment.fertilizer || 0;
}

async function buyEquipment(type) {
  const res = await fetch('/api/equipment/buy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type })
  });
  
  const data = await res.json();
  
  if (res.ok) {
    showNotification('✅ Оборудование куплено!');
    const playerRes = await fetch('/api/player');
    player = await playerRes.json();
    updatePlayerUI();
    loadEquipment();
  } else {
    showNotification('❌ ' + data.error);
  }
}

async function loadLeaderboard() {
  const res = await fetch('/api/leaderboard');
  const leaders = await res.json();
  
  const list = document.getElementById('leaderboard');
  list.innerHTML = leaders.map((p, i) => `
    <div class="leaderboard-item ${i < 3 ? `top-${i + 1}` : ''}">
      <div class="lb-player">
        <span class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
        <span>${p.username}</span>
      </div>
      <div class="lb-stats">
        <span>💰 ${Math.floor(p.money)}$</span>
        <span>⭐ ${p.level}</span>
      </div>
    </div>
  `).join('');
}

function showNotification(message) {
  const notif = document.getElementById('notification');
  notif.textContent = message;
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 3000);
}
