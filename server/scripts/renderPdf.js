import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";

export async function renderPdf({ template, output, data, mapping }) {
  const bytes = fs.readFileSync(template);
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPages()[0];

  for (const key in mapping) {
    if (key === "_meta") continue;
    if (!data[key]) continue;

    const { x, y, size } = mapping[key];
    page.drawText(String(data[key]), {
      x,
      y,
      size,
      color: rgb(0, 0, 0)
    });
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, await pdf.save());
}
