function registerUsersRoutes(
  app,
  { db, adminMiddleware, validarUsername, validarPassword, hashPassword, getBlockedUsers, clearBlockedUser, listUserActivity, logUserActivity }
) {
  app.get('/api/users', adminMiddleware, async (req, res) => {
    const rows = await db.all(
      `SELECT id, username, is_admin, created_at
       FROM users
       ORDER BY username ASC`
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        username: r.username,
        isAdmin: Boolean(r.is_admin),
        createdAt: r.created_at,
      }))
    );
  });

  app.get('/api/users/blocked', adminMiddleware, async (req, res) => {
    try {
      const rows = await getBlockedUsers();
      res.json(
        rows.map((row) => ({
          username: String(row.scope_key || '').replace(/^user:/, ''),
          failedCount: Number(row.failed_count || 0),
          blockedUntil: row.blocked_until || '',
          updatedAt: row.updated_at || '',
        }))
      );
    } catch (err) {
      console.error('[USERS] Error listando usuarios bloqueados', err);
      res.status(500).json({ error: 'No se pudieron cargar los usuarios bloqueados' });
    }
  });

  app.post('/api/users/blocked/:username/unlock', adminMiddleware, async (req, res) => {
    try {
      const username = validarUsername(req.params.username);
      if (!username) {
        res.status(400).json({ error: 'Username invalido' });
        return;
      }
      await clearBlockedUser(username);
      res.json({ ok: true });
    } catch (err) {
      console.error('[USERS] Error desbloqueando usuario', err);
      res.status(500).json({ error: 'No se pudo desbloquear el usuario' });
    }
  });

  app.get('/api/users/activity', adminMiddleware, async (req, res) => {
    try {
      const rows = await listUserActivity();
      res.json(
        rows.map((row) => ({
          id: Number(row.id || 0),
          actorUserId: row.actor_user_id != null ? Number(row.actor_user_id) : null,
          actorUsername: row.actor_username || '',
          actionType: row.action_type || '',
          entityType: row.entity_type || '',
          entityId: row.entity_id || '',
          entityLabel: row.entity_label || '',
          details: row.details || '',
          createdAt: row.created_at || '',
        }))
      );
    } catch (err) {
      console.error('[USERS] Error listando actividad', err);
      res.status(500).json({ error: 'No se pudo cargar el historial de actividad' });
    }
  });

  app.post('/api/users', adminMiddleware, async (req, res) => {
    try {
      const username = validarUsername(req.body?.username);
      const password = validarPassword(req.body?.password);
      const isAdmin = Boolean(req.body?.isAdmin);
      if (!username) {
        res.status(400).json({ error: 'Username invalido (3-40, letras/numeros/._-)' });
        return;
      }
      if (!password) {
        res.status(400).json({ error: 'Password invalida (minimo 8 caracteres)' });
        return;
      }
      const exists = await db.get('SELECT id FROM users WHERE username = ?', username);
      if (exists) {
        res.status(409).json({ error: 'El usuario ya existe' });
        return;
      }
      const hash = hashPassword(password);
      const result = await db.run(
        'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
        username,
        hash,
        isAdmin
      );
      
      const userId = result.lastID;
      
      if (userId) {
        if (isAdmin) {
          await db.run('INSERT INTO roles (name) VALUES ($1) ON CONFLICT DO NOTHING', 'ADMIN');
          const role = await db.get('SELECT id FROM roles WHERE name = $1', 'ADMIN');
          if (role) {
            await db.run('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', userId, role.id);
          }
        } else {
          await db.run('INSERT INTO roles (name) VALUES ($1) ON CONFLICT DO NOTHING', 'USER');
          const role = await db.get('SELECT id FROM roles WHERE name = $1', 'USER');
          if (role) {
            await db.run('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', userId, role.id);
          }
        }
      }
      const created = await db.get(
        'SELECT id, username, is_admin, created_at FROM users WHERE username = ?',
        username
      );
      await logUserActivity(req, {
        actionType: 'create',
        entityType: 'user',
        entityId: created.id,
        entityLabel: created.username,
        details: { isAdmin: Boolean(created.is_admin) },
      });
      res.status(201).json({
        id: created.id,
        username: created.username,
        isAdmin: Boolean(created.is_admin),
        createdAt: created.created_at,
      });
    } catch (err) {
      console.error('[USERS] Error creando usuario', err);
      res.status(500).json({ error: 'No se pudo crear el usuario' });
    }
  });

  app.patch('/api/users/:id', adminMiddleware, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId < 1) {
        res.status(400).json({ error: 'Usuario invalido' });
        return;
      }
      const target = await db.get('SELECT id, username, is_admin FROM users WHERE id = ?', userId);
      if (!target) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'isAdmin')) {
        const nextIsAdmin = Boolean(req.body?.isAdmin);
        if (target.id === req.auth.userId && !nextIsAdmin) {
          res.status(400).json({ error: 'No puedes quitarte permisos de admin' });
          return;
        }
        if (!nextIsAdmin && Boolean(target.is_admin)) {
          const countAdmins = await db.get('SELECT COUNT(1) AS c FROM users WHERE is_admin = TRUE');
          if (Number(countAdmins?.c || 0) <= 1) {
            res.status(400).json({ error: 'Debe existir al menos un admin' });
            return;
          }
        }
        await db.run('UPDATE users SET is_admin = ? WHERE id = ?', nextIsAdmin, userId);
        
        if (nextIsAdmin) {
          await db.run('INSERT INTO roles (name) VALUES ($1) ON CONFLICT DO NOTHING', 'ADMIN');
          const role = await db.get('SELECT id FROM roles WHERE name = $1', 'ADMIN');
          if (role) {
             await db.run('DELETE FROM user_roles WHERE user_id = $1', userId);
             await db.run('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', userId, role.id);
          }
        } else {
          await db.run('INSERT INTO roles (name) VALUES ($1) ON CONFLICT DO NOTHING', 'USER');
          const role = await db.get('SELECT id FROM roles WHERE name = $1', 'USER');
          if (role) {
             await db.run('DELETE FROM user_roles WHERE user_id = $1', userId);
             await db.run('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', userId, role.id);
          }
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'password')) {
        const newPassword = validarPassword(req.body?.password);
        if (!newPassword) {
          res.status(400).json({ error: 'Password invalida (minimo 8 caracteres)' });
          return;
        }
        const hash = hashPassword(newPassword);
        await db.run('UPDATE users SET password_hash = ? WHERE id = ?', hash, userId);
        await db.run('DELETE FROM sessions WHERE user_id = ?', userId);
      }

      const updated = await db.get(
        'SELECT id, username, is_admin, created_at FROM users WHERE id = ?',
        userId
      );
      res.json({
        id: updated.id,
        username: updated.username,
        isAdmin: Boolean(updated.is_admin),
        createdAt: updated.created_at,
      });
    } catch (err) {
      console.error('[USERS] Error actualizando usuario', err);
      res.status(500).json({ error: 'No se pudo actualizar el usuario' });
    }
  });

  app.delete('/api/users/:id', adminMiddleware, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId < 1) {
        res.status(400).json({ error: 'Usuario invalido' });
        return;
      }
      if (userId === req.auth.userId) {
        res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
        return;
      }
      const target = await db.get('SELECT id, username, is_admin FROM users WHERE id = ?', userId);
      if (!target) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }
      if (Boolean(target.is_admin)) {
        const countAdmins = await db.get('SELECT COUNT(1) AS c FROM users WHERE is_admin = TRUE');
        if (Number(countAdmins?.c || 0) <= 1) {
          res.status(400).json({ error: 'Debe existir al menos un admin' });
          return;
        }
      }
      await db.run('DELETE FROM users WHERE id = ?', userId);
      await logUserActivity(req, {
        actionType: 'delete',
        entityType: 'user',
        entityId: target.id,
        entityLabel: target.username || `user-${target.id}`,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[USERS] Error eliminando usuario', err);
      res.status(500).json({ error: 'No se pudo eliminar el usuario' });
    }
  });
}

module.exports = { registerUsersRoutes };
