// pages/api/subscribe.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, phoneNumber, listId } = req.body;
  const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;

  if (!KLAVIYO_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Klaviyo API key not configured' });
  }

  try {
    const profileData = {};
    if (email) profileData.email = email;
    if (phoneNumber) profileData.phone_number = phoneNumber;

    const response = await fetch(`https://a.klaviyo.com/api/lists/${listId}/profiles/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        'revision': '2025-01-15'
      },
      body: JSON.stringify({ data: { type: 'profile', attributes: profileData } })
    });

    if (response.ok || response.status === 202 || response.status === 409) {
      return res.status(200).json({ success: true });
    }

    return res.status(response.status).json({ error: 'Subscription failed' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}