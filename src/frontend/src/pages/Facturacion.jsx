import React, { useState, useEffect, useCallback, useRef } from 'react';
import { obtenerToken } from '../services/api';

// ─── helpers ────────────────────────────────────────────────────────────────

const API_BASE = () => {
  if (typeof window !== 'undefined' && window.APP_CONFIG) {
    const u = String(window.APP_CONFIG.API_URL || '').trim().replace(/\/+$/, '');
    if (u) return u;
  }
  return '';
};

async function apiFetch(path, opts = {}) {
  const url = `${API_BASE()}${path}`;
  const token = obtenerToken();
  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...opts, headers, credentials: 'include', cache: 'no-store' });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); if (d.error) msg = d.error; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

const pdfUrl = (fileName, preview = false) =>
  `${API_BASE()}/api/facturacion/pdfs/${encodeURIComponent(fileName)}${preview ? '/preview' : ''}`;

const afipUrl = (cuit, ptoVta, cbteTipo, cbteNro) =>
  `https://serviciosweb.afip.gob.ar/genericos/comprobantes/`;

const fmtMoneda = (n) =>
  Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const fmtDate = (iso) => {
  if (!iso) return '-';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

const TIPOS_CBTE = [
  { value: '6', label: 'Factura B' },
  { value: '1', label: 'Factura A' },
  { value: '11', label: 'Factura C' },
];
const CONCEPTOS = [
  { value: '2', label: 'Servicios' },
  { value: '1', label: 'Productos' },
  { value: '3', label: 'Productos y Servicios' },
];
const DOC_TIPOS = [
  { value: '99', label: 'Sin identificar (Consumidor Final)' },
  { value: '96', label: 'DNI' },
  { value: '80', label: 'CUIT' },
  { value: '86', label: 'CUIL' },
];
const ESTADOS = ['Emitida', 'Pagada', 'Anulada', 'Pendiente de pago'];

// ─── sub-componentes ─────────────────────────────────────────────────────────

function Spinner({ size = 18 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid #d1fae5`, borderTop: `2px solid #006d44`,
      borderRadius: '50%', animation: 'fac-spin 0.7s linear infinite', verticalAlign: 'middle'
    }} />
  );
}

function Badge({ text, color = '#006d44', bg = '#d6ffe8' }) {
  return (
    <span style={{ background: bg, color, borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '2px 9px', whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

// ─── Selector / Buscador de paciente ─────────────────────────────────────────
function PatientPicker({ pacientes = [], onSelect, selected, loading }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (selected) {
      setQ(`${selected.apellido}, ${selected.nombre}`);
    } else {
      setQ('');
    }
  }, [selected]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = pacientes.filter((p) => {
    if (!q.trim()) return true;
    const term = q.toLowerCase();
    return (
      (p.nombre && p.nombre.toLowerCase().includes(term)) ||
      (p.apellido && p.apellido.toLowerCase().includes(term)) ||
      (p.dni && p.dni.includes(term)) ||
      (p.cuit && p.cuit.includes(term)) ||
      (p.obraSocial && p.obraSocial.toLowerCase().includes(term))
    );
  });

  const clear = (e) => {
    e.stopPropagation();
    setQ('');
    onSelect(null);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        style={{ position: 'relative', cursor: 'pointer' }}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="material-symbols-outlined" style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: '#006d44', fontSize: 20, pointerEvents: 'none'
        }}>person_search</span>
        <input
          id="fac-paciente-buscador"
          className="fac-input"
          style={{ paddingLeft: 38, paddingRight: selected ? 65 : 34, cursor: 'text' }}
          placeholder="Hacé clic para ver la lista o escribí nombre, DNI, OS…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {loading && <Spinner size={15} />}
          {selected && (
            <button
              type="button"
              onClick={clear}
              title="Quitar paciente"
              style={{
                background: '#fee2e2', border: 'none', borderRadius: '50%',
                width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#b91c1c'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          )}
          <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: 18, pointerEvents: 'none' }}>
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: '#fff', border: '1.5px solid #c8e6d4', borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,.15)', maxHeight: 280, overflowY: 'auto', marginTop: 5
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px', color: '#64748b', fontSize: 13, textAlign: 'center' }}>
              {loading ? 'Cargando pacientes…' : 'No se encontraron pacientes.'}
            </div>
          ) : (
            filtered.map((p) => {
              const isSel = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onSelect(p); setOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', background: isSel ? '#e6f7ef' : 'none',
                    border: 'none', padding: '10px 14px', cursor: 'pointer',
                    borderBottom: '1px solid #f1f5f2', transition: 'background .1s'
                  }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = '#f0fdf6'; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1a2e25' }}>
                      {p.apellido}, {p.nombre}
                    </span>
                    {p.dni && (
                      <span style={{ fontSize: 11, color: '#006d44', background: '#d6ffe8', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
                        DNI {p.dni}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {p.cuit && <span>CUIT: {p.cuit}</span>}
                    {p.obraSocial && <span>OS: {p.obraSocial}</span>}
                    {p.modulos?.length > 0 && (
                      <span style={{ color: '#006d44', fontWeight: 700 }}>
                        Módulo: {p.modulos.map((m) => m.descripcion).join(', ')}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card de información y autocompletado del paciente ────────────────────────
function PatientCard({ paciente, selectedModulo, onSelectModulo, modulosCatalogo = [] }) {
  if (!paciente) return null;
  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdf6 0%, #e6f7ef 100%)',
      border: '1.5px solid #86efac', borderRadius: 14,
      padding: '14px 18px', marginBottom: 18, animation: 'fac-fadein .2s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#006d44', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>person</span>
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#15803d' }}>
              {paciente.nombre} {paciente.apellido}
            </h4>
            <p style={{ margin: 0, fontSize: 12, color: '#166534' }}>
              {paciente.dni ? `DNI: ${paciente.dni}` : ''}
              {paciente.cuit ? ` · CUIT: ${paciente.cuit}` : ''}
              {paciente.obraSocial ? ` · OS: ${paciente.obraSocial}` : ''}
              {paciente.nroAfiliado ? ` · Afiliado: ${paciente.nroAfiliado}` : ''}
            </p>
          </div>
        </div>
        <span style={{ background: '#006d44', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
          Paciente Vinculado
        </span>
      </div>

      {/* Módulos asignados al paciente */}
      {paciente.modulos?.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>
            Módulos asignados a este paciente (clic para seleccionar):
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {paciente.modulos.map((m) => {
              const isSel = selectedModulo?.id === m.id || selectedModulo?.descripcion === m.descripcion;
              const catMod = modulosCatalogo.find((c) => c.id === m.id || c.description === m.descripcion);
              const precio = m.price || catMod?.price || 0;
              return (
                <button
                  key={m.id || m.descripcion}
                  type="button"
                  onClick={() => onSelectModulo({ id: m.id, descripcion: m.descripcion, price: precio })}
                  style={{
                    border: `2px solid ${isSel ? '#006d44' : '#86efac'}`,
                    background: isSel ? '#006d44' : '#fff',
                    color: isSel ? '#fff' : '#006d44',
                    borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {isSel ? 'check_circle' : 'medical_services'}
                  </span>
                  <span>{m.descripcion}</span>
                  {precio > 0 && (
                    <span style={{ opacity: 0.9, fontWeight: 800 }}>({fmtMoneda(precio)})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#4b7a5e', fontStyle: 'italic' }}>
          Este paciente no tiene módulos asignados en su ficha. Podés seleccionar un módulo del catálogo abajo.
        </p>
      )}

      {/* Tratamientos */}
      {paciente.tratamientos?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>
            Sesiones / Tratamientos activos:
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {paciente.tratamientos.map((t) => (
              <span key={t.id || t.nombre} style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                {t.nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Historial con filtros ───────────────────────────────────────────────────
function Historial({ onPreview }) {
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', status: '', module_id: '' });
  const [invoices, setInvoices] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    apiFetch('/api/facturacion/modulos').then((d) => setModulos(d.data || [])).catch(() => {});
    load();
  }, []);

  const load = useCallback(async (flt) => {
    const f = flt || filtros;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.desde) params.set('desde', f.desde);
      if (f.hasta) params.set('hasta', f.hasta);
      if (f.status) params.set('status', f.status);
      if (f.module_id) params.set('module_id', f.module_id);
      params.set('limit', '50');
      const data = await apiFetch(`/api/facturacion/invoices?${params.toString()}`);
      setInvoices(data.data || []);
    } catch (_) {}
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFiltros = (updates) => {
    const next = { ...filtros, ...updates };
    setFiltros(next);
    load(next);
  };

  async function changeStatus(invoiceId, newStatus) {
    setUpdatingId(invoiceId);
    try {
      await apiFetch(`/api/facturacion/invoices/${invoiceId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setInvoices((prev) => prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, estado: newStatus } : inv
      ));
    } catch (_) {}
    setUpdatingId(null);
  }

  return (
    <div style={{ animation: 'fac-fadein .2s' }}>
      {/* Filtros */}
      <div className="fac-card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label className="fac-label">Desde</label>
          <input type="date" className="fac-input" style={{ width: 150 }}
            value={filtros.desde} onChange={(e) => applyFiltros({ desde: e.target.value })} />
        </div>
        <div>
          <label className="fac-label">Hasta</label>
          <input type="date" className="fac-input" style={{ width: 150 }}
            value={filtros.hasta} onChange={(e) => applyFiltros({ hasta: e.target.value })} />
        </div>
        <div>
          <label className="fac-label">Módulo</label>
          <select className="fac-input" style={{ width: 180 }}
            value={filtros.module_id} onChange={(e) => applyFiltros({ module_id: e.target.value })}>
            <option value="">Todos los módulos</option>
            {modulos.map((m) => <option key={m.id} value={m.id}>{m.description}</option>)}
          </select>
        </div>
        <div>
          <label className="fac-label">Estado</label>
          <select className="fac-input" style={{ width: 170 }}
            value={filtros.status} onChange={(e) => applyFiltros({ status: e.target.value })}>
            <option value="">Todos los estados</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="fac-btn fac-btn-outline" style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => load(filtros)}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span> Actualizar
        </button>
      </div>

      {/* Tabla */}
      <div className="fac-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2ebe5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#1a2e25' }}>
            Facturas emitidas {loading ? '' : `(${invoices.length})`}
          </span>
          {loading && <Spinner />}
        </div>

        {!loading && invoices.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12, color: '#c8d9d2' }}>receipt_long</span>
            <p style={{ margin: 0, fontSize: 14 }}>No hay facturas con los filtros seleccionados.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f0fdf6' }}>
                  {['Fecha', 'Paciente / Receptor', 'Módulo', 'Sesiones', 'CAE', 'Importe', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#006d44', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap', borderBottom: '1px solid #e2ebe5' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f2' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fdfb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#475569' }}>{fmtDate(inv.fechaEmision)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#1a2e25' }}>
                        {inv.paciente?.apellido ? `${inv.paciente.apellido}, ${inv.paciente.nombre}` : inv.receptorNombre || '-'}
                      </div>
                      {inv.obraSocial && <div style={{ fontSize: 11, color: '#64748b' }}>{inv.obraSocial}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {inv.modulo ? <Badge text={inv.modulo} /> : <span style={{ color: '#94a3b8' }}>-</span>}
                    </td>
                    <td style={{ padding: '10px 14px', maxWidth: 160 }}>
                      {inv.tratamientos?.length > 0
                        ? <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>{inv.tratamientos.map((t) => t.nombre).join(' · ')}</div>
                        : <span style={{ color: '#94a3b8' }}>-</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
                      {inv.cae || '-'}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>
                      {fmtMoneda(inv.importe)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {updatingId === inv.id ? <Spinner size={14} /> : (
                        <select
                          value={inv.estado || ''}
                          onChange={(e) => changeStatus(inv.id, e.target.value)}
                          style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                        >
                          {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {inv.pdfFileName && (
                          <>
                            <button
                              className="fac-btn fac-btn-outline"
                              style={{ padding: '4px 10px', fontSize: 11 }}
                              onClick={() => onPreview(inv.pdfFileName)}
                              title="Ver PDF"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>visibility</span>
                            </button>
                            <a href={pdfUrl(inv.pdfFileName)} download style={{ textDecoration: 'none' }}>
                              <button className="fac-btn fac-btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} type="button" title="Descargar PDF">
                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>
                              </button>
                            </a>
                          </>
                        )}
                        <a
                          href={afipUrl(inv.paciente?.cuit, inv.ptoVta, inv.cbteTipo, inv.cbteNro)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver en AFIP"
                          style={{ textDecoration: 'none' }}
                        >
                          <button className="fac-btn" style={{ padding: '4px 10px', fontSize: 11, background: '#fff7ed', color: '#c2410c', border: '1.5px solid #fed7aa' }} type="button">
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
                          </button>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Facturacion() {
  const [arcaStatus, setArcaStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [tab, setTab] = useState('emitir');
  const [pdfPreview, setPdfPreview] = useState(null);

  // Catálogos
  const [pacientesList, setPacientesList] = useState([]);
  const [loadingPacientes, setLoadingPacientes] = useState(false);
  const [modulosCatalogo, setModulosCatalogo] = useState([]);

  // Formulario
  const [paciente, setPaciente] = useState(null);
  const [selectedModulo, setSelectedModulo] = useState(null);
  const [cantidadModulos, setCantidadModulos] = useState(1);
  const [form, setForm] = useState({
    impTotal: '',
    cbteTipo: '6',
    concepto: '2',
    docTipo: '99',
    docNro: '',
    receptorNombre: '',
    facturarA: 'paciente', // 'paciente' | 'obra_social'
  });
  const [emitiendo, setEmitiendo] = useState(false);
  const [emitResult, setEmitResult] = useState(null);
  const [emitError, setEmitError] = useState('');

  useEffect(() => {
    checkStatus();
    loadCatalogos();
  }, []);

  async function loadCatalogos() {
    setLoadingPacientes(true);
    try {
      const [pRes, mRes] = await Promise.all([
        apiFetch('/api/facturacion/pacientes'),
        apiFetch('/api/facturacion/modulos'),
      ]);
      setPacientesList(pRes.data || []);
      setModulosCatalogo(mRes.data || []);
    } catch (_) {}
    setLoadingPacientes(false);
  }

  async function checkStatus() {
    setLoadingStatus(true);
    try {
      const data = await apiFetch('/api/facturacion/status');
      setArcaStatus(data);
    } catch (e) {
      setArcaStatus({ ok: false, error: e.message });
    }
    setLoadingStatus(false);
  }

  // Al seleccionar paciente → autocompletar automáticamente todos los datos del receptor y módulo
  const handleSelectPaciente = useCallback((p) => {
    setPaciente(p);
    if (!p) {
      setSelectedModulo(null);
      setForm((f) => ({
        ...f,
        receptorNombre: '',
        docTipo: '99',
        docNro: '',
        impTotal: '',
      }));
      return;
    }

    // 1. Determinar documento y nombre del receptor
    let docTipo = '99';
    let docNro = '';
    if (p.cuit) {
      docTipo = '80'; // CUIT
      docNro = p.cuit;
    } else if (p.dni) {
      docTipo = '96'; // DNI
      docNro = p.dni;
    }

    // 2. Preseleccionar módulo asignado al paciente si existe
    let autoModulo = null;
    let autoImp = '';
    if (p.modulos && p.modulos.length > 0) {
      autoModulo = p.modulos[0];
      const matchCat = modulosCatalogo.find((c) => c.id === autoModulo.id || c.description === autoModulo.descripcion);
      const precio = autoModulo.price || matchCat?.price || 0;
      if (precio > 0) {
        autoImp = String(precio * cantidadModulos);
      }
    }

    setSelectedModulo(autoModulo);
    setForm((f) => ({
      ...f,
      receptorNombre: `${p.nombre} ${p.apellido}`.trim(),
      docTipo,
      docNro,
      cbteTipo: docTipo === '80' ? '1' : '6', // Factura A para CUIT, Factura B para DNI/Consumidor Final
      impTotal: autoImp || f.impTotal,
      facturarA: 'paciente',
    }));
  }, [modulosCatalogo, cantidadModulos]);

  // Manejar cambio de facturar a (Paciente vs Obra Social)
  const handleCambioDestinatario = (tipo) => {
    if (!paciente) return;
    if (tipo === 'obra_social' && paciente.obraSocial) {
      setForm((f) => ({
        ...f,
        facturarA: 'obra_social',
        receptorNombre: paciente.obraSocial,
        docTipo: '80', // CUIT Obra Social
        docNro: '', // CUIT a completar si corresponde
        cbteTipo: '1', // Factura A para Obra Social (usualmente RI)
      }));
    } else {
      let docTipo = '99';
      let docNro = '';
      if (paciente.cuit) {
        docTipo = '80';
        docNro = paciente.cuit;
      } else if (paciente.dni) {
        docTipo = '96';
        docNro = paciente.dni;
      }
      setForm((f) => ({
        ...f,
        facturarA: 'paciente',
        receptorNombre: `${paciente.nombre} ${paciente.apellido}`.trim(),
        docTipo,
        docNro,
        cbteTipo: docTipo === '80' ? '1' : '6',
      }));
    }
  };

  // Al elegir o cambiar módulo del catálogo o del paciente
  const handleSelectModulo = (mod) => {
    setSelectedModulo(mod);
    if (mod) {
      const matchCat = modulosCatalogo.find((c) => c.id === mod.id || c.description === mod.descripcion);
      const precioUnit = mod.price || matchCat?.price || 0;
      if (precioUnit > 0) {
        setForm((f) => ({ ...f, impTotal: String(precioUnit * cantidadModulos) }));
      }
    }
  };

  // Al cambiar cantidad
  const handleCantidadChange = (cant) => {
    const c = Math.max(1, Number(cant) || 1);
    setCantidadModulos(c);
    if (selectedModulo) {
      const matchCat = modulosCatalogo.find((cat) => cat.id === selectedModulo.id || cat.description === selectedModulo.descripcion);
      const precioUnit = selectedModulo.price || matchCat?.price || 0;
      if (precioUnit > 0) {
        setForm((f) => ({ ...f, impTotal: String(precioUnit * c) }));
      }
    }
  };

  async function handleEmitir(e) {
    e.preventDefault();
    if (!form.impTotal || Number(form.impTotal) <= 0) {
      setEmitError('Ingresá o seleccioná un módulo con importe mayor a $0.');
      return;
    }
    setEmitiendo(true);
    setEmitResult(null);
    setEmitError('');

    try {
      const payload = {
        impTotal: Number(form.impTotal),
        cbteTipo: Number(form.cbteTipo),
        concepto: Number(form.concepto),
        docTipo: Number(form.docTipo),
        docNro: form.docNro ? Number(form.docNro) : 0,
        receptorNombre: form.receptorNombre || 'Consumidor Final',
        receptorObraSocial: paciente?.obraSocial || '',
        receptorModulos: selectedModulo ? [selectedModulo.descripcion || selectedModulo.description] : [],
        receptorTratamientos: paciente?.tratamientos ? paciente.tratamientos.map((t) => t.nombre) : [],
        patientId: paciente?.id || null,
        moduloMpId: selectedModulo?.mpId || null,
        moduleDirectId: selectedModulo?.id || null,
        treatmentIds: paciente?.tratamientos ? paciente.tratamientos.map((t) => t.id) : [],
      };
      const data = await apiFetch('/api/facturacion/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setEmitResult(data.data);
      setTab('historial');
    } catch (err) {
      setEmitError(err.message || 'Error al emitir la factura.');
    }
    setEmitiendo(false);
  }

  return (
    <>
      <style>{`
        @keyframes fac-spin { to { transform: rotate(360deg); } }
        @keyframes fac-fadein { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .fac-card { background:#fff; border-radius:16px; border:1px solid #e2ebe5; box-shadow:0 1px 4px rgba(0,0,0,.04); }
        .fac-btn { display:inline-flex; align-items:center; gap:5px; border:none; border-radius:10px; padding:10px 18px; font-size:14px; font-weight:700; cursor:pointer; transition:all .15s; }
        .fac-btn:disabled { opacity:.5; cursor:not-allowed; }
        .fac-btn-primary { background:#006d44; color:#fff; }
        .fac-btn-primary:not(:disabled):hover { background:#005a38; }
        .fac-btn-outline { background:#fff; color:#006d44; border:1.5px solid #006d44; }
        .fac-btn-outline:hover { background:#f0fdf6; }
        .fac-input { width:100%; border:1.5px solid #d1e8da; border-radius:10px; padding:9px 12px; font-size:14px; outline:none; background:#fafffe; transition:border .15s; box-sizing:border-box; }
        .fac-input:focus { border-color:#006d44; background:#fff; }
        .fac-label { display:block; font-size:11px; font-weight:700; color:#4a6558; margin-bottom:5px; text-transform:uppercase; letter-spacing:.04em; }
        .fac-tab { padding:8px 18px; border:none; background:none; font-size:14px; font-weight:600; cursor:pointer; border-bottom:2.5px solid transparent; color:#64748b; transition:all .15s; }
        .fac-tab.active { color:#006d44; border-bottom-color:#006d44; }
        .fac-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; animation:fac-fadein .2s; }
        .fac-modal { background:#fff; border-radius:16px; width:100%; max-width:900px; height:82vh; display:flex; flex-direction:column; overflow:hidden; }
      `}</style>

      <div style={{ padding: '28px 24px', maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, background: '#d6ffe8', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#006d44', fontSize: 24 }}>receipt_long</span>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a2e25' }}>Facturación Electrónica</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>ARCA / AFIP — Facturación por Paciente y Módulos</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {loadingStatus ? <Spinner /> : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: arcaStatus?.ok ? '#d6ffe8' : '#fee2e2',
                color: arcaStatus?.ok ? '#006d44' : '#b91c1c',
                borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  {arcaStatus?.ok ? 'check_circle' : 'error'}
                </span>
                {arcaStatus?.ok ? 'ARCA Conectado' : 'Sin conexión'}
              </span>
            )}
            <button className="fac-btn fac-btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={checkStatus} title="Comprobar conexión">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>
            </button>
          </div>
        </div>

        {/* Status servidores */}
        {arcaStatus?.serverStatus && (
          <div className="fac-card" style={{ padding: '10px 18px', marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[['AppServer', arcaStatus.serverStatus.AppServer], ['DbServer', arcaStatus.serverStatus.DbServer], ['AuthServer', arcaStatus.serverStatus.AuthServer]].map(([name, val]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: val === 'OK' ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                <strong>{name}:</strong>&nbsp;{val}
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ borderBottom: '1.5px solid #e2ebe5', marginBottom: 22, display: 'flex', gap: 2 }}>
          <button className={`fac-tab${tab === 'emitir' ? ' active' : ''}`} onClick={() => setTab('emitir')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 5 }}>add_circle</span>
            Nueva Factura
          </button>
          <button className={`fac-tab${tab === 'historial' ? ' active' : ''}`} onClick={() => setTab('historial')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 5 }}>history</span>
            Historial de Facturas
          </button>
        </div>

        {/* ── Tab: Emitir ── */}
        {tab === 'emitir' && (
          <div style={{ animation: 'fac-fadein .2s' }}>
            {emitResult && (
              <div className="fac-card" style={{ padding: 20, marginBottom: 20, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span className="material-symbols-outlined" style={{ color: '#16a34a', fontSize: 26 }}>check_circle</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: '#15803d' }}>¡Factura emitida con éxito en ARCA y guardada!</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 13, color: '#166534' }}>
                  {[
                    ['CAE', emitResult.cae],
                    ['Vencimiento', emitResult.caeVto ? fmtDate(`${emitResult.caeVto.slice(0,4)}-${emitResult.caeVto.slice(4,6)}-${emitResult.caeVto.slice(6,8)}`) : '-'],
                    ['Comprobante', `${String(emitResult.ptoVta).padStart(4,'0')}-${String(emitResult.cbteNro).padStart(8,'0')}`],
                    ['Importe', fmtMoneda(emitResult.impTotal)],
                  ].map(([k, v]) => <div key={k}><strong>{k}:</strong> {v}</div>)}
                </div>
                {emitResult.pdfFileName && (
                  <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                    <button className="fac-btn fac-btn-outline" onClick={() => setPdfPreview(emitResult.pdfFileName)} type="button">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span> Ver PDF
                    </button>
                    <a href={pdfUrl(emitResult.pdfFileName)} download style={{ textDecoration: 'none' }}>
                      <button className="fac-btn fac-btn-primary" type="button">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span> Descargar PDF
                      </button>
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="fac-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a2e25' }}>
                  Emisión de Comprobante
                </h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Emisor: <strong>CENEIN (CUIT 27-27959112-2)</strong>
                </span>
              </div>

              <form onSubmit={handleEmitir}>
                {/* 1. SELECCIÓN DE PACIENTE */}
                <div style={{ marginBottom: 16 }}>
                  <label className="fac-label">1. Seleccionar Paciente de la Lista</label>
                  <PatientPicker
                    pacientes={pacientesList}
                    loading={loadingPacientes}
                    onSelect={handleSelectPaciente}
                    selected={paciente}
                  />
                </div>

                {/* Card de paciente seleccionado */}
                <PatientCard
                  paciente={paciente}
                  selectedModulo={selectedModulo}
                  onSelectModulo={handleSelectModulo}
                  modulosCatalogo={modulosCatalogo}
                />

                {/* 2. MÓDULO E IMPORTE */}
                <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span className="material-symbols-outlined" style={{ color: '#006d44' }}>medical_services</span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>
                      2. Módulo a Facturar e Importe
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: 14 }}>
                    <div>
                      <label className="fac-label">Módulo Clínico *</label>
                      <select
                        id="fac-modulo-select"
                        className="fac-input"
                        value={selectedModulo?.id || selectedModulo?.descripcion || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const found = modulosCatalogo.find((m) => String(m.id) === val || m.description === val);
                          if (found) {
                            handleSelectModulo({ id: found.id, descripcion: found.description, price: found.price });
                          } else {
                            handleSelectModulo(null);
                          }
                        }}
                      >
                        <option value="">-- Seleccionar Módulo del Catálogo --</option>
                        {modulosCatalogo.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.description} {m.price > 0 ? `(${fmtMoneda(m.price)})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="fac-label">Cantidad / Meses</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="fac-input"
                        value={cantidadModulos}
                        onChange={(e) => handleCantidadChange(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="fac-label">Importe Total Calculado ($) *</label>
                      <input
                        id="fac-importe"
                        className="fac-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        value={form.impTotal}
                        onChange={(e) => setForm((f) => ({ ...f, impTotal: e.target.value }))}
                        required
                        style={{ fontWeight: 800, color: '#006d44', fontSize: 15 }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. DATOS DEL RECEPTOR AUTOCOMPLETADOS */}
                <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ color: '#006d44' }}>badge</span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>
                        3. Datos del Receptor (Autocompletado)
                      </span>
                    </div>

                    {paciente?.obraSocial && (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>Facturar a:</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontWeight: 600 }}>
                          <input
                            type="radio"
                            name="facturarA"
                            checked={form.facturarA === 'paciente'}
                            onChange={() => handleCambioDestinatario('paciente')}
                          />
                          Paciente
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontWeight: 600, color: '#006d44' }}>
                          <input
                            type="radio"
                            name="facturarA"
                            checked={form.facturarA === 'obra_social'}
                            onChange={() => handleCambioDestinatario('obra_social')}
                          />
                          Obra Social ({paciente.obraSocial})
                        </label>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="fac-label">Nombre o Razón Social del Receptor *</label>
                      <input
                        id="fac-receptor"
                        className="fac-input"
                        type="text"
                        placeholder="Consumidor Final"
                        value={form.receptorNombre}
                        onChange={(e) => setForm((f) => ({ ...f, receptorNombre: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <label className="fac-label">Tipo de Documento</label>
                      <select
                        id="fac-doc-tipo"
                        className="fac-input"
                        value={form.docTipo}
                        onChange={(e) => setForm((f) => ({ ...f, docTipo: e.target.value, docNro: e.target.value === '99' ? '0' : '' }))}
                      >
                        {DOC_TIPOS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="fac-label">Nro. Documento {form.docTipo === '99' ? '(0 para Consumidor Final)' : '*'}</label>
                      <input
                        id="fac-doc-nro"
                        className="fac-input"
                        type="text"
                        placeholder={form.docTipo === '99' ? '0' : 'Ej: 30123456'}
                        value={form.docNro}
                        onChange={(e) => setForm((f) => ({ ...f, docNro: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="fac-label">Tipo de Comprobante</label>
                      <select
                        id="fac-cbte-tipo"
                        className="fac-input"
                        value={form.cbteTipo}
                        onChange={(e) => setForm((f) => ({ ...f, cbteTipo: e.target.value }))}
                      >
                        {TIPOS_CBTE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="fac-label">Concepto ARCA</label>
                      <select
                        id="fac-concepto"
                        className="fac-input"
                        value={form.concepto}
                        onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
                      >
                        {CONCEPTOS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {emitError && (
                  <div style={{ marginTop: 14, background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined">error</span>
                    <span>{emitError}</span>
                  </div>
                )}

                <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    id="fac-emitir-btn"
                    className="fac-btn fac-btn-primary"
                    type="submit"
                    disabled={emitiendo}
                    style={{ padding: '12px 24px', fontSize: 15 }}
                  >
                    {emitiendo ? (
                      <><Spinner /> Emitiendo en ARCA y Generando Factura…</>
                    ) : (
                      <><span className="material-symbols-outlined" style={{ fontSize: 19 }}>send</span> Emitir Factura Electrónica</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Tab: Historial ── */}
        {tab === 'historial' && (
          <Historial onPreview={setPdfPreview} />
        )}
      </div>

      {/* Modal visor PDF */}
      {pdfPreview && (
        <div className="fac-modal-overlay" onClick={() => setPdfPreview(null)}>
          <div className="fac-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #e2ebe5', background: '#f8fdfb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#006d44' }}>picture_as_pdf</span>
                <span style={{ fontWeight: 700, fontSize: 12, color: '#1a2e25', maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdfPreview}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={pdfUrl(pdfPreview)} download style={{ textDecoration: 'none' }}>
                  <button className="fac-btn fac-btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} type="button">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span> Descargar
                  </button>
                </a>
                <button className="fac-btn fac-btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setPdfPreview(null)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                </button>
              </div>
            </div>
            <iframe src={pdfUrl(pdfPreview, true)} title="Vista previa" style={{ flex: 1, border: 'none', width: '100%' }} />
          </div>
        </div>
      )}
    </>
  );
}
