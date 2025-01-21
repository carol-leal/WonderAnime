const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.resolve(__dirname, "tokens.db"));

// Create the `logins` table if it doesn't exist (for user tokens)
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

// Create the `roles` table if it doesn't exist (for server roles)
db.prepare(
  `
    CREATE TABLE IF NOT EXISTS roles (
      server_id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `
).run();

/**
 * Token Management
 */

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

/**
 * Role Management
 */

// Save or update the role for a server
function setRole(serverId, roleId) {
  const stmt = db.prepare(`
    INSERT INTO roles (server_id, role_id)
    VALUES (?, ?)
    ON CONFLICT(server_id) DO UPDATE SET
      role_id = excluded.role_id,
      updated_at = CURRENT_TIMESTAMP;
  `);
  stmt.run(serverId, roleId);
}

// Retrieve the role for a server
function getRole(serverId) {
  const stmt = db.prepare(`SELECT role_id FROM roles WHERE server_id = ?`);
  const result = stmt.get(serverId);
  return result ? result.role_id : null;
}

// Remove the role for a server
function removeRole(serverId) {
  const stmt = db.prepare(`DELETE FROM roles WHERE server_id = ?`);
  stmt.run(serverId);
}

module.exports = {
  // Token functions
  saveToken,
  getToken,
  removeToken,

  // Role functions
  setRole,
  getRole,
  removeRole,
};
