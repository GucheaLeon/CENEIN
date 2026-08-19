import React, { useEffect, useState } from 'react';
import { useAutenticacion } from '../context/AuthContext';

function formatCooldown(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;

  if (minutes <= 0) {
    return `${remainingSeconds} segundos`;
  }
  if (remainingSeconds === 0) {
    return `${minutes} minuto${minutes === 1 ? '' : 's'}`;
  }
  return `${minutes} minuto${minutes === 1 ? '' : 's'} y ${remainingSeconds} segundo${remainingSeconds === 1 ? '' : 's'}`;
}

export default function InicioSesion({ alIngresar }) {
  const { iniciarSesion } = useAutenticacion();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recordarSesion, setRecordarSesion] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  useEffect(() => {
    if (retryAfterSeconds <= 0) return undefined;

    const timerId = window.setInterval(() => {
      setRetryAfterSeconds((current) => (current > 1 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [retryAfterSeconds]);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    const res = await iniciarSesion({ username, password, recordarSesion });
    setEnviando(false);

    if (!res?.ok) {
      setError(res?.error || 'No se pudo iniciar sesion.');
      setRetryAfterSeconds(Math.max(0, Number(res?.retryAfterSeconds) || 0));
      return;
    }

    setError('');
    setRetryAfterSeconds(0);
    alIngresar();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f9fa] p-6 text-[#2d3335]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-[#006d44]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-[#546537]/5 blur-[120px]" />
      </div>

      <main className="w-full max-w-[440px]">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6 rounded-xl bg-[#f1f4f5] p-4">
            <span
              className="material-symbols-outlined text-5xl text-[#006d44]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              health_and_safety
            </span>
          </div>
          <h1 className="font-headline mb-2 text-3xl font-extrabold tracking-tight text-[#006d44]">
            CENEIN
          </h1>
          <p className="text-sm tracking-wide text-slate-500">
            Clinical Sanctuary Administration
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/40 bg-white p-10 shadow-[0_32px_64px_-12px_rgba(45,51,53,0.06)]">
          <form onSubmit={enviar} className="space-y-6">
            <div className="space-y-2">
              <label
                className="ml-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
                htmlFor="username"
              >
                Usuario
              </label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <span className="material-symbols-outlined text-[20px]">person</span>
                </div>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nombre.usuario"
                  autoComplete="username"
                  className="block w-full rounded-lg border-none bg-[#dee3e6]/40 py-3.5 pl-11 pr-4 text-[#2d3335] placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-200"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="px-1">
                <label
                  className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
                  htmlFor="password"
                >
                  Contraseña
                </label>
<<<<<<< Updated upstream
                <span className="text-xs font-medium text-[#006d44] opacity-0 pointer-events-none">
                  ¿Olvidó su clave?
                </span>
=======
>>>>>>> Stashed changes
              </div>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                  className="block w-full rounded-lg border-none bg-[#dee3e6]/40 py-3.5 pl-11 pr-4 text-[#2d3335] placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-200"
                  required
                />
              </div>
            </div>

            <div className="flex items-center px-1">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={recordarSesion}
                onChange={(e) => setRecordarSesion(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#006d44] focus:ring-emerald-200"
              />
              <label className="ml-3 block text-sm text-slate-500" htmlFor="remember-me">
                Recordar sesión
              </label>
            </div>

            {retryAfterSeconds > 0 ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                Login bloqueado temporalmente. Probá de nuevo en {formatCooldown(retryAfterSeconds)}.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            ) : null}

            <div className="pt-4">
              <button
                type="submit"
                disabled={enviando}
                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[#006d44] to-[#00603b] py-4 font-headline font-semibold text-white shadow-lg shadow-emerald-900/10 transition-all hover:shadow-xl hover:shadow-emerald-900/20 active:scale-[0.98] disabled:opacity-60"
              >
                <span>{enviando ? 'Ingresando...' : 'Entrar'}</span>
                <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>
            </div>
          </form>
        </div>

<<<<<<< Updated upstream
        <footer className="mt-12 space-y-4 text-center">
          <p className="text-sm text-slate-500 hidden">
            ¿Necesita ayuda?{' '}
            <span className="font-semibold text-[#006d44]">Contactar Soporte Técnico</span>
          </p>
          <div className="flex items-center justify-center gap-6 pt-4">
            <div className="h-px w-12 bg-slate-300/40" />
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-full bg-[#d0e8d6] opacity-50" />
              <div className="h-10 w-10 rounded-full bg-[#e4f9bd] opacity-50" />
            </div>
            <div className="h-px w-12 bg-slate-300/40" />
          </div>
        </footer>
=======
>>>>>>> Stashed changes
      </main>
    </div>
  );
}
