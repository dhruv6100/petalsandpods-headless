export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  const pk = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!pk) {
    return res.status(503).json({ error: 'stripe_config_unavailable', reason: 'env_var_missing' });
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ publishableKey: pk });
}
