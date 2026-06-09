const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const { registerApiAuthGuard, registerAuthRoutes } = require('./routes/auth');
const { registerUsersRoutes } = require('./routes/users');
const { registerObrasSocialesRoutes } = require('./routes/obrasSociales');
const { registerPatientsRoutes } = require('./routes/patients');
const { registerAttendancesExportRoute } = require('./routes/attendancesExport');

const PORT = process.env.PORT || 4000;
const SCHEMA_SQL_PATH = path.join(__dirname, 'schema.sql');
const LOCAL_DATA_DIR = path.join(__dirname, 'data');
const LOCAL_DB_PATH = path.join(LOCAL_DATA_DIR, 'local.sqlite');
const NODE_ENV = String(process.env.NODE_ENV || '').trim().toLowerCase() || 'development';
const IS_PROD = NODE_ENV === 'production';
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 12);
const SESSION_TTL_SECONDS = Math.max(1, Math.floor(SESSION_TTL_HOURS * 60 * 60));
const JWT_COOKIE_NAME = String(process.env.JWT_COOKIE_NAME || 'cenein_auth').trim() || 'cenein_auth';
const JWT_ISSUER = String(process.env.JWT_ISSUER || 'cenein').trim() || 'cenein';
const JWT_AUDIENCE = String(process.env.JWT_AUDIENCE || 'cenein-web').trim() || 'cenein-web';
const JWT_COOKIE_SAMESITE_RAW = String(process.env.JWT_COOKIE_SAMESITE || '').trim().toLowerCase();
const JWT_COOKIE_SAMESITE = ['lax', 'strict', 'none'].includes(JWT_COOKIE_SAMESITE_RAW)
  ? JWT_COOKIE_SAMESITE_RAW
  : (IS_PROD ? 'none' : 'lax');
const JWT_COOKIE_SECURE_RAW = String(process.env.JWT_COOKIE_SECURE || '').trim().toLowerCase();
const JWT_COOKIE_SECURE =
  JWT_COOKIE_SECURE_RAW === '1' || JWT_COOKIE_SECURE_RAW === 'true'
    ? true
    : JWT_COOKIE_SECURE_RAW === '0' || JWT_COOKIE_SECURE_RAW === 'false'
    ? false
    : IS_PROD;
const JWT_SECRET =
  String(process.env.JWT_SECRET || '').trim() ||
  (IS_PROD ? '' : 'dev-only-change-this-jwt-secret');
const LOGIN_MAX_FAILED_ATTEMPTS = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS || 8);
const LOGIN_COOLDOWN_MINUTES = Number(process.env.LOGIN_COOLDOWN_MINUTES || 30);
const LOGIN_COOLDOWN_MS = LOGIN_COOLDOWN_MINUTES * 60 * 1000;
const LOGIN_RATE_LIMIT_RETENTION_HOURS = Number(process.env.LOGIN_RATE_LIMIT_RETENTION_HOURS || 48);
const AUTH_RATE_LIMIT_DEBUG =
  String(process.env.AUTH_RATE_LIMIT_DEBUG || '').trim() === '1';
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || '').trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
const ALLOW_INSECURE_DEFAULT_ADMIN = String(process.env.ALLOW_INSECURE_DEFAULT_ADMIN || '').trim() === '1';
const CORS_ALLOWED_ORIGINS = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const TRATAMIENTOS_BASE = [
  'Fonoaudiologia',
  'Psicologia',
  'Psicopedagogia',
  'Psicomotricidad',
  'Kinesiologia',
  'TO Terapia Ocupacional',
  'Integracion',
];
const DIAS_VALIDOS = new Set(['Lun', 'Mar', 'Mie', 'Jue', 'Vie']);
const DIAS_INDICE = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

function normalizeSqlForPostgres(sql) {
  let text = String(sql || '');
  text = text.replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT');
  if (/INSERT\s+INTO/i.test(text) && !/ON\s+CONFLICT/i.test(text)) {
    text = text.replace(/(\)\s*VALUES\s*\([^;]+\))\s*;?\s*$/i, '$1 ON CONFLICT DO NOTHING');
  }
  text = text.replace(/datetime\('now'\)/gi, 'now()');
  return text;
}

function convertPlaceholdersForPostgres(sql) {
  let idx = 0;
  return String(sql || '').replace(/\?/g, () => `$${++idx}`);
}

function parseDbArgs(sql, argsLike) {
  const rawArgs = Array.isArray(argsLike) ? argsLike : Array.from(argsLike || []);
  const args =
    rawArgs.length === 1 && Array.isArray(rawArgs[0]) ? rawArgs[0] : rawArgs;
  return {
    sql: String(sql || ''),
    params: args,
  };
}

function normalizeSqlForLocal(sql) {
  return String(sql || '')
    .replace(/\bnow\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bTRUE\b/g, '1')
    .replace(/\bFALSE\b/g, '0');
}

function createLocalDb(database, persist) {
  return {
    async exec(sql) {
      const text = normalizeSqlForLocal(sql);
      if (!text.trim()) return;
      database.exec(text);
      persist();
    },
    async get(sql, ...params) {
      const parsed = parseDbArgs(sql, params);
      const text = normalizeSqlForLocal(parsed.sql);
      const stmt = database.prepare(text);
      try {
        stmt.bind(parsed.params);
        if (!stmt.step()) return null;
        return stmt.getAsObject();
      } finally {
        stmt.free();
      }
    },
    async all(sql, ...params) {
      const parsed = parseDbArgs(sql, params);
      const text = normalizeSqlForLocal(parsed.sql);
      const stmt = database.prepare(text);
      const rows = [];
      try {
        stmt.bind(parsed.params);
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        return rows;
      } finally {
        stmt.free();
      }
    },
    async run(sql, ...params) {
      const parsed = parseDbArgs(sql, params);
      const text = normalizeSqlForLocal(parsed.sql);
      database.run(text, parsed.params);
      if (!/^\s*BEGIN\b/i.test(text)) persist();
      const changes = database.getRowsModified();
      const lastIdRes = database.exec('SELECT last_insert_rowid() AS id');
      const lastID = lastIdRes?.[0]?.values?.[0]?.[0] || null;
      return {
        changes: Number(changes || 0),
        lastID,
      };
    },
  };
}

function getClientIp(req) {
  const normalizeIp = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.includes(',')) {
      return normalizeIp(raw.split(',')[0]);
    }
    if (raw.startsWith('::ffff:')) return raw.slice(7);
    if (raw === '::1') return '127.0.0.1';
    return raw;
  };

  const headerCandidates = [
    req.get('cf-connecting-ip'),
    req.get('x-real-ip'),
    req.get('x-forwarded-for'),
  ];

  for (const candidate of headerCandidates) {
    const ip = normalizeIp(candidate);
    if (ip) return ip;
  }

  return normalizeIp(req.ip || req.socket?.remoteAddress) || 'unknown';
}

function normalizeLoginScopeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function getLoginRateLimitUserKey(username) {
  const safeUsername = normalizeLoginScopeValue(username);
  return safeUsername ? `user:${safeUsername}` : '';
}

function getLoginRateLimitIpKey(ip) {
  const safeIp = normalizeLoginScopeValue(ip) || 'unknown';
  return `ip:${safeIp}`;
}

function getLoginRateLimitUserIpKey(ip, username) {
  const safeUsername = normalizeLoginScopeValue(username);
  if (!safeUsername) return '';
  return `user-ip:${safeUsername}:${normalizeLoginScopeValue(ip) || 'unknown'}`;
}

function buildLoginRateLimitKeys(ip, username) {
  const keys = [];
  const userKey = getLoginRateLimitUserKey(username);
  const ipKey = getLoginRateLimitIpKey(ip);
  const userIpKey = getLoginRateLimitUserIpKey(ip, username);
  if (userKey) keys.push(userKey);
  if (ipKey) keys.push(ipKey);
  if (userIpKey) keys.push(userIpKey);
  return keys;
}

function createLoginRateLimiter(db) {
  function debugRateLimit(event, payload) {
    if (!AUTH_RATE_LIMIT_DEBUG) return;
    console.log(`[AUTH][RATE_LIMIT] ${event}`, payload);
  }

  async function pruneLoginRateLimitState() {
    const retentionHours = Number.isFinite(LOGIN_RATE_LIMIT_RETENTION_HOURS)
      ? Math.max(1, LOGIN_RATE_LIMIT_RETENTION_HOURS)
      : 48;
    const retentionMs = retentionHours * 60 * 60 * 1000;
    const cutoffIso = new Date(Date.now() - retentionMs).toISOString();
    await db.run(
      'DELETE FROM login_rate_limits WHERE updated_at < ? AND (blocked_until IS NULL OR blocked_until < ?)',
      cutoffIso,
      cutoffIso
    );
  }

  async function getLoginBlockRemainingMs(ip, username) {
    const userKey = getLoginRateLimitUserKey(username);
    if (!userKey) return 0;
    const row = await db.get(
      'SELECT scope_key, blocked_until FROM login_rate_limits WHERE scope_key = ?',
      userKey
    );
    const blockedUntilMs = row?.blocked_until ? new Date(row.blocked_until).getTime() : 0;
    if (!row?.blocked_until) {
      debugRateLimit('block-check', {
        ip,
        username: normalizeLoginScopeValue(username),
        userKey,
        maxRemainingMs: 0,
        row: row || null,
      });
      return 0;
    }
    if (!Number.isFinite(blockedUntilMs) || blockedUntilMs <= Date.now()) {
      await db.run('DELETE FROM login_rate_limits WHERE scope_key = ?', userKey);
      debugRateLimit('block-check', {
        ip,
        username: normalizeLoginScopeValue(username),
        userKey,
        maxRemainingMs: 0,
        row: row || null,
      });
      return 0;
    }
    const maxRemaining = blockedUntilMs - Date.now();
    debugRateLimit('block-check', {
      ip,
      username: normalizeLoginScopeValue(username),
      userKey,
      maxRemainingMs: maxRemaining,
      row,
    });
    return maxRemaining;
  }

  async function registerFailedLoginAttempt(ip, username) {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const userKey = getLoginRateLimitUserKey(username);
    const keys = [userKey, getLoginRateLimitIpKey(ip), getLoginRateLimitUserIpKey(ip, username)].filter(Boolean);
    let blockedUntil = 0;
    for (const key of keys) {
      const nextBlockedUntil =
        LOGIN_MAX_FAILED_ATTEMPTS > 0 ? new Date(now + LOGIN_COOLDOWN_MS).toISOString() : null;
      const isPrimaryUserKey = key === userKey;
      const current = await db.get(
        'SELECT failed_count, blocked_until FROM login_rate_limits WHERE scope_key = ?',
        key
      );
      let nextFailedCount = Number(current?.failed_count || 0);
      let nextBlocked = current?.blocked_until || null;
      const currentBlockedMs = nextBlocked ? new Date(nextBlocked).getTime() : 0;
      if (!Number.isFinite(currentBlockedMs) || currentBlockedMs <= now) {
        nextFailedCount += 1;
        nextBlocked =
          isPrimaryUserKey &&
          LOGIN_MAX_FAILED_ATTEMPTS > 0 &&
          nextFailedCount >= LOGIN_MAX_FAILED_ATTEMPTS
            ? nextBlockedUntil
            : null;
      }
      if (current) {
        await db.run(
          `UPDATE login_rate_limits
           SET failed_count = ?, blocked_until = ?, updated_at = ?
           WHERE scope_key = ?`,
          nextFailedCount,
          nextBlocked,
          nowIso,
          key
        );
      } else {
        await db.run(
          `INSERT INTO login_rate_limits (scope_key, failed_count, blocked_until, updated_at)
           VALUES (?, ?, ?, ?)`,
          key,
          nextFailedCount,
          nextBlocked,
          nowIso
        );
      }
      const updated = { failed_count: nextFailedCount, blocked_until: nextBlocked };
      const blockedUntilMs = updated?.blocked_until ? new Date(updated.blocked_until).getTime() : 0;
      if (isPrimaryUserKey && Number.isFinite(blockedUntilMs) && blockedUntilMs > now) {
        blockedUntil = Math.max(blockedUntil, blockedUntilMs);
      }
      debugRateLimit('failed-attempt', {
        ip,
        username: normalizeLoginScopeValue(username),
        key,
        isPrimaryUserKey,
        dbFailedCount: Number(updated?.failed_count || 0),
        dbBlockedUntil: updated?.blocked_until || null,
      });
    }
    return { blockedUntil };
  }

  async function clearFailedLoginAttempts(ip, username) {
    const keys = [
      getLoginRateLimitUserKey(username),
      getLoginRateLimitUserIpKey(ip, username),
    ].filter(Boolean);
    await db.run(
      `DELETE FROM login_rate_limits WHERE scope_key IN (${keys.map(() => '?').join(', ')})`,
      keys
    );
    debugRateLimit('clear-attempts', {
      ip,
      username: normalizeLoginScopeValue(username),
      keys,
    });
  }

  return {
    pruneLoginRateLimitState,
    getLoginBlockRemainingMs,
    registerFailedLoginAttempt,
    clearFailedLoginAttempts,
    getBlockedUsers: async function getBlockedUsers() {
      const nowIso = new Date().toISOString();
      return db.all(
        `SELECT scope_key, failed_count, blocked_until, updated_at
         FROM login_rate_limits
         WHERE scope_key LIKE 'user:%'
           AND blocked_until IS NOT NULL
           AND blocked_until > ?
         ORDER BY blocked_until ASC`,
        nowIso
      );
    },
    clearBlockedUser: async function clearBlockedUser(username) {
      const safeUsername = normalizeLoginScopeValue(username);
      const userKey = getLoginRateLimitUserKey(safeUsername);
      if (!userKey) return { changes: 0 };
      return db.run(
        `DELETE FROM login_rate_limits
         WHERE scope_key = ?
            OR scope_key LIKE ?`,
        userKey,
        `user-ip:${safeUsername}:%`
      );
    },
    debugRateLimit,
  };
}

function createAuditLogger(db) {
  async function logUserActivity(req, entry) {
    try {
      const actorUserId = Number(req?.auth?.userId || 0) || null;
      const actorUsername = String(
        entry?.actorUsername || req?.auth?.username || 'desconocido'
      ).trim() || 'desconocido';
      const actionType = String(entry?.actionType || '').trim();
      const entityType = String(entry?.entityType || '').trim();
      if (!actionType || !entityType) return;
      const entityId =
        entry?.entityId === undefined || entry?.entityId === null
          ? null
          : String(entry.entityId).trim() || null;
      const entityLabel =
        entry?.entityLabel === undefined || entry?.entityLabel === null
          ? null
          : String(entry.entityLabel).trim() || null;
      const details =
        entry?.details && typeof entry.details === 'object'
          ? JSON.stringify(entry.details)
          : entry?.details == null
          ? null
          : String(entry.details);
      await db.run(
        `INSERT INTO user_activity_logs
         (actor_user_id, actor_username, action_type, entity_type, entity_id, entity_label, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        actorUserId,
        actorUsername,
        actionType,
        entityType,
        entityId,
        entityLabel,
        details
      );
    } catch (err) {
      console.error('[AUDIT] Error guardando actividad', err);
    }
  }

  async function listUserActivity() {
    return db.all(
      `SELECT id, actor_user_id, actor_username, action_type, entity_type, entity_id, entity_label, details, created_at
       FROM user_activity_logs
       ORDER BY created_at DESC
       LIMIT 200`
    );
  }

  return {
    logUserActivity,
    listUserActivity,
  };
}

function parseCookies(req) {
  const raw = String(req.get('cookie') || '');
  if (!raw) return {};
  const out = {};
  const parts = raw.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch (err) {
      out[key] = value;
    }
  }
  return out;
}

function normalizarActivo(valor, fallback = true) {
  if (valor === undefined || valor === null || valor === '') return Boolean(fallback);
  if (typeof valor === 'boolean') return valor;
  const num = Number(valor);
  if (Number.isFinite(num)) return num !== 0;
  const txt = String(valor).trim().toLowerCase();
  if (['false', 'f', 'no', 'off', 'inactivo', 'inactive', 'no autorizado', 'no_autorizado'].includes(txt)) return false;
  if (['true', 't', 'si', 'on', 'activo', 'active', 'autorizado'].includes(txt)) return true;
  return Boolean(fallback);
}

function normalizarFecha(fecha) {
  if (!fecha || typeof fecha !== 'string') return null;
  const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function calcularEdadDesdeNacimiento(fechaNacimiento) {
  const parts = normalizarFecha(fechaNacimiento);
  if (!parts) return '';
  const now = new Date();
  let edad = now.getFullYear() - parts.year;
  const mesActual = now.getMonth() + 1;
  const diaActual = now.getDate();
  if (
    mesActual < parts.month ||
    (mesActual === parts.month && diaActual < parts.day)
  ) {
    edad -= 1;
  }
  if (!Number.isFinite(edad) || edad < 0) return '';
  return String(edad);
}

function separarNombreCompleto(fullName) {
  const limpio = String(fullName || '').trim();
  if (!limpio) return { nombre: '', apellido: '' };
  const partes = limpio.split(/\s+/);
  const nombre = partes.shift() || '';
  const apellido = partes.join(' ');
  return { nombre, apellido };
}

function parsearModulos(valor) {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor || '')
        .split(',')
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean);
  return Array.from(new Set(lista.filter((item) => ['MII', 'MIS', 'MIE'].includes(item))));
}

function formatearModulos(valor) {
  return parsearModulos(valor).join(', ');
}

function parsearAniosEscolares(valor) {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor || '')
        .split(',')
        .map((item) => String(item || '').trim())
        .filter(Boolean);
  return Array.from(
    new Set(
      lista.filter((item) => ['2026', '2027', '2028', '2029', '2030'].includes(item))
    )
  );
}

function formatearAniosEscolares(valor) {
  return parsearAniosEscolares(valor).join(', ');
}

async function initDb() {
  fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  const SQL = await initSqlJs();
  const database = fs.existsSync(LOCAL_DB_PATH)
    ? new SQL.Database(fs.readFileSync(LOCAL_DB_PATH))
    : new SQL.Database();
  const persist = () => {
    const data = database.export();
    fs.writeFileSync(LOCAL_DB_PATH, Buffer.from(data));
  };
  const db = createLocalDb(database, persist);
  await db.exec('PRAGMA foreign_keys = ON');
  await db.exec(fs.readFileSync(SCHEMA_SQL_PATH, 'utf8'));
  for (const nombre of TRATAMIENTOS_BASE) {
    await db.run('INSERT OR IGNORE INTO treatments (name) VALUES (?)', nombre);
  }
  try {
    await db.run(`DELETE FROM sessions WHERE expires_at <= datetime('now')`);
  } catch (err) {
    // La tabla puede no existir en DBs viejas.
  }
  try {
    const cutoffIso = new Date(
      Date.now() - Math.max(1, LOGIN_RATE_LIMIT_RETENTION_HOURS) * 60 * 60 * 1000
    ).toISOString();
    await db.run(
      'DELETE FROM login_rate_limits WHERE updated_at < ? AND (blocked_until IS NULL OR blocked_until < ?)',
      cutoffIso,
      cutoffIso
    );
  } catch (err) {
    // La tabla puede no existir en DBs viejas.
  }
  console.log(`[DB] Usando SQLite local: ${LOCAL_DB_PATH}`);
  return db;
}

function hashPassword(password) {
  const limpio = String(password || '');
  const salt = crypto.randomBytes(16);
  const iterations = 310000;
  const hash = crypto.pbkdf2Sync(limpio, salt, iterations, 32, 'sha256');
  return `pbkdf2$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  try {
    const limpio = String(password || '');
    const parts = String(stored || '').split('$');
    if (parts.length !== 4) return false;
    const [algo, iterStr, saltB64, hashB64] = parts;
    if (algo !== 'pbkdf2') return false;
    const iterations = Number(iterStr);
    if (!Number.isInteger(iterations) || iterations < 1) return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.pbkdf2Sync(limpio, salt, iterations, expected.length, 'sha256');
    return crypto.timingSafeEqual(expected, actual);
  } catch (err) {
    return false;
  }
}

async function ensureAdminUser(db) {
  let username = String(ADMIN_USERNAME || '').trim();
  let password = String(ADMIN_PASSWORD || '').trim();

  if (!username || !password) {
    const adminExistente = await db.get(
      'SELECT id, username FROM users WHERE is_admin = TRUE ORDER BY id LIMIT 1'
    );
    if (adminExistente) {
      return;
    }
    username = 'admin';
    password = 'admin1234';
  }

  if ((username === 'admin' && password === 'admin') && (IS_PROD && !ALLOW_INSECURE_DEFAULT_ADMIN)) {
    throw new Error(
      '[AUTH] Credenciales inseguras detectadas (admin/admin). Defini ADMIN_USERNAME y ADMIN_PASSWORD seguros.'
    );
  }

  const existente = await db.get('SELECT id, is_admin FROM users WHERE username = ?', username);
  if (existente) {
    if (!Boolean(existente.is_admin)) {
      await db.run('UPDATE users SET is_admin = TRUE WHERE id = ?', existente.id);
    }
    return;
  }
  const hash = hashPassword(password);
  await db.run(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, TRUE)',
    username,
    hash
  );
  if (password === 'admin') {
    console.warn(
      '[AUTH] Se creo el usuario admin con password "admin". Cambialo con ADMIN_PASSWORD.'
    );
  }
}

function buildCorsOptions() {
  const isLocalOrigin = (origin) => {
    try {
      const u = new URL(origin);
      return (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    } catch (err) {
      return false;
    }
  };

  if (!CORS_ALLOWED_ORIGINS.length) {
    // Si no se configura whitelist:
    // - en desarrollo permitir localhost para uso local del frontend
    // - en produccion aceptar solo requests sin Origin (server-side/tools)
    if (!IS_PROD) {
      const localAllowed = new Set([
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ]);
      return {
        credentials: true,
        origin(origin, cb) {
          if (!origin) return cb(null, true);
          if (localAllowed.has(origin)) return cb(null, true);
          if (isLocalOrigin(origin)) return cb(null, true);
          console.error('[CORS] Origin bloqueado:', origin);
          return cb(new Error('CORS origin no permitido'));
        },
      };
    }
    return {
      credentials: true,
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        return cb(new Error('CORS origin no permitido'));
      },
    };
  }
  const allowed = new Set(CORS_ALLOWED_ORIGINS);
  return {
    credentials: true,
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowed.has(origin)) return cb(null, true);
      if (isLocalOrigin(origin)) return cb(null, true);
      console.error('[CORS] Origin bloqueado:', origin);
      return cb(new Error('CORS origin no permitido'));
    },
  };
}

async function crearSesion(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const ttl = Number.isFinite(SESSION_TTL_HOURS) && SESSION_TTL_HOURS > 0 ? SESSION_TTL_HOURS : 12;
  const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString();
  await db.run(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    token,
    userId,
    expiresAt
  );
  return { token, expiresAt };
}

function crearJwtSesion(sessionToken, user) {
  return jwt.sign(
    {
      sid: sessionToken,
      uid: Number(user?.id || 0),
      usr: String(user?.username || ''),
      adm: Boolean(user?.is_admin),
    },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: SESSION_TTL_SECONDS,
    }
  );
}

function extraerTokenSesionDesdeRequest(req) {
  const cookies = parseCookies(req);
  const cookieJwt = String(cookies[JWT_COOKIE_NAME] || '').trim();
  if (cookieJwt) {
    const payload = jwt.verify(cookieJwt, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return {
      sessionToken: String(payload?.sid || '').trim(),
      jwtPayload: payload,
    };
  }

  const header = String(req.get('authorization') || '').trim();
  const [type, token] = header.split(/\s+/);
  if (type !== 'Bearer' || !token) {
    return { sessionToken: '', jwtPayload: null };
  }
  if (token.includes('.')) {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return {
      sessionToken: String(payload?.sid || '').trim(),
      jwtPayload: payload,
    };
  }
  return { sessionToken: token, jwtPayload: null };
}

function crearAuthMiddleware(db) {
  return async function authMiddleware(req, res, next) {
    try {
      const { sessionToken, jwtPayload } = extraerTokenSesionDesdeRequest(req);
      if (!sessionToken) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const session = await db.get(
        `SELECT s.token, s.user_id, s.expires_at, u.username, u.is_admin
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`,
        sessionToken
      );
      if (!session) {
        res.status(401).json({ error: 'Token invalido' });
        return;
      }
      if (jwtPayload && Number(jwtPayload.uid || 0) !== Number(session.user_id || 0)) {
        res.status(401).json({ error: 'Token invalido' });
        return;
      }
      const expiresAt = new Date(session.expires_at);
      if (
        !Number.isFinite(expiresAt.getTime()) ||
        expiresAt.getTime() <= Date.now()
      ) {
        await db.run('DELETE FROM sessions WHERE token = ?', sessionToken);
        res.status(401).json({ error: 'Sesion expirada' });
        return;
      }
      req.auth = {
        userId: session.user_id,
        username: session.username,
        isAdmin: Boolean(session.is_admin),
        token: session.token,
      };
      next();
    } catch (err) {
      if (err && (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError')) {
        res.status(401).json({ error: 'Token invalido' });
        return;
      }
      console.error('[AUTH] Error validando sesion', err);
      res.status(500).json({ error: 'Error de autenticacion' });
    }
  };
}

function validarUsername(usernameRaw) {
  const username = String(usernameRaw || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return '';
  return username;
}

function validarPassword(passwordRaw) {
  const password = String(passwordRaw || '').trim();
  if (password.length < 8) return '';
  return password;
}

function crearAdminMiddleware() {
  return function adminOnly(req, res, next) {
    if (!req.auth?.isAdmin) {
      res.status(403).json({ error: 'Permisos insuficientes' });
      return;
    }
    next();
  };
}

async function obtenerTratamientoId(db, nombre) {
  if (!nombre) return null;
  await db.run('INSERT OR IGNORE INTO treatments (name) VALUES (?)', nombre);
  const fila = await db.get('SELECT id FROM treatments WHERE name = ?', nombre);
  return fila ? fila.id : null;
}

function formatearTurno(dia, hora) {
  return `${dia}-${hora}`;
}

function normalizarMes(mes) {
  const num = Number(mes);
  if (!Number.isInteger(num) || num < 1 || num > 12) return null;
  return num;
}

async function guardarTurnosMensuales(db, patientId, turnosBase) {
  const data = turnosBase && typeof turnosBase === 'object' ? turnosBase : {};
  const tratamientos = Object.keys(data);
  for (const tratamiento of tratamientos) {
    const tratamientoId = await obtenerTratamientoId(db, tratamiento);
    if (!tratamientoId) continue;
    const lista = Array.isArray(data[tratamiento]) ? data[tratamiento] : [];
    for (let mes = 1; mes <= 12; mes += 1) {
      for (const clave of lista) {
        const [dia, hora] = String(clave).split('-');
        if (!dia || !hora) continue;
        await db.run(
          `INSERT OR IGNORE INTO patient_turns_monthly
           (patient_id, treatment_id, month, day_of_week, time)
           VALUES (?, ?, ?, ?, ?)`,
          patientId,
          tratamientoId,
          mes,
          dia,
          hora
        );
      }
    }
  }
}

function obtenerFechaCorteSolicitudes(meses = 12) {
  const mesesHistorial = Number.isFinite(Number(meses))
    ? Math.max(1, Number(meses))
    : 12;
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  cutoff.setUTCMonth(cutoff.getUTCMonth() - mesesHistorial);
  return cutoff.toISOString().slice(0, 10);
}

function construirSolicitud(row, tratamientos = []) {
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaInicio = String(row?.start_date || '').slice(0, 10);
  const fechaFin = String(row?.end_date || '').slice(0, 10);
  const vigente = Boolean(fechaInicio && fechaFin && fechaInicio <= hoy && hoy <= fechaFin);
  const futura = Boolean(fechaInicio && fechaInicio > hoy);
  const vencida = Boolean(fechaFin && fechaFin < hoy);
  return {
    id: row.id,
    fechaInicio,
    fechaFin,
    tratamientos: Array.isArray(tratamientos) ? tratamientos : [],
    aplicaTratamientos:
      row?.apply_treatments === true ||
      row?.apply_treatments === 1 ||
      row?.apply_treatments === '1',
    aplicadaEn: row?.applied_at || '',
    creadaEn: row.created_at || '',
    actualizadaEn: row.updated_at || '',
    vigente,
    futura,
    vencida,
  };
}

async function aplicarSolicitudATratamientosPaciente(db, patientId, requestId) {
  const requestTreatments = await db.all(
    `SELECT treatment_id
     FROM patient_request_treatments
     WHERE request_id = ?`,
    requestId
  );
  const desired = new Set(
    requestTreatments
      .map((r) => Number(r.treatment_id))
      .filter((n) => Number.isInteger(n) && n > 0)
  );
  const currentRows = await db.all(
    `SELECT treatment_id
     FROM patient_treatments
     WHERE patient_id = ?`,
    patientId
  );
  const current = new Set(
    currentRows
      .map((r) => Number(r.treatment_id))
      .filter((n) => Number.isInteger(n) && n > 0)
  );

  const toRemove = [];
  current.forEach((id) => {
    if (!desired.has(id)) toRemove.push(id);
  });
  const toAdd = [];
  desired.forEach((id) => {
    if (!current.has(id)) toAdd.push(id);
  });

  for (const treatmentId of toRemove) {
    await db.run(
      `DELETE FROM patient_treatments
       WHERE patient_id = ? AND treatment_id = ?`,
      patientId,
      treatmentId
    );
    await db.run(
      `DELETE FROM patient_turns
       WHERE patient_id = ? AND treatment_id = ?`,
      patientId,
      treatmentId
    );
    await db.run(
      `DELETE FROM patient_turns_monthly
       WHERE patient_id = ? AND treatment_id = ?`,
      patientId,
      treatmentId
    );
    await db.run(
      `DELETE FROM patient_turns_overrides
       WHERE patient_id = ? AND treatment_id = ?`,
      patientId,
      treatmentId
    );
  }

  for (const treatmentId of toAdd) {
    await db.run(
      `INSERT OR IGNORE INTO patient_treatments (patient_id, treatment_id)
       VALUES (?, ?)`,
      patientId,
      treatmentId
    );
  }

  await db.run(
    `UPDATE patient_requests
     SET applied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    requestId
  );
}

async function aplicarSolicitudesPendientesPaciente(db, patientId) {
  const hoy = new Date().toISOString().slice(0, 10);
  const pendientes = await db.all(
    `SELECT id
     FROM patient_requests
     WHERE patient_id = ?
       AND start_date <= ?
       AND applied_at IS NULL
       AND apply_treatments = TRUE
     ORDER BY start_date ASC, id ASC`,
    patientId,
    hoy
  );
  if (!pendientes.length) return;
  for (const row of pendientes) {
    await aplicarSolicitudATratamientosPaciente(db, patientId, row.id);
  }
}

async function construirPaciente(db, fila) {
  if (!fila) return null;
  await aplicarSolicitudesPendientesPaciente(db, fila.id);
  const nombrePrimario = fila.first_name || '';
  const apellidoPrimario = fila.last_name || '';
  const nombreFallback = separarNombreCompleto(fila.full_name);
  const nombre = nombrePrimario || nombreFallback.nombre;
  const apellido = apellidoPrimario || nombreFallback.apellido;
  const tratamientos = await db.all(
    `SELECT t.name
     FROM patient_treatments pt
     JOIN treatments t ON t.id = pt.treatment_id
     WHERE pt.patient_id = ?`,
    fila.id
  );
  const turnos = await db.all(
    `SELECT t.name AS tratamiento, month, day_of_week, time
     FROM patient_turns_monthly pt
     JOIN treatments t ON t.id = pt.treatment_id
     WHERE pt.patient_id = ?`,
    fila.id
  );
  const asistencias = await db.all(
    `SELECT date, note, treatment_id
     FROM attendances
     WHERE patient_id = ?
     ORDER BY date DESC`,
    fila.id
  );
  const overrides = await db.all(
    `SELECT t.name AS tratamiento, date, time, active
     FROM patient_turns_overrides o
     JOIN treatments t ON t.id = o.treatment_id
     WHERE o.patient_id = ?`,
    fila.id
  );
  const cutoffSolicitudes = obtenerFechaCorteSolicitudes(12);
  const solicitudes = await db.all(
    `SELECT id, patient_id, start_date, end_date, apply_treatments, applied_at, created_at, updated_at
     FROM patient_requests
     WHERE patient_id = ?
       AND (end_date >= ? OR start_date >= ?)
     ORDER BY start_date DESC, id DESC`,
    fila.id,
    cutoffSolicitudes,
    cutoffSolicitudes
  );
  const solicitudesTratamientosRows = await db.all(
    `SELECT prt.request_id, t.name
     FROM patient_request_treatments prt
     JOIN patient_requests pr ON pr.id = prt.request_id
     JOIN treatments t ON t.id = prt.treatment_id
     WHERE pr.patient_id = ?
       AND (pr.end_date >= ? OR pr.start_date >= ?)`,
    fila.id,
    cutoffSolicitudes,
    cutoffSolicitudes
  );
  const tratamientosPorSolicitud = new Map();
  for (const row of solicitudesTratamientosRows) {
    if (!tratamientosPorSolicitud.has(row.request_id)) {
      tratamientosPorSolicitud.set(row.request_id, []);
    }
    tratamientosPorSolicitud.get(row.request_id).push(row.name);
  }
  const turnosPorMes = {};
  for (const t of turnos) {
    const mes = normalizarMes(t.month);
    if (!mes) continue;
    if (!turnosPorMes[mes]) {
      turnosPorMes[mes] = {};
    }
    if (!turnosPorMes[mes][t.tratamiento]) {
      turnosPorMes[mes][t.tratamiento] = [];
    }
    turnosPorMes[mes][t.tratamiento].push(
      formatearTurno(t.day_of_week, t.time)
    );
  }
  return {
    id: fila.id,
    nombre,
    apellido,
    edad: calcularEdadDesdeNacimiento(fila.birth_date) || fila.age || '-',
    fechaNacimiento: fila.birth_date || '',
    condicion: fila.condition || '-',
    ultimaVisita: fila.last_visit || '-',
    ultimoControlFisiatrico: fila.last_fisiatrico || '',
    fechaAltaControlFisiatrico: fila.last_fisiatrico_alta || '',
    fechaVencimientoControlFisiatrico: fila.last_fisiatrico_vencimiento || '',
    ultimoControlTrabajoSocial: fila.last_trabajo_social || '',
    fechaAltaControlTrabajoSocial: fila.last_trabajo_social_alta || '',
    fechaVencimientoControlTrabajoSocial: fila.last_trabajo_social_vencimiento || '',
    dni: fila.dni || '',
    cuit: fila.cuit || '',
    nroAfiliado: fila.affiliate_number || '',
    integracionHorario: fila.integracion_horario || '',
    diagnostico: fila.diagnosis || '',
    padreTutor: fila.father_tutor_name || '',
    telefonoPadreTutor: fila.father_tutor_phone || '',
    madreTutora: fila.mother_tutor_name || '',
    telefonoMadreTutora: fila.mother_tutor_phone || '',
    calle: fila.address_street || '',
    numeracion: fila.address_number || '',
    barrio: fila.address_neighborhood || '',
    piso: fila.address_floor || '',
    sector: fila.address_sector || '',
    escuela: fila.school_name || '',
    anioGrado: fila.school_grade || '',
    turnoEscolar: fila.school_shift || '',
    carAnios: parsearAniosEscolares(fila.car_years),
    ppiAnios: parsearAniosEscolares(fila.ppi_years),
    actaAcuerdoAnios: parsearAniosEscolares(fila.acta_acuerdo_years),
    obraSocial: fila.notes || '',
    autorizadoDesde: fila.authorized_at || '',
    autorizadoHasta: fila.authorization_expires_at || '',
    activo: normalizarActivo(fila.is_active, true),
    estado: normalizarActivo(fila.is_active, true) ? 'autorizado' : 'no_autorizado',
    dadoDeBaja: Boolean(fila.is_discharged),
    fechaBaja: fila.discharged_at || '',
    estadoPaciente: Boolean(fila.is_discharged) ? 'baja' : 'activo',
    parametro: Boolean(fila.parametro),
    modulo: formatearModulos(fila.module_type),
    modulos: parsearModulos(fila.module_type),
    tratamientos: tratamientos.map((t) => t.name),
    turnosPorMes,
    turnosOverrides: overrides.map((o) => ({
      tratamiento: o.tratamiento,
      fecha: o.date,
      hora: o.time,
      activo: normalizarActivo(o.active, false),
    })),
    solicitudes: solicitudes.map((solicitud) =>
      construirSolicitud(
        solicitud,
        (tratamientosPorSolicitud.get(solicitud.id) || []).slice().sort((a, b) => a.localeCompare(b, 'es'))
      )
    ),
    asistencias: asistencias.map((a) => ({
      fecha: a.date,
      nota: a.note || '',
      tratamientoId: a.treatment_id,
    })),
  };
}

async function listarPacientes(db) {
  const filas = await db.all(
    'SELECT * FROM patients ORDER BY created_at DESC'
  );
  // Importante para performance: el listado no debe recalcular/aplicar solicitudes
  // pendientes por cada paciente en tiempo real, porque degrada mucho el refresh.
  // Las solicitudes se aplican al construir el paciente individual (detalle/operaciones).
  const tratamientos = await db.all(
    `SELECT pt.patient_id, t.name
     FROM patient_treatments pt
     JOIN treatments t ON t.id = pt.treatment_id`
  );
  const turnos = await db.all(
    `SELECT pt.patient_id, t.name AS tratamiento, month, day_of_week, time
     FROM patient_turns_monthly pt
     JOIN treatments t ON t.id = pt.treatment_id`
  );
  const overrides = await db.all(
    `SELECT o.patient_id, t.name AS tratamiento, date, time, active
     FROM patient_turns_overrides o
     JOIN treatments t ON t.id = o.treatment_id`
  );
  const cutoffSolicitudes = obtenerFechaCorteSolicitudes(12);
  const solicitudes = await db.all(
    `SELECT id, patient_id, start_date, end_date, apply_treatments, applied_at, created_at, updated_at
     FROM patient_requests
     WHERE end_date >= ? OR start_date >= ?
     ORDER BY start_date DESC, id DESC`,
    cutoffSolicitudes,
    cutoffSolicitudes
  );
  const solicitudesTratamientosRows = await db.all(
    `SELECT prt.request_id, pr.patient_id, t.name
     FROM patient_request_treatments prt
     JOIN patient_requests pr ON pr.id = prt.request_id
     JOIN treatments t ON t.id = prt.treatment_id
     WHERE pr.end_date >= ? OR pr.start_date >= ?`,
    cutoffSolicitudes,
    cutoffSolicitudes
  );
  const tratamientosPorPaciente = new Map();
  for (const t of tratamientos) {
    if (!tratamientosPorPaciente.has(t.patient_id)) {
      tratamientosPorPaciente.set(t.patient_id, []);
    }
    tratamientosPorPaciente.get(t.patient_id).push(t.name);
  }
  const turnosPorPaciente = new Map();
  for (const t of turnos) {
    const mes = normalizarMes(t.month);
    if (!mes) continue;
    if (!turnosPorPaciente.has(t.patient_id)) {
      turnosPorPaciente.set(t.patient_id, {});
    }
    const porMes = turnosPorPaciente.get(t.patient_id);
    if (!porMes[mes]) porMes[mes] = {};
    if (!porMes[mes][t.tratamiento]) {
      porMes[mes][t.tratamiento] = [];
    }
    porMes[mes][t.tratamiento].push(
      formatearTurno(t.day_of_week, t.time)
    );
  }
  const overridesPorPaciente = new Map();
  for (const o of overrides) {
    if (!overridesPorPaciente.has(o.patient_id)) {
      overridesPorPaciente.set(o.patient_id, []);
    }
    overridesPorPaciente.get(o.patient_id).push({
      tratamiento: o.tratamiento,
      fecha: o.date,
      hora: o.time,
      activo: normalizarActivo(o.active, false),
    });
  }
  const tratamientosPorSolicitud = new Map();
  for (const row of solicitudesTratamientosRows) {
    if (!tratamientosPorSolicitud.has(row.request_id)) {
      tratamientosPorSolicitud.set(row.request_id, []);
    }
    tratamientosPorSolicitud.get(row.request_id).push(row.name);
  }
  const solicitudesPorPaciente = new Map();
  for (const row of solicitudes) {
    if (!solicitudesPorPaciente.has(row.patient_id)) {
      solicitudesPorPaciente.set(row.patient_id, []);
    }
    solicitudesPorPaciente.get(row.patient_id).push(
      construirSolicitud(
        row,
        (tratamientosPorSolicitud.get(row.id) || []).slice().sort((a, b) => a.localeCompare(b, 'es'))
      )
    );
  }
  const normalizarTextoOrden = (valor) =>
    String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const pacientesMapeados = filas.map((fila) => ({
		    id: fila.id,
		    nombre: fila.first_name || separarNombreCompleto(fila.full_name).nombre,
		    apellido: fila.last_name || separarNombreCompleto(fila.full_name).apellido,
		    edad: calcularEdadDesdeNacimiento(fila.birth_date) || fila.age || '-',
		    fechaNacimiento: fila.birth_date || '',
		    condicion: fila.condition || '-',
	    ultimaVisita: fila.last_visit || '-',
	    ultimoControlFisiatrico: fila.last_fisiatrico || '',
      fechaAltaControlFisiatrico: fila.last_fisiatrico_alta || '',
      fechaVencimientoControlFisiatrico: fila.last_fisiatrico_vencimiento || '',
      ultimoControlTrabajoSocial: fila.last_trabajo_social || '',
      fechaAltaControlTrabajoSocial: fila.last_trabajo_social_alta || '',
      fechaVencimientoControlTrabajoSocial: fila.last_trabajo_social_vencimiento || '',
	    dni: fila.dni || '',
	    cuit: fila.cuit || '',
	    nroAfiliado: fila.affiliate_number || '',
	    integracionHorario: fila.integracion_horario || '',
	    diagnostico: fila.diagnosis || '',
	    padreTutor: fila.father_tutor_name || '',
	    telefonoPadreTutor: fila.father_tutor_phone || '',
	    madreTutora: fila.mother_tutor_name || '',
	    telefonoMadreTutora: fila.mother_tutor_phone || '',
	    calle: fila.address_street || '',
	    numeracion: fila.address_number || '',
	    barrio: fila.address_neighborhood || '',
	    piso: fila.address_floor || '',
	    sector: fila.address_sector || '',
	    escuela: fila.school_name || '',
	    anioGrado: fila.school_grade || '',
	    turnoEscolar: fila.school_shift || '',
      carAnios: parsearAniosEscolares(fila.car_years),
      ppiAnios: parsearAniosEscolares(fila.ppi_years),
      actaAcuerdoAnios: parsearAniosEscolares(fila.acta_acuerdo_years),
		    obraSocial: fila.notes || '',
        autorizadoDesde: fila.authorized_at || '',
        autorizadoHasta: fila.authorization_expires_at || '',
		    activo: normalizarActivo(fila.is_active, true),
		    estado: normalizarActivo(fila.is_active, true) ? 'autorizado' : 'no_autorizado',
		    dadoDeBaja: Boolean(fila.is_discharged),
		    fechaBaja: fila.discharged_at || '',
		    estadoPaciente: Boolean(fila.is_discharged) ? 'baja' : 'activo',
		    parametro: Boolean(fila.parametro),
	    modulo: formatearModulos(fila.module_type),
      modulos: parsearModulos(fila.module_type),
	    tratamientos: tratamientosPorPaciente.get(fila.id) || [],
	    turnosPorMes: turnosPorPaciente.get(fila.id) || {},
    turnosOverrides: overridesPorPaciente.get(fila.id) || [],
    solicitudes: solicitudesPorPaciente.get(fila.id) || [],
    asistencias: [],
  }));

  pacientesMapeados.sort((a, b) => {
    const aApellido = normalizarTextoOrden(a.apellido);
    const bApellido = normalizarTextoOrden(b.apellido);
    const cmpApellido = aApellido.localeCompare(bApellido, 'es');
    if (cmpApellido !== 0) return cmpApellido;
    const aNombre = normalizarTextoOrden(a.nombre);
    const bNombre = normalizarTextoOrden(b.nombre);
    const cmpNombre = aNombre.localeCompare(bNombre, 'es');
    if (cmpNombre !== 0) return cmpNombre;
    return String(a.id || '').localeCompare(String(b.id || ''), 'es');
  });

  return pacientesMapeados;
}

async function main() {
  if (!JWT_SECRET) {
    throw new Error('[AUTH] Falta JWT_SECRET en produccion.');
  }
  if (!IS_PROD && JWT_SECRET === 'dev-only-change-this-jwt-secret') {
    console.warn('[AUTH] Usando JWT_SECRET de desarrollo. Configuralo en entorno para mayor seguridad.');
  }
  const db = await initDb();
  await ensureAdminUser(db);
  const loginRateLimiter = createLoginRateLimiter(db);
  const auditLogger = createAuditLogger(db);
  await loginRateLimiter.pruneLoginRateLimitState();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', IS_PROD ? true : false);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (IS_PROD) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '200kb' }));
  const authMiddleware = crearAuthMiddleware(db);
  const adminMiddleware = crearAdminMiddleware();

  registerAuthRoutes(app, {
    db,
    authMiddleware,
    getClientIp,
    getLoginBlockRemainingMs: loginRateLimiter.getLoginBlockRemainingMs,
    registerFailedLoginAttempt: loginRateLimiter.registerFailedLoginAttempt,
    clearFailedLoginAttempts: loginRateLimiter.clearFailedLoginAttempts,
    debugRateLimit: loginRateLimiter.debugRateLimit,
    verifyPassword,
    crearSesion,
    crearJwtSesion,
    JWT_COOKIE_NAME,
    JWT_COOKIE_SAMESITE,
    JWT_COOKIE_SECURE,
    SESSION_TTL_SECONDS,
    validarPassword,
    hashPassword,
  });

  registerApiAuthGuard(app, { authMiddleware });

  registerUsersRoutes(app, {
    db,
    adminMiddleware,
    validarUsername,
    validarPassword,
    hashPassword,
    getBlockedUsers: loginRateLimiter.getBlockedUsers,
    clearBlockedUser: loginRateLimiter.clearBlockedUser,
    listUserActivity: auditLogger.listUserActivity,
    logUserActivity: auditLogger.logUserActivity,
  });

  registerPatientsRoutes(app, {
    db,
    listarPacientes,
    construirPaciente,
    normalizarFecha,
    calcularEdadDesdeNacimiento,
    obtenerTratamientoId,
    guardarTurnosMensuales,
    normalizarMes,
    DIAS_VALIDOS,
    DIAS_INDICE,
    logUserActivity: auditLogger.logUserActivity,
  });

  registerObrasSocialesRoutes(app, { db, construirPaciente });

  registerAttendancesExportRoute(app, { db, construirPaciente });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.listen(PORT, () => {
    console.log(`API escuchando en http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
