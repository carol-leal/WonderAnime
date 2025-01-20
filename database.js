const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.resolve(__dirname, "tokens.db"));

// Create the logins table if it doesn't exist
db.prepare(
  `
    CREATE TABLE IF NOT EXISTS logins (
      server_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `
).run();
// Save a token for a server
function saveToken(serverId, userId, token) {
  const stmt = db.prepare(`
    INSERT INTO logins (server_id, user_id, token)
    VALUES (?, ?, ?)
    ON CONFLICT(server_id) DO UPDATE SET
      user_id = excluded.user_id,
      token = excluded.token,
      logged_at = CURRENT_TIMESTAMP;
  `);
  stmt.run(serverId, userId, token);
}

// Retrieve a token for a server
function getToken(serverId) {
  const stmt = db.prepare(`SELECT token FROM logins WHERE server_id = ?`);
  const result = stmt.get(serverId);
  return result ? result.token : null;
}

// Remove a token for a server
function removeToken(serverId) {
  const stmt = db.prepare(`DELETE FROM logins WHERE server_id = ?`);
  stmt.run(serverId);
}

module.exports = {
  saveToken,
  getToken,
  removeToken,
};
