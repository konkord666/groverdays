const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не установлен!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Telegram бот запущен!');

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'Гровер';
  
  const welcomeMessage = `
🌱 *Добро пожаловать в Grower Simulator!*

Привет, ${firstName}! 👋

Это крутая игра-симулятор выращивания растений!

🎮 *Что тебя ждет:*
• Выращивай до 6 растений одновременно
• Покупай оборудование (лампы, вентиляция)
• Зарабатывай деньги и прокачивайся
• Соревнуйся с другими игроками в топе

💰 Стартовый капитал: 100$
⭐ Начальный уровень: 1

Нажми кнопку ниже, чтобы начать играть! 👇
  `;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: '🎮 Играть в Grower Simulator',
          web_app: { url: webAppUrl && webAppUrl.startsWith('http') ? webAppUrl : `https://${webAppUrl || 'your-app.railway.app'}` }
        }
      ],
      [
        { text: '📊 Статистика', callback_data: 'stats' },
        { text: '🏆 Топ игроков', callback_data: 'leaderboard' }
      ],
      [
        { text: '❓ Помощь', callback_data: 'help' }
      ]
    ]
  };

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
});

// Команда /play
bot.onText(/\/play/, (msg) => {
  const chatId = msg.chat.id;
  
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: '🎮 Открыть игру',
          web_app: { url: webAppUrl && webAppUrl.startsWith('http') ? webAppUrl : `https://${webAppUrl || 'your-app.railway.app'}` }
        }
      ]
    ]
  };

  bot.sendMessage(chatId, '🌱 Нажми кнопку, чтобы открыть игру:', {
    reply_markup: keyboard
  });
});

// Команда /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `
📖 *Помощь по игре*

*Основные команды:*
/start - Начать игру
/play - Открыть игру
/stats - Твоя статистика
/top - Топ игроков
/help - Эта справка

*Как играть:*
1️⃣ Посади растение (кнопка "🌱 Посадить")
2️⃣ Поливай 💧 и освещай 💡 его
3️⃣ Жди роста (5 стадий)
4️⃣ Собирай урожай 🌿
5️⃣ Покупай оборудование 🛒

*Оборудование:*
💡 Лампа (100$) - ускоряет рост
🌀 Вентиляция (150$) - улучшает качество
🧪 Удобрения (80$) - повышает здоровье

*Советы:*
• Поливай каждые 2-3 часа
• Следи за здоровьем растений
• Улучшай оборудование
• Стремись в топ-10! 🏆

Удачи! 🌱
  `;

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Команда /stats
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '📊 Статистика доступна в игре. Открой мини-приложение!', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🎮 Открыть игру',
            web_app: { url: webAppUrl || 'https://your-app.railway.app' }
          }
        ]
      ]
    }
  });
});

// Команда /top
bot.onText(/\/top/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '🏆 Таблица лидеров доступна в игре. Открой мини-приложение!', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🎮 Открыть игру',
            web_app: { url: webAppUrl || 'https://your-app.railway.app' }
          }
        ]
      ]
    }
  });
});

// Обработка callback кнопок
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  switch (data) {
    case 'stats':
      bot.sendMessage(chatId, '📊 Открой игру, чтобы увидеть свою статистику!', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎮 Открыть игру',
                web_app: { url: webAppUrl && webAppUrl.startsWith('http') ? webAppUrl : `https://${webAppUrl || 'your-app.railway.app'}` }
              }
            ]
          ]
        }
      });
      break;

    case 'leaderboard':
      bot.sendMessage(chatId, '🏆 Открой игру, чтобы увидеть топ игроков!', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎮 Открыть игру',
                web_app: { url: webAppUrl && webAppUrl.startsWith('http') ? webAppUrl : `https://${webAppUrl || 'your-app.railway.app'}` }
              }
            ]
          ]
        }
      });
      break;

    case 'help':
      bot.sendMessage(chatId, `
📖 *Краткая справка*

Открой мини-приложение и начни выращивать! 🌱

*Основы:*
• Сажай растения
• Поливай и освещай
• Собирай урожай
• Покупай оборудование
• Попади в топ!

Удачи! 💚
      `, { parse_mode: 'Markdown' });
      break;
  }

  bot.answerCallbackQuery(query.id);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error.code, error.message);
});

bot.on('error', (error) => {
  console.error('❌ Ошибка бота:', error);
});

module.exports = bot;
