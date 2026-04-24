const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(key) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  existing.count += 1;
  if (existing.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  return false;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(`meme:${clientIp}`)) {
    return res.status(429).json({ error: 'Rate limit hit: max 5 uploads per hour per IP or device.' });
  }

  const rawQuery = typeof req.query?.q === 'string' ? req.query.q : '';
  const query = rawQuery.trim().slice(0, 120);
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter q.' });
  }

  const rawLimit = Number(req.query?.limit || DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const apiKey = process.env.TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
  const searchQuery = encodeURIComponent(query);
  const url = `https://tenor.googleapis.com/v2/search?q=${searchQuery}&key=${apiKey}&limit=${limit}&media_filter=gif`;

  try {
    const upstreamResponse = await fetch(url);
    if (!upstreamResponse.ok) {
      const upstreamError = await upstreamResponse.text();
      console.error('meme upstream error', upstreamError.slice(0, 400));
      return res.status(502).json({ error: 'Meme provider request failed.' });
    }

    const data = await upstreamResponse.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('meme error', error?.message || error);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
};