const session = require('express-session');
const SQLiteStore = require('better-sqlite3-session-store')(session);
const db = require('better-sqlite3')('sessions.db');

const store = new SQLiteStore({
  client: db, 
  expired: {
    clear: true,
    intervalMs: 900000 // ms = 15min
  }
});

module.exports = session({
  store: store,
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});