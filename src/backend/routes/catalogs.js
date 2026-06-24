function registerCatalogsRoutes(app, { db, adminMiddleware }) {
  // Configuración de los catálogos disponibles (tabla -> campo descriptivo principal)
  const CATALOGS = {
    os: { table: 'os', field: 'name' },
    sede: { table: 'sede', field: 'name' },
    treatments: { table: 'treatments', field: 'name' },
    patient_state: { table: 'patient_state', field: 'name' },
    report_types: { table: 'report_types', field: 'name' },
    documents_type: { table: 'documents_type', field: 'description' },
  };

  app.get('/api/catalogs/:type', async (req, res) => {
    try {
      const type = req.params.type.toLowerCase();
      const config = CATALOGS[type];
      if (!config) {
        res.status(400).json({ error: 'Catálogo no válido' });
        return;
      }
      const rows = await db.all(`SELECT id, ${config.field} AS name FROM ${config.table} ORDER BY ${config.field} ASC`);
      res.json(rows);
    } catch (err) {
      console.error(`[CATALOGS] Error listando catálogo ${req.params.type}`, err);
      res.status(500).json({ error: 'No se pudo cargar el catálogo' });
    }
  });

  app.post('/api/catalogs/:type', adminMiddleware, async (req, res) => {
    try {
      const type = req.params.type.toLowerCase();
      const config = CATALOGS[type];
      if (!config) {
        res.status(400).json({ error: 'Catálogo no válido' });
        return;
      }
      
      const name = String(req.body?.name || '').trim();
      if (!name) {
        res.status(400).json({ error: 'El nombre es obligatorio' });
        return;
      }

      const { lastID } = await db.run(
        `INSERT INTO ${config.table} (${config.field}) VALUES ($1) ON CONFLICT DO NOTHING`,
        name
      );

      if (!lastID) {
        res.status(409).json({ error: 'El elemento ya existe en el catálogo' });
        return;
      }

      res.status(201).json({ id: lastID, name });
    } catch (err) {
      console.error(`[CATALOGS] Error creando elemento en ${req.params.type}`, err);
      res.status(500).json({ error: 'No se pudo crear el elemento' });
    }
  });

  app.patch('/api/catalogs/:type/:id', adminMiddleware, async (req, res) => {
    try {
      const type = req.params.type.toLowerCase();
      const id = Number(req.params.id);
      const config = CATALOGS[type];

      if (!config) {
        res.status(400).json({ error: 'Catálogo no válido' });
        return;
      }
      if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ error: 'ID no válido' });
        return;
      }

      const name = String(req.body?.name || '').trim();
      if (!name) {
        res.status(400).json({ error: 'El nombre es obligatorio' });
        return;
      }

      await db.run(
        `UPDATE ${config.table} SET ${config.field} = $1 WHERE id = $2`,
        name,
        id
      );

      res.json({ id, name });
    } catch (err) {
      console.error(`[CATALOGS] Error actualizando elemento en ${req.params.type}`, err);
      // Catch possible unique constraint violation
      if (err.code === '23505') {
         res.status(409).json({ error: 'Ya existe otro elemento con ese nombre' });
         return;
      }
      res.status(500).json({ error: 'No se pudo actualizar el elemento' });
    }
  });

  app.delete('/api/catalogs/:type/:id', adminMiddleware, async (req, res) => {
    try {
      const type = req.params.type.toLowerCase();
      const id = Number(req.params.id);
      const config = CATALOGS[type];

      if (!config) {
        res.status(400).json({ error: 'Catálogo no válido' });
        return;
      }
      if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ error: 'ID no válido' });
        return;
      }

      await db.run(`DELETE FROM ${config.table} WHERE id = $1`, id);
      res.json({ ok: true });
    } catch (err) {
      console.error(`[CATALOGS] Error eliminando elemento en ${req.params.type}`, err);
      res.status(500).json({ error: 'No se pudo eliminar el elemento. Podría estar en uso.' });
    }
  });
}

module.exports = { registerCatalogsRoutes };
