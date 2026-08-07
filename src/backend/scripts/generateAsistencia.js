import fs from "fs";
import path from "path";
import { renderPdf } from "./renderPdf.js";

export async function generateAsistencia({
  paciente,
  profesional,
  sesion,
  obraSocial   
}) {
  const basePath = path.resolve(
    "templates/obras-sociales",
    obraSocial
  );

  if (!fs.existsSync(basePath)) {
    throw new Error(`Obra social no encontrada: ${obraSocial}`);
  }

  const template = path.join(basePath, "template.pdf");
  const mappingPath = path.join(basePath, "mapping.json");

  if (!fs.existsSync(template) || !fs.existsSync(mappingPath)) {
    throw new Error(`Faltan archivos en ${obraSocial}`);
  }

  const mapping = JSON.parse(fs.readFileSync(mappingPath));

  const output = path.resolve(
    "data/pacientes",
    paciente.nombre.replace(/\s+/g, "_"),
    obraSocial,
    `${sesion.fecha}.pdf`
  );

  const data = {
    nombre: paciente.nombre,
    dni: paciente.dni,
    fecha: sesion.fecha,
    diagnostico: paciente.diagnostico,
    profesional: profesional.nombre
  };

  await renderPdf({
    template,
    output,
    data,
    mapping
  });

  return output;
}
