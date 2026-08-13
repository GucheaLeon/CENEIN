const { GoogleGenAI } = require('@google/genai');
const { execSync } = require('child_process');
const fs = require('fs');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

if (!GEMINI_API_KEY) {
  console.error("❌ Error: No se encontró GEMINI_API_KEY en las variables de entorno.");
  process.exit(1);
}

// Inicializar el cliente de Google Gen AI
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 1. Obtener los últimos 20 commits
let gitLog = '';
try {
  gitLog = execSync('git log -n 20 --pretty=format:"- %s (%h)"').toString();
} catch (error) {
  console.error("Error al obtener los commits de git:", error);
  process.exit(1);
}

// 2. Prompt personalizado
const promptText = `
Eres un asistente técnico encargado de mantener el CHANGELOG de un proyecto de software.
Analiza los siguientes commits de Git (pueden ser poco precisos, informales o desordenados) y sintetízalos respetando ESTRICTAMENTE el formato que utiliza el proyecto.

REGLAS DE FORMATO Y ESTILO:
1. Agrupa y sintetiza los cambios reales en español.
2. Descarta commits irrelevantes (ej: "typo", "wip", "merge", "arreglos menores").
3. Usa ÚNICAMENTE estas secciones según corresponda (puedes omitir las que no tengan ítems):
   ### Agregado
   ### Modificado
   ### Testing
   ### Eliminado
4. Cada ítem debe comenzar con '* ' (asterisco y espacio).
5. No incluyas bloques de código (\`\`\`markdown), ni saludos, ni comentarios adicionales. Solo el contenido Markdown de las secciones.

Commits a analizar:
${gitLog}
`;

// 3. Generar el contenido usando el SDK
async function generateChangelog() {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: promptText,
    });

    let aiMarkdown = response.text.trim();
    aiMarkdown = aiMarkdown.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');

    // Formatear la fecha en YYYY/MM/DD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const formattedDate = `${year}/${month}/${day}`;

    const newEntry = `## [Unreleased] - ${formattedDate}\n\n${aiMarkdown}\n\n\n---`;

    // Leer o crear CHANGELOG.md
    let currentContent = fs.existsSync('CHANGELOG.md')
      ? fs.readFileSync('CHANGELOG.md', 'utf8')
      : '# CHANGELOG\n\n';

    let updatedContent = '';
    if (currentContent.startsWith('# CHANGELOG\n\n')) {
      updatedContent = currentContent.replace('# CHANGELOG\n\n', `# CHANGELOG\n\n${newEntry}\n\n`);
    } else {
      updatedContent = `# CHANGELOG\n\n${newEntry}\n\n${currentContent}`;
    }

    fs.writeFileSync('CHANGELOG.md', updatedContent);
    console.log("✅ CHANGELOG.md actualizado con éxito.");

  } catch (err) {
    console.error("❌ Error inesperado al generar el changelog:", err);
    process.exit(1);
  }
}

generateChangelog();