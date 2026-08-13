const { execSync } = require('child_process');
const fs = require('fs');

const AI_PROVIDER = (process.env.AI_PROVIDER || '').toLowerCase();

function getProvider() {
  if (AI_PROVIDER) return AI_PROVIDER;
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  throw new Error('No se encontró ninguna API key. Define OPENAI_API_KEY, ANTHROPIC_API_KEY o GEMINI_API_KEY.');
}

async function generateOpenAIText(promptText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no configurada.');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.2
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'Error desconocido de OpenAI.';
    throw new Error(`OpenAI falló: ${message}`);
  }

  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function generateAnthropicText(promptText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no configurada.');
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: promptText }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'Error desconocido de Anthropic.';
    throw new Error(`Anthropic falló: ${message}`);
  }

  return (data.content || [])
    .map((item) => item.type === 'text' ? item.text : '')
    .join('')
    .trim();
}

async function listAvailableGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada.');
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'No se pudo listar modelos de Gemini.';
    throw new Error(`Google AI Studio falló: ${message}`);
  }

  return (data.models || [])
    .map((model) => model.name?.replace(/^models\//, ''))
    .filter(Boolean)
    .filter((name) => name.startsWith('gemini-'));
}

async function generateGeminiText(promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada.');
  }

  const preferredModels = [
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
  ].filter(Boolean);

  const availableModels = await listAvailableGeminiModels();
  const modelCandidates = [...new Set([...preferredModels, ...availableModels])];

  let lastError;
  for (const model of modelCandidates) {
    try {
      console.log(`Probando modelo de Gemini: ${model}`);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        lastError = new Error(`Modelo ${model} falló: ${data?.error?.message || 'Error desconocido de Gemini.'}`);
        continue;
      }

      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((part) => part.text || '')
        .join('')
        .trim();

      if (text) {
        return text;
      }

      throw new Error(`Gemini devolvió respuesta vacía con el modelo ${model}.`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('No se pudo generar contenido con Gemini.');
}

async function generateText(promptText) {
  const provider = getProvider();

  if (provider === 'openai') {
    return generateOpenAIText(promptText);
  }

  if (provider === 'anthropic') {
    return generateAnthropicText(promptText);
  }

  if (provider === 'gemini') {
    return generateGeminiText(promptText);
  }

  throw new Error(`Proveedor no soportado: ${provider}`);
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

// 3. Generar el contenido usando la API elegida
async function generateChangelog() {
  try {
    const provider = getProvider();
    console.log(`Usando proveedor de IA: ${provider}`);

    const aiMarkdown = await generateText(promptText);
    const normalizedMarkdown = aiMarkdown
      .replace(/^```markdown\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const formattedDate = `${year}/${month}/${day}`;

    const newEntry = `## [Unreleased] - ${formattedDate}\n\n${normalizedMarkdown}\n\n\n---`;

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