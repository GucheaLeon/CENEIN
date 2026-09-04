import React, { useEffect, useMemo, useState } from "react";
import { usePacientes } from "../context/PatientsContext";
import {
  actualizarInformeApi,
  crearInformeApi,
  descargarInformePdfApi,
  eliminarInformeApi,
  obtenerInformeApi,
  obtenerInformesApi,
} from "../services/api";

const DOCUMENT_TYPES = [
  { value: "evaluation", label: "Informe de evaluación" },
  { value: "treatment_plan", label: "Plan de tratamiento" },
];
const REPORT_TYPES = [
  { value: "initial", label: "Informe de evaluación inicial" },
  { value: "evolution", label: "Informe evolutivo de la prestación" },
];
const EMPTY = { provider: "", notes: "" };
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const typeLabel = (value) =>
  REPORT_TYPES.find((item) => item.value === value)?.label || value;
const isAdmitted = (patient) => {
  const state = String(patient.estadoPaciente || "").toLowerCase();
  return (
    !patient.dadoDeBaja &&
    !["nuevo", "desestimado", "baja"].includes(state) &&
    (patient.obraSocial ||
      patient.os_id ||
      state.includes("expediente") ||
      state.includes("admi"))
  );
};
const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

export default function Informes() {
  const { pacientes } = usePacientes();
  const patients = useMemo(
    () =>
      pacientes
        .filter(isAdmitted)
        .sort((a, b) =>
          `${a.apellido} ${a.nombre}`.localeCompare(
            `${b.apellido} ${b.nombre}`,
          ),
        ),
    [pacientes],
  );
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [tab, setTab] = useState("history");
  const [reports, setReports] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    documentType: "",
    reportType: "",
    reportDate: "",
    treatmentName: "",
    content: { ...EMPTY },
  });
  const patient = patients.find((item) => item.id === patientId);
  const patientReports = reports
    .filter((item) => item.patientId === patientId)
    .sort((a, b) => String(b.reportDate).localeCompare(String(a.reportDate)));
  const filteredPatients = patients.filter((item) =>
    `${item.apellido} ${item.nombre} ${item.dni || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const setContent = (key, value) =>
    setForm((current) => ({
      ...current,
      content: { ...current.content, [key]: value },
    }));
  const load = async () => {
    const items = await obtenerInformesApi();
    setReports(Array.isArray(items) ? items : []);
  };
  useEffect(() => {
    load().catch(() => setMessage("No se pudo cargar el historial."));
  }, []);
  useEffect(() => {
    if (patientId) load().catch(() => setMessage("No se pudo actualizar el historial."));
  }, [patientId]);
  const selectPatient = (id) => {
    setPatientId(id);
    setTab("history");
    setEditingId(null);
    setForm((current) => ({
      ...current,
      treatmentName: "",
      content: { ...EMPTY },
    }));
  };
  const changeDate = (value) =>
    setForm((current) => ({
      ...current,
      reportDate: value,
    }));
  const saveReport = async (event) => {
    event.preventDefault();
    if (form.documentType !== "evaluation") {
      setMessage(
        "El formulario del plan de tratamiento se implementará en la próxima etapa.",
      );
      return;
    }
    setBusy(true);
    try {
      const payload = {
        patientId,
        ...form,
      };
      if (editingId) await actualizarInformeApi(editingId, payload);
      else await crearInformeApi(payload);
      setEditingId(null);
      setPatientId("");
      setTab("history");
      setMessage("Informe guardado correctamente. Podés seleccionarlo desde el historial del paciente.");
    } catch (error) {
      setMessage(error.message || "No se pudo generar el PDF.");
    } finally {
      setBusy(false);
    }
  };
  const edit = async (id) => {
    const report = await obtenerInformeApi(id);
    setForm({
      documentType: "evaluation",
      reportType: report.reportType,
      reportDate: report.reportDate,
      treatmentName: report.treatmentName,
      content: { ...EMPTY, ...(report.content || {}) },
    });
    setEditingId(id);
    setTab("generate");
  };
  const remove = async (report) => {
    const description = `${typeLabel(report.reportType)} - ${report.treatmentName} - ${report.lastName || patient?.apellido || ""} ${report.firstName || patient?.nombre || ""}`;
    if (
      !window.confirm(
        `¿Estás seguro de que querés eliminar el informe "${description}"?`,
      )
    )
      return;
    try {
      await eliminarInformeApi(report.id);
      await load();
      setMessage("Informe eliminado.");
    } catch (error) {
      setMessage(error.message || "No se pudo eliminar el informe.");
    }
  };
  const view = async (report) => {
    const url = URL.createObjectURL(await descargarInformePdfApi(report.id));
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const download = async (report) =>
    downloadBlob(
      await descargarInformePdfApi(report.id),
      `${report.formCode || "informe"}-${report.reportDate}.pdf`,
    );

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
            Documentación clínica
          </p>
          <h2 className="mt-1 text-3xl font-extrabold text-slate-900">
            Informes y planes
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Seleccioná un paciente admitido para consultar o generar
            documentación.
          </p>
        </header>
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {message}
          </div>
        )}
        <section className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-bold text-slate-900">Pacientes admitidos</h3>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar paciente o DNI"
              className={`${inputClass} mt-3`}
            />
            <div className="mt-3 max-h-[580px] space-y-1 overflow-y-auto">
              {filteredPatients.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => selectPatient(item.id)}
                  className={`w-full rounded-xl p-3 text-left ${patientId === item.id ? "bg-emerald-50 ring-1 ring-emerald-300" : "hover:bg-slate-50"}`}
                >
                  <p className="text-sm font-bold text-slate-800">
                    {item.apellido} {item.nombre}
                  </p>
                  <p className="text-xs text-slate-500">
                    DNI {item.dni || "sin DNI"}
                  </p>
                </button>
              ))}
            </div>
          </aside>
          <div>
            {!patient ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-300">
                  person_search
                </span>
                <h3 className="mt-3 font-bold text-slate-800">
                  Seleccioná un paciente
                </h3>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase text-emerald-700">
                    Paciente seleccionado
                  </p>
                  <h3 className="mt-1 text-2xl font-extrabold text-slate-900">
                    {patient.apellido} {patient.nombre}
                  </h3>
                  <p className="text-sm text-slate-500">
                    DNI {patient.dni || "sin dato"} ·{" "}
                    {patient.obraSocial || "Sin obra social"} · Afiliado{" "}
                    {patient.nroAfiliado || "sin dato"}
                  </p>
                  <div className="mt-4 flex gap-1 rounded-xl bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setTab("history")}
                      className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "history" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}
                    >
                      Historial
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("generate")}
                      className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "generate" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}
                    >
                      Generar informe
                    </button>
                  </div>
                </div>
                {tab === "history" ? (
                  <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-bold text-slate-900">
                      Historial de informes
                    </h3>
                    <div className="mt-4 space-y-3">
                      {patientReports.map((report) => (
                        <div
                          key={report.id}
                          className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="font-bold text-slate-800">
                              {typeLabel(report.reportType)} ·{" "}
                              {report.treatmentName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Fecha: <b>{report.reportDate}</b> ·{" "}
                              {report.formCode}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => view(report)}
                              className="rounded-lg border px-3 py-2 text-xs font-bold"
                            >
                              Ver
                            </button>
                            <button
                              type="button"
                              onClick={() => download(report)}
                              className="rounded-lg border px-3 py-2 text-xs font-bold"
                            >
                              Descargar
                            </button>
                            <button
                              type="button"
                              onClick={() => edit(report.id)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(report)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                      ))}
                      {!patientReports.length && (
                        <p className="py-10 text-center text-sm text-slate-500">
                          Este paciente todavía no tiene informes.
                        </p>
                      )}
                    </div>
                  </section>
                ) : (
                  <form
                    onSubmit={saveReport}
                    className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h3 className="font-bold text-slate-900">
                      {editingId ? "Editar informe" : "Generar informe"}
                    </h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label>
                        <span className="mb-1 block text-xs font-bold">
                          Tipo de informe
                        </span>
                        <select
                          value={form.documentType}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              documentType: e.target.value,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="" disabled>
                            Seleccionar tipo de informe
                          </option>
                          {DOCUMENT_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-bold">
                          Prestación
                        </span>
                        <select
                          required
                          value={form.treatmentName}
                          onChange={(e) =>
                            setForm({ ...form, treatmentName: e.target.value })
                          }
                          className={inputClass}
                        >
                          <option value="" disabled>Seleccionar prestación</option>
                          {patient.tratamientos?.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-bold">
                          Fecha
                        </span>
                        <input
                          required
                          type="date"
                          value={form.reportDate}
                          onChange={(e) => changeDate(e.target.value)}
                          className={inputClass}
                        />
                      </label>
                    </div>
                    {form.documentType === "evaluation" && (
                      <>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <label>
                            <span className="mb-1 block text-xs font-bold">
                              Inicial o evolutivo
                            </span>
                            <select
                              value={form.reportType}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  reportType: e.target.value,
                                })
                              }
                              className={inputClass}
                            >
                              <option value="" disabled>
                                Seleccionar etapa
                              </option>
                              {REPORT_TYPES.map((item) => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className="mb-1 block text-xs font-bold">
                              Prestador
                            </span>
                            <input
                              required
                              value={form.content.provider}
                              onChange={(e) =>
                                setContent("provider", e.target.value)
                              }
                              className={inputClass}
                            />
                          </label>
                        </div>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          {[['notes', 'Informe']].map(([key, label]) => (
                            <label
                              key={key}
                              className={
                                "sm:col-span-2"
                              }
                            >
                              <span className="mb-1 block text-xs font-bold">
                                {label}
                              </span>
                              <textarea
                                rows={10}
                                value={form.content[key]}
                                onChange={(e) => setContent(key, e.target.value)}
                                className={inputClass}
                              />
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                    {form.documentType === "treatment_plan" && (
                      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                        Plan de tratamiento seleccionado. El formulario
                        específico se agregará en la próxima etapa.
                      </p>
                    )}
                    <button
                      disabled={
                        busy ||
                        !form.reportType ||
                        !form.treatmentName ||
                        !form.reportDate ||
                        !form.content.provider ||
                        !form.content.notes
                      }
                      className="mt-5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {busy ? "Guardando..." : "Guardar informe"}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
