const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const MAX_IMAGE_BASE64_LENGTH = 5_000_000;
const MAX_DEVICE_ID_LENGTH = 80;

const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function getClientDeviceId(req) {
  const deviceIdHeader = req.headers['x-device-id'];
  if (typeof deviceIdHeader !== 'string' || !deviceIdHeader.trim()) {
    return '';
  }

  return deviceIdHeader
    .trim()
    .slice(0, MAX_DEVICE_ID_LENGTH)
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function touchRateLimitBucket(key) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return {
      limited: false,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt
    };
  }

  existing.count += 1;
  return {
    limited: existing.count > RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(RATE_LIMIT_MAX_REQUESTS - existing.count, 0),
    resetAt: existing.resetAt
  };
}

function applyRateLimit(req, res, scope) {
  const clientIp = getClientIp(req);
  const clientDeviceId = getClientDeviceId(req);
  const keys = [`${scope}:ip:${clientIp}`];

  if (clientDeviceId) {
    keys.push(`${scope}:device:${clientDeviceId}`);
  }

  const states = keys.map((key) => touchRateLimitBucket(key));
  const mostConservative = states.reduce((acc, current) => {
    if (!acc || current.remaining < acc.remaining) {
      return current;
    }
    return acc;
  }, null);

  const limited = states.some((state) => state.limited);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const resetSeconds = Math.floor((mostConservative?.resetAt || Date.now()) / 1000);
  const retryAfter = Math.max(resetSeconds - nowSeconds, 1);

  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
  res.setHeader('X-RateLimit-Remaining', String(mostConservative?.remaining ?? 0));
  res.setHeader('X-RateLimit-Reset', String(resetSeconds));
  if (limited) {
    res.setHeader('Retry-After', String(retryAfter));
  }

  return limited;
}

function buildPrompt() {
  return `You are a Tamil meme expert. Look CAREFULLY at this person's face and body language.

1. EXPRESSION: What do you see? Look for:
   - Facial expression (smiling, sad, angry, shocked, thinking, bored, confused)
   - Eye gestures (winking, one eye closed, rolling eyes, wide eyes, sleepy eyes)
   - Hand gestures (thumbs up, peace sign, hand on chin, facepalm, pointing)
   - Poses (leaning, slouching, arms crossed, shrugging)
   - Mouth (tongue out, lips pursed, mouth open, smirking)

2. ROAST: Write a funny Tanglish caption (Tamil + English, max 12 words) matching what they're doing.

3. SEARCH: Based on your ROAST theme, give a Tamil meme search query.

RESPOND ONLY WITH JSON:
{"expression": "detailed pose", "caption": "Tanglish roast", "search": "Tamil meme topic"}`;
}

function parseModelJson(content) {
  if (!content || typeof content !== 'string') return null;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== 'object') return null;
    const expression = String(parsed.expression || '').slice(0, 300);
    const caption = String(parsed.caption || '').slice(0, 240);
    const search = String(parsed.search || '').slice(0, 120);
    if (!search) return null;
    return { expression, caption, search };
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (applyRateLimit(req, res, 'analyze')) {
    return res.status(429).json({ error: 'Rate limit hit: max 5 uploads per hour per IP or device.' });
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

  if (!endpoint || !apiKey) {
    return res.status(500).json({ error: 'Server is not configured for AI analysis.' });
  }

  const imageBase64 = req.body?.imageBase64;
  if (typeof imageBase64 !== 'string' || imageBase64.length < 100 || imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return res.status(400).json({ error: 'Invalid image payload.' });
  }

  const safeEndpoint = endpoint.replace(/\/$/, '');
  const url = `${safeEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  try {
    const upstreamResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt() },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } }
          ]
        }],
        max_tokens: 180,
        temperature: 0.8
      })
    });

    if (!upstreamResponse.ok) {
      const upstreamError = await upstreamResponse.text();
      console.error('analyze upstream error', upstreamError.slice(0, 400));
      return res.status(502).json({ error: 'AI provider request failed.' });
    }

    const data = await upstreamResponse.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = parseModelJson(content);
    if (!parsed) {
      return res.status(200).json({
        expression: 'neutral face',
        caption: 'Idhu enna plotting da?',
        search: 'Tamil reaction meme'
      });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('analyze error', error?.message || error);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
};
