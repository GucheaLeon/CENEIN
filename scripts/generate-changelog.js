const { execSync } = require('child_process');
const fs = require('fs');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error("❌ Error: No se encontró GROQ_API_KEY en las variables de entorno.");
  process.exit(1);
}

// 1. Obtener los últimos 20 commits de git
let gitLog = '';
try {
  gitLog = execSync('git log -n 20 --pretty=format:"- %s (%h)"').toString();
} catch (error) {
  console.error("❌ Error al obtener los commits de git:", error);
  process.exit(1);
}

// 2. Prompt con el formato exacto de tu proyecto
const promptText = `
Eres un asistente técnico encargado de mantener el CHANGELOG de un proyecto de software.
Analiza los siguientes commits de Git (pueden ser poco precisos, informales o desordenados) y sintetízalos respetando ESTRICTAMENTE el formato que utiliza el proyecto.

REGLAS DE FORMATO Y ESTILO:
1. Agrupa y sintetiza los cambios reales en español.
2. Descarta commits irrelevantes (ej: "typo", "wip", "merge", "arreglos menores").
3. Usa ÚNICAMENTE estas secciones según corresponda (puedes omitir las que no tengan ítems):
   ### agregado
   ### modificado
   ### Testing
4. Cada ítem debe comenzar con '* ' (asterisco y espacio).
5. No incluyas bloques de código (\`\`\`markdown), ni saludos, ni comentarios adicionales. Solo el contenido Markdown de las secciones.

Commits a analizar:
${gitLog}
`;

// 3. Llamada a la API gratuita de Groq (Llama 3.3)
async function generateChangelog() {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: promptText }
        ],
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

    // Formatear la fecha en YYYY/MM/DD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const formattedDate = `${year}/${month}/${day}`;

    // Construir la nueva entrada
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
    console.log("✅ CHANGELOG.md actualizado con éxito con Groq (Llama 3.3).");

  } catch (err) {
    console.error("❌ Error inesperado:", err);
    process.exit(1);
  }
}

generateChangelog();