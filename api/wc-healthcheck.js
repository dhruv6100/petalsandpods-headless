const WC_STORE_URL = process.env.WC_STORE_URL;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  if (!WC_STORE_URL) {
    return res.status(500).json({ ok: false, error: 'WC_STORE_URL not configured' });
  }

  try {
    const upstream = await fetch(
      `${WC_STORE_URL}/wp-json/wc/store/v1/products?per_page=1`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!upstream.ok) {
      return res.status(200).json({
        ok: false,
        wcReachable: true,
        wcStatus: upstream.status,
        error: 'WooCommerce returned non-2xx',
      });
    }

    const data = await upstream.json();
    const productCount = Array.isArray(data) ? (data.length > 0 ? data.length + '+' : 'empty') : 'unknown';

    return res.status(200).json({ ok: true, wcReachable: true, productCount });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      wcReachable: false,
      error: 'Could not reach WooCommerce',
    });
  }
}
