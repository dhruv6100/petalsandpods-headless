export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phoneNumber, listId } = req.body;

  // Klaviyo Private API Key (yeh Vercel Environment variable mein dalna)
  const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;

  if (!KLAVIYO_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Klaviyo API key not configured' });
  }

  // Prepare profile data
  const profileData = {};
  if (email) profileData.email = email;
  if (phoneNumber) {
    profileData.phone_number = phoneNumber;
    profileData.properties = { sms_consent: true };
  }

  const payload = {
    data: {
      type: 'profile',
      attributes: {
        email: profileData.email,
        phone_number: profileData.phone_number,
        properties: profileData.properties || {}
      }
    }
  };

  try {
    // First: Create or get profile
    const profileResponse = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        'revision': '2025-01-15'
      },
      body: JSON.stringify(payload)
    });

    if (!profileResponse.ok) {
      const error = await profileResponse.text();
      return res.status(profileResponse.status).json({ error });
    }

    const profileResult = await profileResponse.json();
    const profileId = profileResult.data.id;

    // Second: Add profile to list
    const subscribePayload = {
      data: [
        {
          type: 'profile',
          id: profileId
        }
      ]
    };

    const listResponse = await fetch(`https://a.klaviyo.com/api/lists/${listId}/profiles/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        'revision': '2025-01-15'
      },
      body: JSON.stringify(subscribePayload)
    });

    if (!listResponse.ok) {
      const error = await listResponse.text();
      return res.status(listResponse.status).json({ error });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Klaviyo API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}