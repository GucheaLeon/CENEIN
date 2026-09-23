const { MODULE_KEYS } = require('../permissions');

function registerUsersRoutes(
  app,
  { db, adminMiddleware, validarUsername, validarPassword, hashPassword, getBlockedUsers, clearBlockedUser, listUserActivity, logUserActivity }
) {
  app.get('/api/roles', adminMiddleware, async (req, res) => {
    try {
      const rows = await db.all(
        `SELECT r.id, r.name, r.is_system, rp.module_key
         FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.can_use = TRUE
         WHERE upper(r.name) <> 'ADMIN'
         ORDER BY r.is_system DESC, lower(r.name), rp.module_key`
      );
      const rolesById = new Map();
      for (const row of rows) {
        const id = Number(row.id);
        if (!rolesById.has(id)) {
          rolesById.set(id, {
            id,
            name: String(row.name || ''),
            isSystem: Boolean(row.is_system),
            modules: [],
          });
        }
        const moduleKey = String(row.module_key || '');
        if (MODULE_KEYS.has(moduleKey)) rolesById.get(id).modules.push(moduleKey);
      }
      res.json(Array.from(rolesById.values()));
    } catch (err) {
      console.error('[USERS] Error listando roles', err);
      res.status(500).json({ error: 'No se pudieron cargar los roles' });
    }
  });

  app.post('/api/roles', adminMiddleware, async (req, res) => {
    let roleId = null;
    try {
      const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
      const rawModules = Array.isArray(req.body?.modules) ? req.body.modules : [];
      const invalidModules = rawModules.filter((moduleKey) => !MODULE_KEYS.has(String(moduleKey)));
      const modules = Array.from(new Set(rawModules.map((moduleKey) => String(moduleKey))));

      if (name.length < 2 || name.length > 40) {
        res.status(400).json({ error: 'El nombre del rol debe tener entre 2 y 40 caracteres.' });
        return;
      }
      if (['ADMIN', 'USER'].includes(name.toUpperCase())) {
        res.status(400).json({ error: 'Ese nombre está reservado para un rol del sistema.' });
        return;
      }
      if (invalidModules.length > 0) {
        res.status(400).json({ error: 'El rol contiene módulos no válidos.' });
        return;
      }
      if (modules.length === 0) {
        res.status(400).json({ error: 'Selecciona al menos un módulo para el rol.' });
        return;
      }
      const exists = await db.get('SELECT id FROM roles WHERE lower(name) = lower($1)', name);
      if (exists) {
        res.status(409).json({ error: 'Ya existe un rol con ese nombre.' });
        return;
      }

      const created = await db.run('INSERT INTO roles (name, is_system) VALUES ($1, FALSE)', name);
      roleId = Number(created.lastID || 0);
      if (!roleId) throw new Error('No se pudo recuperar el identificador del rol creado');
      for (const moduleKey of modules) {
        await db.run(
          'INSERT INTO role_permissions (role_id, module_key, can_use) VALUES ($1, $2, TRUE)',
          roleId,
          moduleKey
        );
      }
      await logUserActivity(req, {
        actionType: 'create',
        entityType: 'role',
        entityId: roleId,
        entityLabel: name,
        details: { modules },
      });
      res.status(201).json({ id: roleId, name, isSystem: false, modules });
    } catch (err) {
      if (roleId) {
        try {
          await db.run('DELETE FROM roles WHERE id = $1', roleId);
        } catch (cleanupErr) {
          console.error('[USERS] Error limpiando rol incompleto', cleanupErr);
        }
      }
      console.error('[USERS] Error creando rol', err);
      res.status(500).json({ error: 'No se pudo crear el rol' });
    }
  });

  app.get('/api/users', adminMiddleware, async (req, res) => {
    const rows = await db.all(
      `SELECT u.id, u.username, u.is_admin, u.created_at,
              assigned.role_id, assigned.role_name
       FROM users u
       LEFT JOIN LATERAL (
         SELECT r.id AS role_id, r.name AS role_name
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.id
         ORDER BY CASE WHEN upper(r.name) = 'ADMIN' THEN 0 ELSE 1 END, r.id
         LIMIT 1
       ) assigned ON TRUE
       ORDER BY u.username ASC`
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        username: r.username,
        isAdmin: Boolean(r.is_admin),
        roleId: r.role_id != null ? Number(r.role_id) : null,
        roleName: Boolean(r.is_admin)
          ? 'Administrador'
          : String(r.role_name || '').toUpperCase() === 'USER'
            ? 'Operador'
            : String(r.role_name || 'Operador'),
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

      let selectedRole;
      if (isAdmin) {
        selectedRole = await db.get("SELECT id, name FROM roles WHERE upper(name) = 'ADMIN' LIMIT 1");
      } else if (req.body?.roleId != null && String(req.body.roleId).trim() !== '') {
        const roleId = Number(req.body.roleId);
        if (!Number.isInteger(roleId) || roleId < 1) {
          res.status(400).json({ error: 'Rol inválido.' });
          return;
        }
        selectedRole = await db.get('SELECT id, name FROM roles WHERE id = $1', roleId);
        if (selectedRole && String(selectedRole.name || '').toUpperCase() === 'ADMIN') {
          res.status(400).json({ error: 'El rol de Administrador se asigna mediante su permiso especial.' });
          return;
        }
      } else {
        selectedRole = await db.get("SELECT id, name FROM roles WHERE upper(name) = 'USER' LIMIT 1");
      }
      if (!selectedRole) {
        res.status(400).json({ error: 'Selecciona un rol válido para el usuario.' });
        return;
      }

      const hash = hashPassword(password);
      const created = await db.get(
        `WITH new_user AS (
           INSERT INTO users (username, password_hash, is_admin)
           VALUES ($1, $2, $3)
           RETURNING id, username, is_admin, created_at
         ), role_link AS (
           INSERT INTO user_roles (user_id, role_id)
           SELECT id, $4 FROM new_user
           RETURNING user_id
         )
         SELECT new_user.* FROM new_user JOIN role_link ON role_link.user_id = new_user.id`,
        username,
        hash,
        isAdmin,
        selectedRole.id
      );
      await logUserActivity(req, {
        actionType: 'create',
        entityType: 'user',
        entityId: created.id,
        entityLabel: created.username,
        details: { isAdmin: Boolean(created.is_admin), roleName: selectedRole.name },
      });
      res.status(201).json({
        id: created.id,
        username: created.username,
        isAdmin: Boolean(created.is_admin),
        roleId: Number(selectedRole.id),
        roleName: Boolean(created.is_admin) ? 'Administrador' : String(selectedRole.name || 'Operador'),
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
