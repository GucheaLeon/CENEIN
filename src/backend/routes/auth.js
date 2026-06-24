function registerApiAuthGuard(app, { authMiddleware, publicPaths = ['/auth/login'] }) {
  const allowed = new Set(publicPaths.map((v) => String(v || '').trim()));
  app.use('/api', (req, res, next) => {
    if (allowed.has(req.path)) return next();
    return authMiddleware(req, res, next);
  });
}

function registerAuthRoutes(
  app,
  {
    db,
    authMiddleware,
    getClientIp,
    getLoginBlockRemainingMs,
    registerFailedLoginAttempt,
    clearFailedLoginAttempts,
    debugRateLimit,
    verifyPassword,
    crearSesion,
    crearJwtSesion,
    JWT_COOKIE_NAME,
    JWT_COOKIE_SAMESITE,
    JWT_COOKIE_SECURE,
    SESSION_TTL_SECONDS,
    validarPassword,
    hashPassword,
  }
) {
  app.post('/api/auth/login', async (req, res) => {
    try {
      const ip = getClientIp(req);
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '').trim();
      debugRateLimit?.('login-request', {
        ip,
        username: String(username || '').trim().toLowerCase(),
        forwardedFor: String(req.get('x-forwarded-for') || ''),
        cfConnectingIp: String(req.get('cf-connecting-ip') || ''),
      });
      if (!username || !password) {
        res.status(400).json({ error: 'Usuario y password son requeridos' });
        return;
      }
      const blockRemainingMs = await getLoginBlockRemainingMs(ip, username);
      if (blockRemainingMs > 0) {
        debugRateLimit?.('login-blocked', {
          ip,
          username: String(username || '').trim().toLowerCase(),
          retryAfterSeconds: Math.ceil(blockRemainingMs / 1000),
        });
        res.status(429).json({
          error: 'Demasiados intentos fallidos. Intenta nuevamente en 30 minutos.',
          retryAfterSeconds: Math.ceil(blockRemainingMs / 1000),
        });
        return;
      }
      const user = await db.get(
        'SELECT id, username, password_hash, is_admin FROM users WHERE username = ?',
        username
      );
      if (!user) {
        const attempt = await registerFailedLoginAttempt(ip, username);
        if (attempt.blockedUntil) {
          debugRateLimit?.('login-blocked-after-failure', {
            ip,
            username: String(username || '').trim().toLowerCase(),
            retryAfterSeconds: Math.ceil((attempt.blockedUntil - Date.now()) / 1000),
          });
          res.status(429).json({
            error: 'Demasiados intentos fallidos. Intenta nuevamente en 30 minutos.',
            retryAfterSeconds: Math.ceil((attempt.blockedUntil - Date.now()) / 1000),
          });
          return;
        }
        res.status(401).json({ error: 'Credenciales invalidas' });
        return;
      }
      const ok = verifyPassword(password, user.password_hash);
      if (!ok) {
        const attempt = await registerFailedLoginAttempt(ip, username);
        if (attempt.blockedUntil) {
          debugRateLimit?.('login-blocked-after-failure', {
            ip,
            username: String(username || '').trim().toLowerCase(),
            retryAfterSeconds: Math.ceil((attempt.blockedUntil - Date.now()) / 1000),
          });
          res.status(429).json({
            error: 'Demasiados intentos fallidos. Intenta nuevamente en 30 minutos.',
            retryAfterSeconds: Math.ceil((attempt.blockedUntil - Date.now()) / 1000),
          });
          return;
        }
        res.status(401).json({ error: 'Credenciales invalidas' });
        return;
      }
      await clearFailedLoginAttempts(ip, username);
      const session = await crearSesion(db, user.id);
      const jwtToken = crearJwtSesion(session.token, user);
      res.cookie(JWT_COOKIE_NAME, jwtToken, {
        httpOnly: true,
        secure: JWT_COOKIE_SECURE,
        sameSite: JWT_COOKIE_SAMESITE,
        path: '/',
        maxAge: SESSION_TTL_SECONDS * 1000,
      });
      res.json({
        token: jwtToken,
        expiresAt: session.expiresAt,
        user: { username: user.username, isAdmin: Boolean(user.is_admin) },
      });
    } catch (err) {
      console.error('[AUTH] Error en login', err);
      res.status(500).json({ error: 'No se pudo iniciar sesion' });
    }
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ username: req.auth?.username || '', isAdmin: Boolean(req.auth?.isAdmin) });
  });

  app.post('/api/auth/logout', authMiddleware, async (req, res) => {
    try {
      await db.run('DELETE FROM sessions WHERE token = ?', req.auth.token);
      res.clearCookie(JWT_COOKIE_NAME, {
        httpOnly: true,
        secure: JWT_COOKIE_SECURE,
        sameSite: JWT_COOKIE_SAMESITE,
        path: '/',
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[AUTH] Error cerrando sesion', err);
      res.status(500).json({ error: 'No se pudo cerrar sesion' });
    }
  });

  app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
      const currentPassword = String(req.body?.currentPassword || '').trim();
      const newPassword = validarPassword(req.body?.newPassword);
      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Password actual y nueva password (min 8) son requeridas' });
        return;
      }
      const user = await db.get('SELECT id, password_hash FROM users WHERE id = ?', req.auth.userId);
      if (!user || !verifyPassword(currentPassword, user.password_hash)) {
        res.status(401).json({ error: 'Credenciales invalidas' });
        return;
      }
      const hash = hashPassword(newPassword);
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?', hash, req.auth.userId);
      await db.run('DELETE FROM sessions WHERE user_id = ? AND token <> ?', req.auth.userId, req.auth.token);
      res.json({ ok: true });
    } catch (err) {
      console.error('[AUTH] Error cambiando password', err);
      res.status(500).json({ error: 'No se pudo cambiar la password' });
    }
  });
}

module.exports = {
  registerApiAuthGuard,
  registerAuthRoutes,
};
