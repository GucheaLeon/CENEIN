const MODULES = Object.freeze([
  { key: 'patients', label: 'Pacientes (lista y buscador)' },
  { key: 'alta', label: 'Alta de pacientes' },
  { key: 'attendances', label: 'Asistencias' },
  { key: 'admission', label: 'Admisión' },
  { key: 'billing', label: 'Facturación' },
  { key: 'reports', label: 'Informes y planes' },
]);

const MODULE_KEYS = new Set(MODULES.map((module) => module.key));

async function getRoleAccess(db, userId, isAdmin) {
  if (isAdmin) {
    return {
      roleId: null,
      roleName: 'Administrador',
      modules: MODULES.map((module) => module.key),
    };
  }

  let role = await db.get(
    `SELECT r.id, r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND upper(r.name) <> 'ADMIN'
     ORDER BY CASE WHEN upper(r.name) = 'USER' THEN 0 ELSE 1 END, r.id
     LIMIT 1`,
    userId
  );
  if (!role) {
    role = await db.get("SELECT id, name FROM roles WHERE upper(name) = 'USER' LIMIT 1");
  }
  if (!role) return { roleId: null, roleName: '', modules: [] };

  const rows = await db.all(
    `SELECT module_key
     FROM role_permissions
     WHERE role_id = $1 AND can_use = TRUE
     ORDER BY module_key`,
    role.id
  );
  return {
    roleId: Number(role.id),
    roleName: String(role.name || ''),
    modules: rows.map((row) => String(row.module_key || '')).filter((key) => MODULE_KEYS.has(key)),
  };
}

function resolveModuleForRequest(pathValue, methodValue) {
  const path = (String(pathValue || '').toLowerCase().replace(/\/+$/, '') || '/');
  const method = String(methodValue || 'GET').toUpperCase();

  if (path === '/auth' || path.startsWith('/auth/')) return null;
  if (path === '/users' || path.startsWith('/users/')) return null;
  if (path === '/admisiones' || path.startsWith('/admisiones/')) return 'admission';
  if (path === '/facturacion' || path.startsWith('/facturacion/')) return 'billing';
  if (path === '/reports' || path.startsWith('/reports/')) return 'reports';
  if (path === '/attendances/export') return 'attendances';
  if (path === '/catalogs' || path.startsWith('/catalogs/')) return '*';
  if (path === '/obras-sociales') return '*';
  if (/^\/obras-sociales\/[^/]+\/preview$/.test(path)) return ['patients', 'alta'];

  if (path === '/patients' || path.startsWith('/patients/')) {
    if (/^\/patients\/[^/]+\/obras-sociales\/[^/]+(?:\/preview)?$/.test(path)) {
      return ['patients', 'alta'];
    }
    if (/^\/patients\/[^/]+\/attendances(?:\/|$)/.test(path)) return 'attendances';
    if (/^\/patients\/[^/]+\/requests$/.test(path)) return 'patients';
    if (path === '/patients/turns' || path.startsWith('/patients/turns/')) return 'attendances';
    if (path === '/patients' && method === 'POST') return 'alta';
    if (path === '/patients' && (method === 'GET' || method === 'HEAD')) {
      return ['patients', 'alta', 'attendances', 'reports'];
    }
    if (/^\/patients\/[^/]+$/.test(path) && (method === 'GET' || method === 'HEAD')) {
      return 'patients';
    }
    if (method === 'GET' || method === 'HEAD') return false;
    return 'patients';
  }

  return false;
}

function createModulePermissionMiddleware() {
  return function modulePermissionGuard(req, res, next) {
    if (req.auth?.isAdmin) return next();

    const moduleKey = resolveModuleForRequest(req.path, req.method);
    if (moduleKey === null) return next();

    const modules = new Set(Array.isArray(req.auth?.modules) ? req.auth.modules : []);
    const allowed = moduleKey === '*'
      ? modules.size > 0
      : Array.isArray(moduleKey)
        ? moduleKey.some((key) => modules.has(key))
        : typeof moduleKey === 'string' && modules.has(moduleKey);
    if (!allowed) {
      res.status(403).json({ error: 'Tu rol no tiene acceso a este módulo.' });
      return;
    }
    next();
  };
}

module.exports = {
  MODULES,
  MODULE_KEYS,
  getRoleAccess,
  createModulePermissionMiddleware,
};
