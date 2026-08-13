const { execSync } = require('child_process');
const fs = require('fs');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Error: No se encontró GEMINI_API_KEY en las variables de entorno.");
  process.exit(1);
}

const MODEL_PRIORITY = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite'
];

async function listAvailableModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'No se pudo listar los modelos disponibles.';
    throw new Error(`Error al consultar modelos de Gemini: ${message}`);
  }

  return (data.models || [])
    .map((model) => model.name?.replace(/^models\//, ''))
    .filter(Boolean)
    .filter((name) => name.startsWith('gemini-'));
}

async function chooseModel() {
  const availableModels = await listAvailableModels();

  for (const preferred of MODEL_PRIORITY) {
    if (availableModels.includes(preferred)) {
      return preferred;
    }
  }

  if (availableModels.length > 0) {
    return availableModels[0];
  }

  throw new Error('No se encontraron modelos Gemini disponibles para esta API key.');
}

async function generateGeminiText(promptText) {
  const model = await chooseModel();
  console.log(`Usando modelo de Gemini: ${model}`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptText }]
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'No se pudo generar contenido con Gemini.';
    throw new Error(`Modelo ${model} falló: ${message}`);
  }

  return (data.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || '')
    .join('')
    .trim();
}

// 1. Obtener los últimos 20 commits
let gitLog = '';
try {
  gitLog = execSync('git log -n 20 --pretty=format:"- %s (%h)"').toString();
} catch (error) {
  console.error('Error al obtener los commits de git:', error);
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

// 3. Generar el contenido usando la API REST de Google AI Studio
async function generateChangelog() {
  try {
    const aiMarkdown = await generateGeminiText(promptText);
    const normalizedMarkdown = aiMarkdown
      .replace(/^```markdown\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    // Formatear la fecha en YYYY/MM/DD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const formattedDate = `${year}/${month}/${day}`;

    const newEntry = `## [Unreleased] - ${formattedDate}\n\n${normalizedMarkdown}\n\n\n---`;

    // Leer o crear CHANGELOG.md
    const currentContent = fs.existsSync('CHANGELOG.md')
      ? fs.readFileSync('CHANGELOG.md', 'utf8')
      : '# CHANGELOG\n\n';

    let updatedContent = '';
    if (currentContent.startsWith('# CHANGELOG\n\n')) {
      updatedContent = currentContent.replace('# CHANGELOG\n\n', `# CHANGELOG\n\n${newEntry}\n\n`);
    } else {
      updatedContent = `# CHANGELOG\n\n${newEntry}\n\n${currentContent}`;
    }

    fs.writeFileSync('CHANGELOG.md', updatedContent);
    console.log('✅ CHANGELOG.md actualizado con éxito.');
  } catch (err) {
    console.error('❌ Error inesperado al generar el changelog:', err.message || err);
    process.exit(1);
  }
}

generateChangelog();