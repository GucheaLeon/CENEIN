const { execSync } = require('child_process');
const fs = require('fs');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

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

const newVersionTag = incrementVersion(lastTag, gitLog);
const versionNumberOnly = newVersionTag.replace(/^v/, '');
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

// 5. Generación del contenido con la API de Groq
async function generateChangelog() {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
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

    // Nueva entrada en el CHANGELOG
    const newEntry = `## [${versionNumberOnly}] - ${formattedDate}\n\n${aiMarkdown}\n\n\n---`;

    let currentContent = '';
    if (fs.existsSync('CHANGELOG.md')) {
      currentContent = fs.readFileSync('CHANGELOG.md', 'utf8').trim();
    }

    let updatedContent = '';
    if (!currentContent) {
      updatedContent = `# CHANGELOG\n\n${newEntry}\n`;
    } else if (currentContent.startsWith('# CHANGELOG')) {
      const header = '# CHANGELOG';
      const restOfFile = currentContent.slice(header.length).trim();
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