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
    return res.status(503).json({
      error: 'stripe_config_unavailable',
      debug_reason: 'missing_env_vars',
      debug_has_url: !!WC_STORE_URL,
      debug_has_key: !!WC_CONSUMER_KEY,
      debug_has_secret: !!WC_CONSUMER_SECRET,
    });
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
      return res.status(503).json({
        error: 'stripe_config_unavailable',
        debug_reason: 'upstream_not_ok',
        debug_status: upstream.status,
      });
    }

    const data = await upstream.json();

    console.log('WC stripe gateway response keys:', Object.keys(data));
    console.log('WC stripe settings keys:', data.settings ? Object.keys(data.settings) : 'NO_SETTINGS');
    console.log('WC stripe full response:', JSON.stringify(data, null, 2));

    // Extract publishable key from settings
    const pk = data.settings
      && data.settings.publishable_key
      && data.settings.publishable_key.value;

    if (!pk) {
      return res.status(503).json({
        error: 'stripe_config_unavailable',
        debug_settings_keys: data.settings ? Object.keys(data.settings) : null,
        debug_data_keys: Object.keys(data),
      });
    }

    const payload = { publishableKey: pk };
    _cache = { value: payload, expires: Date.now() + CACHE_TTL_MS };

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(503).json({
      error: 'stripe_config_unavailable',
      debug_reason: 'catch_error',
      debug_message: err.message,
    });
  }
}
