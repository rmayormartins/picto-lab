// PICTO.lab - proxy da IA (Cloudflare Worker)


export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || 'https://rmayormartins.github.io')
      .split(',').map(s => s.trim()).filter(Boolean);
    const ok = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': ok ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Use POST' }, 405, cors);
    if (!ok) return json({ error: 'Origem não autorizada' }, 403, cors);
    if (!env.GROQ_API_KEY) return json({ error: 'GROQ_API_KEY não configurada no Worker' }, 500, cors);

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'JSON inválido' }, 400, cors); }

    // repassa só o necessário e limita o tamanho da resposta
    const model = env.MODEL || body.model || 'openai/gpt-oss-120b';
    const payload = {
      model,
      messages: Array.isArray(body.messages) ? body.messages.slice(0, 4) : [],
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
      max_tokens: Math.min(Number(body.max_tokens) || 6000, 8000)
    };
    if (/gpt-oss/i.test(model)) payload.reasoning_effort = body.reasoning_effort || 'low';

    const r = await fetch(env.UPSTREAM || 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.GROQ_API_KEY },
      body: JSON.stringify(payload)
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
