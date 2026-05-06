export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phoneNumber, listId } = req.body;

  // Klaviyo Private API Key - Vercel Environment Variable se le
  const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;

  if (!KLAVIYO_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Klaviyo API key not configured' });
  }

  try {
    let profileId;

    // Agar email hai toh profile create karo
    if (email) {
      const profilePayload = {
        data: {
          type: 'profile',
          attributes: {
            email: email
          }
        }
      };

      const profileResponse = await fetch('https://a.klaviyo.com/api/profiles/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
          'revision': '2025-01-15'
        },
        body: JSON.stringify(profilePayload)
      });

      if (!profileResponse.ok) {
        const error = await profileResponse.text();
        return res.status(profileResponse.status).json({ error: 'Profile creation failed', details: error });
      }

      const profileResult = await profileResponse.json();
      profileId = profileResult.data.id;
    }

    // Agar phone hai toh profile create karo (ya same profile update)
    if (phoneNumber) {
      const phonePayload = {
        data: {
          type: 'profile',
          attributes: {
            phone_number: phoneNumber,
            properties: {
              sms_consent: true
            }
          }
        }
      };

      const phoneResponse = await fetch('https://a.klaviyo.com/api/profiles/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
          'revision': '2025-01-15'
        },
        body: JSON.stringify(phonePayload)
      });

      if (!phoneResponse.ok) {
        const error = await phoneResponse.text();
        return res.status(phoneResponse.status).json({ error: 'Profile creation failed', details: error });
      }

      const phoneResult = await phoneResponse.json();
      profileId = phoneResult.data.id;
    }

    // Profile ko list mein add karo
    const subscribePayload = {
      data: [
        {
          type: 'profile',
          id: profileId
        }
      ]
    };

    const listResponse = await fetch(`https://a.klaviyo.com/api/lists/${listId}/relationships/profiles/`, {
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
      return res.status(listResponse.status).json({ error: 'Failed to add to list', details: error });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Klaviyo API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
