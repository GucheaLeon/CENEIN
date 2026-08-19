const { execSync } = require('child_process');
const fs = require('fs');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL_OVERRIDE = process.env.GROQ_MODEL;
const GROQ_API_URL = 'https://api.groq.com/openai/v1';
const PREFERRED_GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

if (!GROQ_API_KEY) {
  console.error("❌ Error: No se encontró GROQ_API_KEY en las variables de entorno.");
  process.exit(1);
}

// 1. Obtener el último Tag de Git (si no existe, toma v1.1.3 como base)
let lastTag = '';
try {
  lastTag = execSync('git describe --tags --abbrev=0').toString().trim();
  console.log(`🏷️ Último tag encontrado en Git: ${lastTag}`);
} catch (e) {
  lastTag = 'v1.1.3';
  console.log(`🏷️ No se encontraron tags previos en Git. Usando base: ${lastTag}`);
}

// 2. Obtener commits posteriores al último tag
let gitLog = '';
try {
  // Verificar si el tag existe realmente en el historial local
  const tagExists = execSync(`git tag -l "${lastTag}"`).toString().trim();
  
  if (tagExists) {
    gitLog = execSync(`git log ${lastTag}..HEAD --pretty=format:"- %s (%h)"`).toString().trim();
  } else {
    gitLog = execSync('git log -n 15 --pretty=format:"- %s (%h)"').toString().trim();
  }
} catch (error) {
  console.error("❌ Error al obtener los commits de git:", error);
  process.exit(1);
}

if (!gitLog) {
  console.log("ℹ️ No hay commits nuevos desde el último tag. No se requiere nueva versión.");
  process.exit(0);
}

console.log("📝 Commits a analizar para la nueva versión:\n" + gitLog);

// 3. Función para incrementar el número de versión (SemVer)
function incrementVersion(latestTag, commitsLog) {
  let [major, minor, patch] = [1, 1, 3];

  if (latestTag) {
    const cleanTag = latestTag.replace(/^v/, '');
    const parts = cleanTag.split('.').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      [major, minor, patch] = parts;
    }
  }

  const logLower = commitsLog.toLowerCase();

  // Reglas de incremento de versión según el tipo de commit
  if (logLower.includes('breaking change') || logLower.includes('major:')) {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (logLower.includes('feat:') || logLower.includes('agregado') || logLower.includes('feature:')) {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `v${major}.${minor}.${patch}`;
}

function parseSections(markdown) {
  const sectionPattern = /^###\s+(.+)\s*$/gm;
  const matches = [...markdown.matchAll(sectionPattern)];

  return matches.map((match, index) => {
    const contentStart = match.index + match[0].length;
    const nextSection = matches[index + 1];
    const contentEnd = nextSection ? nextSection.index : markdown.length;

    return {
      title: match[1].trim(),
      content: markdown.slice(contentStart, contentEnd).trim(),
    };
  });
}

function mergeChangelogSections(existingMarkdown, incomingMarkdown) {
  let mergedMarkdown = existingMarkdown.trim();

  for (const incomingSection of parseSections(incomingMarkdown)) {
    const escapedTitle = incomingSection.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionPattern = new RegExp(`^###\\s+${escapedTitle}\\s*$`, 'im');
    const sectionMatch = sectionPattern.exec(mergedMarkdown);

    if (!sectionMatch) {
      mergedMarkdown += `\n\n### ${incomingSection.title}\n${incomingSection.content}`;
      continue;
    }

    const contentStart = sectionMatch.index + sectionMatch[0].length;
    const nextSectionMatch = /\n###\s+.+\s*$/im.exec(mergedMarkdown.slice(contentStart));
    const contentEnd = nextSectionMatch
      ? contentStart + nextSectionMatch.index
      : mergedMarkdown.length;
    const existingContent = mergedMarkdown.slice(contentStart, contentEnd).trim();
    const existingItems = new Set(existingContent.split('\n').map((line) => line.trim()).filter(Boolean));
    const newItems = incomingSection.content
      .split('\n')
      .filter((line) => line.trim() && !existingItems.has(line.trim()))
      .join('\n');

    if (newItems) {
      const separator = existingContent ? '\n' : '';
      mergedMarkdown = `${mergedMarkdown.slice(0, contentEnd).trimEnd()}${separator}${newItems}${mergedMarkdown.slice(contentEnd)}`;
    }
  }

  return mergedMarkdown;
}

const newVersionTag = incrementVersion(lastTag, gitLog);
console.log(`🚀 Nueva versión calculada: ${newVersionTag}`);

// 4. Prompt para la IA
const promptText = `
Eres un asistente técnico encargado de mantener el CHANGELOG de un proyecto de software.
Analiza los siguientes commits de Git y sintetízalos respetando ESTRICTAMENTE el formato que utiliza el proyecto.

REGLAS DE FORMATO Y ESTILO:
1. Agrupa y sintetiza los cambios reales en español.
2. Descarta commits irrelevantes (ej: "typo", "wip", "merge", "arreglos menores", "docs: update CHANGELOG", "chore:").
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

async function obtenerModeloGroq() {
  const response = await fetch(`${GROQ_API_URL}/models`, {
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
  });
  const data = await response.json();

  if (!response.ok || !Array.isArray(data?.data)) {
    throw new Error(`No se pudo consultar los modelos disponibles de Groq: ${JSON.stringify(data)}`);
  }

  const availableModels = data.data
    .map((model) => String(model?.id || '').trim())
    .filter((model) => model && !/(whisper|tts|guard|safeguard|distil)/i.test(model));

  if (GROQ_MODEL_OVERRIDE && availableModels.includes(GROQ_MODEL_OVERRIDE)) {
    return GROQ_MODEL_OVERRIDE;
  }

  const selectedModel = PREFERRED_GROQ_MODELS.find((model) => availableModels.includes(model));
  if (selectedModel) return selectedModel;

  const fallbackModel = availableModels[0];
  if (fallbackModel) return fallbackModel;

  throw new Error('Groq no devolvió ningún modelo compatible para generar el changelog.');
}

// 5. Generación del contenido con la API de Groq
async function generateChangelog() {
  try {
    const model = await obtenerModeloGroq();
    console.log(`🤖 Modelo de Groq seleccionado automáticamente: ${model}`);

    const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Error de la API de Groq:", JSON.stringify(data));
      process.exit(1);
    }

    let aiMarkdown = data.choices[0].message.content.trim();
    aiMarkdown = aiMarkdown.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');

    if (!aiMarkdown) {
      console.log("ℹ️ La IA determinó que no hay cambios significativos para registrar.");
      process.exit(0);
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const formattedDate = `${year}/${month}/${day}`;

    let currentContent = '';
    if (fs.existsSync('CHANGELOG.md')) {
      currentContent = fs.readFileSync('CHANGELOG.md', 'utf8').trim();
    }

    const header = '# CHANGELOG';
    const restOfFile = currentContent.startsWith(header)
      ? currentContent.slice(header.length).trim()
      : currentContent;
    const latestEntryPattern = /^(## \[([^\]]+)\] - (\d{4}\/\d{2}\/\d{2})\n\n)([\s\S]*?)(\n\n---)/;
    const latestEntry = latestEntryPattern.exec(restOfFile);
    const sameDayEntry = latestEntry && latestEntry[3] === formattedDate ? latestEntry : null;

    let updatedContent = '';
    if (sameDayEntry) {
      const mergedBody = mergeChangelogSections(sameDayEntry[4], aiMarkdown);
      const mergedEntry = `${sameDayEntry[1]}${mergedBody}${sameDayEntry[5]}`;
      const updatedRestOfFile = restOfFile.replace(latestEntry[0], mergedEntry);
      updatedContent = `${header}\n\n${updatedRestOfFile}\n`;
      fs.writeFileSync('CHANGELOG.md', updatedContent.trim() + '\n');
      fs.writeFileSync('NEW_TAG.txt', `v${sameDayEntry[2]}`);
      console.log(`✅ CHANGELOG.md actualizado en la versión ${sameDayEntry[2]} del ${formattedDate}.`);
      return;
    }

    const versionNumberOnly = newVersionTag.replace(/^v/, '');
    const newEntry = `## [${versionNumberOnly}] - ${formattedDate}\n\n${aiMarkdown}\n\n\n---`;

    if (!currentContent) {
      updatedContent = `# CHANGELOG\n\n${newEntry}\n`;
    } else if (currentContent.startsWith(header)) {
      updatedContent = `${header}\n\n${newEntry}\n\n${restOfFile}\n`;
    } else {
      updatedContent = `# CHANGELOG\n\n${newEntry}\n\n${currentContent}\n`;
    }

    fs.writeFileSync('CHANGELOG.md', updatedContent.trim() + '\n');
    
    // Archivo temporal para comunicar el nuevo tag a la Action
    fs.writeFileSync('NEW_TAG.txt', newVersionTag);

    console.log(`✅ CHANGELOG.md actualizado con éxito para la versión ${newVersionTag}.`);

  } catch (err) {
    console.error("❌ Error inesperado:", err);
    process.exit(1);
  }
}

generateChangelog();