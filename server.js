const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { pool, initDatabase } = require('./database');
require('dotenv').config();

// Запуск Telegram бота
if (process.env.TELEGRAM_BOT_TOKEN) {
  require('./bot');
  console.log('🤖 Telegram бот подключен');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'grower-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static('public'));

// Middleware для проверки авторизации
const requireAuth = (req, res, next) => {
  if (!req.session.playerId) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  next();
};

// Регистрация
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password || username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Неверные данные' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id, username, money, experience, level',
      [username, passwordHash]
    );
    
    req.session.playerId = result.rows[0].id;
    res.json({ success: true, player: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Имя уже занято' });
    } else {
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
});

// Вход
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM players WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверные данные' });
    }
    
    const player = result.rows[0];
    const valid = await bcrypt.compare(password, player.password_hash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Неверные данные' });
    }
    
    req.session.playerId = player.id;
    res.json({
      success: true,
      player: {
        id: player.id,
        username: player.username,
        money: player.money,
        experience: player.experience,
        level: player.level
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить данные игрока
app.get('/api/player', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, money, experience, level FROM players WHERE id = $1',
      [req.session.playerId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить растения игрока
app.get('/api/plants', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM plants WHERE player_id = $1 ORDER BY id',
      [req.session.playerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Посадить растение
app.post('/api/plant', requireAuth, async (req, res) => {
  try {
    const plantCount = await pool.query(
      'SELECT COUNT(*) FROM plants WHERE player_id = $1',
      [req.session.playerId]
    );
    
    if (parseInt(plantCount.rows[0].count) >= 6) {
      return res.status(400).json({ error: 'Максимум 6 растений' });
    }
    
    const result = await pool.query(
      'INSERT INTO plants (player_id) VALUES ($1) RETURNING *',
      [req.session.playerId]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновить растение (полив, свет)
app.post('/api/plant/:id/update', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  
  try {
    const plant = await pool.query(
      'SELECT * FROM plants WHERE id = $1 AND player_id = $2',
      [id, req.session.playerId]
    );
    
    if (plant.rows.length === 0) {
      return res.status(404).json({ error: 'Растение не найдено' });
    }
    
    let updates = {};
    const now = new Date();
    const lastUpdate = new Date(plant.rows[0].last_update);
    const hoursPassed = (now - lastUpdate) / (1000 * 60 * 60);
    
    // Естественная деградация
    let waterLevel = Math.max(0, plant.rows[0].water_level - hoursPassed * 5);
    let health = plant.rows[0].health;
    
    if (waterLevel < 20) health = Math.max(0, health - 10);
    
    if (action === 'water') {
      waterLevel = Math.min(100, waterLevel + 50);
      health = Math.min(100, health + 5);
    } else if (action === 'light') {
      const equipment = await pool.query(
        'SELECT level FROM equipment WHERE player_id = $1 AND type = $2',
        [req.session.playerId, 'light']
      );
      const lightBonus = equipment.rows.length > 0 ? equipment.rows[0].level * 2 : 1;
      updates.light_hours = plant.rows[0].light_hours + lightBonus;
      updates.quality = Math.min(100, plant.rows[0].quality + lightBonus);
    }
    
    // Рост растения
    if (health > 50 && waterLevel > 30) {
      const growthProgress = plant.rows[0].light_hours / 20;
      updates.growth_stage = Math.min(5, Math.floor(growthProgress));
    }
    
    const result = await pool.query(
      `UPDATE plants SET 
        water_level = $1, 
        health = $2, 
        growth_stage = COALESCE($3, growth_stage),
        quality = COALESCE($4, quality),
        light_hours = COALESCE($5, light_hours),
        last_update = CURRENT_TIMESTAMP
      WHERE id = $6 AND player_id = $7
      RETURNING *`,
      [waterLevel, health, updates.growth_stage, updates.quality, updates.light_hours, id, req.session.playerId]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Собрать урожай
app.post('/api/plant/:id/harvest', requireAuth, async (req, res) => {
  const { id } = req.params;
  
  try {
    const plant = await pool.query(
      'SELECT * FROM plants WHERE id = $1 AND player_id = $2',
      [id, req.session.playerId]
    );
    
    if (plant.rows.length === 0) {
      return res.status(404).json({ error: 'Растение не найдено' });
    }
    
    if (plant.rows[0].growth_stage < 5) {
      return res.status(400).json({ error: 'Растение не готово' });
    }
    
    const quality = plant.rows[0].quality;
    const reward = Math.floor(50 + (quality / 100) * 150);
    const exp = Math.floor(20 + (quality / 100) * 30);
    
    await pool.query('DELETE FROM plants WHERE id = $1', [id]);
    
    const playerUpdate = await pool.query(
      `UPDATE players SET 
        money = money + $1, 
        experience = experience + $2,
        level = FLOOR(experience / 100) + 1
      WHERE id = $3
      RETURNING money, experience, level`,
      [reward, exp, req.session.playerId]
    );
    
    res.json({
      reward,
      exp,
      player: playerUpdate.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить оборудование
app.get('/api/equipment', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM equipment WHERE player_id = $1',
      [req.session.playerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Купить оборудование
app.post('/api/equipment/buy', requireAuth, async (req, res) => {
  const { type } = req.body;
  
  const prices = {
    light: 100,
    ventilation: 150,
    fertilizer: 80
  };
  
  const price = prices[type];
  if (!price) {
    return res.status(400).json({ error: 'Неверный тип' });
  }
  
  try {
    const player = await pool.query(
      'SELECT money FROM players WHERE id = $1',
      [req.session.playerId]
    );
    
    if (player.rows[0].money < price) {
      return res.status(400).json({ error: 'Недостаточно денег' });
    }
    
    const existing = await pool.query(
      'SELECT * FROM equipment WHERE player_id = $1 AND type = $2',
      [req.session.playerId, type]
    );
    
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE equipment SET level = level + 1 WHERE player_id = $1 AND type = $2',
        [req.session.playerId, type]
      );
    } else {
      await pool.query(
        'INSERT INTO equipment (player_id, type) VALUES ($1, $2)',
        [req.session.playerId, type]
      );
    }
    
    await pool.query(
      'UPDATE players SET money = money - $1 WHERE id = $2',
      [price, req.session.playerId]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Топ игроков
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT username, money, experience, level FROM players ORDER BY money DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Выход
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Инициализация и запуск
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🌱 Сервер запущен на порту ${PORT}`);
  });
});
