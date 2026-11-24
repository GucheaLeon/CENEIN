'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// ─── Funciones de Seguridad y Autenticación ───────────────────────────────────

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

function verificarPermisoAdmin(req) {
  return Boolean(req && req.auth && req.auth.isAdmin === true);
}

function normalizarLoginScopeValue(val) {
  return String(val || '').trim().toLowerCase();
}

function getLoginRateLimitUserKey(username) {
  const safe = normalizarLoginScopeValue(username);
  if (!safe) return '';
  return `user:${safe}`;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Seguridad y Autenticación Backend', () => {
  describe('Hash y Verificación de Contraseñas (PBKDF2)', () => {
    it('debe generar un hash con formato pbkdf2$iteraciones$salt$hash', () => {
      const hash = hashPassword('MiClaveSegura123!');
      assert.ok(hash.startsWith('pbkdf2$310000$'));
      const partes = hash.split('$');
      assert.strictEqual(partes.length, 4);
    });

    it('debe verificar exitosamente una contraseña correcta contra su hash', () => {
      const clave = 'AdminPass2026';
      const hash = hashPassword(clave);
      const esValida = verifyPassword(clave, hash);
      assert.strictEqual(esValida, true);
    });

    it('debe rechazar una contraseña incorrecta', () => {
      const hash = hashPassword('ClaveOriginal');
      const esValida = verifyPassword('ClaveIncorrecta', hash);
      assert.strictEqual(esValida, false);
    });

    it('debe manejar hashes corruptos o inválidos de forma segura sin lanzar excepción', () => {
      assert.strictEqual(verifyPassword('clave', 'formato_invalido'), false);
      assert.strictEqual(verifyPassword('clave', 'pbkdf2$invalido$salt$hash'), false);
      assert.strictEqual(verifyPassword('clave', null), false);
    });
  });

  describe('Control de Acceso y Roles (RBAC)', () => {
    it('debe permitir acceso a usuarios con rol admin', () => {
      const req = { auth: { userId: 1, username: 'admin', isAdmin: true } };
      assert.strictEqual(verificarPermisoAdmin(req), true);
    });

    it('debe denegar acceso a usuarios sin rol admin o no autenticados', () => {
      const reqUser = { auth: { userId: 2, username: 'operador', isAdmin: false } };
      assert.strictEqual(verificarPermisoAdmin(reqUser), false);

      const reqAnonimo = { auth: null };
      assert.strictEqual(verificarPermisoAdmin(reqAnonimo), false);
    });
  });

  describe('Generación de Claves para Rate Limiting de Login', () => {
    it('debe generar una clave de usuario normalizada en minúsculas', () => {
      const key = getLoginRateLimitUserKey('  AdminUser@Cenein.Com  ');
      assert.strictEqual(key, 'user:adminuser@cenein.com');
    });

    it('debe retornar cadena vacía para nombres de usuario vacíos', () => {
      assert.strictEqual(getLoginRateLimitUserKey('   '), '');
      assert.strictEqual(getLoginRateLimitUserKey(null), '');
    });
  });
});
