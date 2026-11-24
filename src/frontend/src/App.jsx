import React, { useCallback, useMemo, useState } from 'react';
import { ProveedorAutenticacion, useAutenticacion } from './context/AuthContext';
import { ProveedorPacientes, usePacientes } from './context/PatientsContext';
import { ThemeProvider } from './context/ThemeContext';
import Distribucion from './components/Layout';
import InicioSesion from './pages/Login';
import PanelPrincipal from './pages/Dashboard';
import Pacientes from './pages/Patients';
import DetallePaciente from './pages/PatientDetail';
import AltaPacientes from './pages/AltaPacientes';
import Asistencias from './pages/Attendances';
import Users from './pages/Users';
import UserHistory from './pages/UserHistory';
import Admision from './pages/Admision';
import Facturacion from './pages/Facturacion';
import Informes from './pages/Informes';

const PAGE_MODULES = {
  dashboard: 'patients',
  patients: 'patients',
  alta: 'alta',
  attendances: 'attendances',
  admision: 'admission',
  facturacion: 'billing',
  reports: 'reports',
  patient: 'patients',
};

function obtenerPaginaInicial(usuario) {
  if (usuario?.isAdmin) return 'dashboard';
  const modulos = new Set(Array.isArray(usuario?.modules) ? usuario.modules : []);
  return [
    ['patients', 'dashboard'],
    ['attendances', 'attendances'],
    ['alta', 'alta'],
    ['admission', 'admision'],
    ['billing', 'facturacion'],
    ['reports', 'reports'],
  ].find(([moduleKey]) => modulos.has(moduleKey))?.[1] || null;
}

function CapaApp() {
  const { usuario, cargando, cerrarSesion } = useAutenticacion();
  const { seleccionarPaciente } = usePacientes();
  const [pagina, setPagina] = useState('dashboard');
  const [paginaAnterior, setPaginaAnterior] = useState('dashboard');
  const paginaInicial = obtenerPaginaInicial(usuario);
  const paginaVisible = !usuario
    ? pagina
    : (usuario.isAdmin || (PAGE_MODULES[pagina] && usuario.modules?.includes(PAGE_MODULES[pagina]))
      ? pagina
      : paginaInicial);

  const navegar = useCallback((siguiente) => {
    setPagina(siguiente);
  }, []);

  const abrirPaciente = useCallback((id) => {
    seleccionarPaciente(id);
    setPaginaAnterior(pagina);
    setPagina('patient');
  }, [pagina, seleccionarPaciente]);

  const volver = useCallback(() => {
    setPagina(paginaAnterior);
  }, [paginaAnterior]);

  const contenido = useMemo(() => {
    if (cargando) {
      return <div style={{ padding: 24 }}>Cargando...</div>;
    }
    if (!usuario) return <InicioSesion alIngresar={() => setPagina('dashboard')} />;
    if (usuario && !paginaVisible) {
      return (
        <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Tu rol todavía no tiene módulos habilitados. Contactá a un administrador.
        </div>
      );
    }
    if (paginaVisible === 'dashboard') return <PanelPrincipal alAbrirPaciente={abrirPaciente} />;
    if (paginaVisible === 'patients') return <Pacientes alAbrirPaciente={abrirPaciente} />;
    if (paginaVisible === 'alta') return <AltaPacientes alAbrirPaciente={abrirPaciente} />;
    if (paginaVisible === 'attendances') return <Asistencias />;
    if (paginaVisible === 'users' && usuario?.isAdmin) return <Users />;
    if (paginaVisible === 'user-history' && usuario?.isAdmin) return <UserHistory />;
    if (paginaVisible === 'admision') return <Admision alAbrirPaciente={abrirPaciente} alNavegar={navegar} />;
    if (paginaVisible === 'facturacion') return <Facturacion />;
    if (paginaVisible === 'reports') return <Informes />;
    if (paginaVisible === 'patient') return <DetallePaciente alVolver={volver} />;
    return <PanelPrincipal />;
  }, [usuario, cargando, paginaVisible, abrirPaciente, navegar, volver]);

  return (
    <Distribucion
      paginaActual={paginaVisible || 'dashboard'}
      alNavegar={navegar}
      usuario={usuario}
      alCerrarSesion={() => {
        cerrarSesion();
        setPagina('dashboard');
      }}
    >
      {contenido}
    </Distribucion>
  );
}

export default function Aplicacion() {
  return (
    <ThemeProvider>
      <ProveedorAutenticacion>
        <ProveedorPacientes>
          <CapaApp />
        </ProveedorPacientes>
      </ProveedorAutenticacion>
    </ThemeProvider>
  );
}
