const WC_STORE_URL      = process.env.WC_STORE_URL;
const WC_CONSUMER_KEY   = process.env.WC_CONSUMER_KEY;
const WC_CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET;

// In-memory cache: { value, expires }
let _cache = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  if (!WC_STORE_URL || !WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) {
    return res.status(503).json({ error: 'stripe_config_unavailable' });
  }

  // Return cached value if still fresh
  if (_cache && Date.now() < _cache.expires) {
    return res.status(200).json(_cache.value);
  }

  try {
    const auth = btoa(WC_CONSUMER_KEY + ':' + WC_CONSUMER_SECRET);
    const upstream = await fetch(
      `${WC_STORE_URL}/wp-json/wc/v3/payment_gateways/stripe`,
      {
        headers: { Authorization: 'Basic ' + auth },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!upstream.ok) {
      return res.status(503).json({ error: 'stripe_config_unavailable' });
    }

    const data = await upstream.json();

    // Extract publishable key from settings
    const pk = data.settings
      && data.settings.publishable_key
      && data.settings.publishable_key.value;

    if (!pk) {
      return res.status(503).json({ error: 'stripe_config_unavailable' });
    }

    const payload = { publishableKey: pk };
    _cache = { value: payload, expires: Date.now() + CACHE_TTL_MS };

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(503).json({ error: 'stripe_config_unavailable' });
  }
}
