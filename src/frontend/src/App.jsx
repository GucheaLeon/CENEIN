import React, { useMemo, useState } from 'react';
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

function CapaApp() {
  const { usuario, cargando, cerrarSesion } = useAutenticacion();
  const { seleccionarPaciente } = usePacientes();
  const [pagina, setPagina] = useState('dashboard');
  const [paginaAnterior, setPaginaAnterior] = useState('dashboard');

  const navegar = (siguiente) => {
    setPagina(siguiente);
  };

  const abrirPaciente = (id) => {
    seleccionarPaciente(id);
    setPaginaAnterior(pagina);
    setPagina('patient');
  };

  const volver = () => {
    setPagina(paginaAnterior);
  };

  const contenido = useMemo(() => {
    if (cargando) {
      return <div style={{ padding: 24 }}>Cargando...</div>;
    }
    if (!usuario) return <InicioSesion alIngresar={() => setPagina('dashboard')} />;
    if (pagina === 'dashboard') return <PanelPrincipal alAbrirPaciente={abrirPaciente} />;
    if (pagina === 'patients') return <Pacientes alAbrirPaciente={abrirPaciente} />;
    if (pagina === 'alta') return <AltaPacientes alAbrirPaciente={abrirPaciente} />;
    if (pagina === 'attendances') return <Asistencias />;
    if (pagina === 'users' && usuario?.isAdmin) return <Users />;
    if (pagina === 'user-history' && usuario?.isAdmin) return <UserHistory />;
    if (pagina === 'admision') return <Admision alAbrirPaciente={abrirPaciente} alNavegar={navegar} />;
    if (pagina === 'facturacion') return <Facturacion />;
    if (pagina === 'patient') return <DetallePaciente alVolver={volver} />;
    return <PanelPrincipal />;
  }, [usuario, cargando, pagina, abrirPaciente, navegar, volver]);

  return (
    <Distribucion
      paginaActual={pagina}
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
