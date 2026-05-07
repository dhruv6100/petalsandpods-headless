export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phoneNumber, listId } = req.body;
  
  // Klaviyo API Key - Environment variable se le
  const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;

  if (!KLAVIYO_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Klaviyo API key not configured' });
  }

  try {
    let profileAttributes = {};
    if (email) profileAttributes.email = email;
    if (phoneNumber) {
      profileAttributes.phone_number = phoneNumber;
      profileAttributes.properties = { sms_consent: true };
    }

    // Profile create karo
    const profileResponse = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        'revision': '2025-01-15'
      },
      body: JSON.stringify({
        data: {
          type: 'profile',
          attributes: profileAttributes
        }
      })
    });

    let profileId;
    
    if (profileResponse.status === 409) {
      // Profile already exists - search karo
      const searchParams = new URLSearchParams();
      if (email) searchParams.append('filter', `equals(email,"${email}")`);
      if (phoneNumber) searchParams.append('filter', `equals(phone_number,"${phoneNumber}")`);
      
      const searchResponse = await fetch(`https://a.klaviyo.com/api/profiles/?${searchParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
          'revision': '2025-01-15'
        }
      });
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          profileId = searchData.data[0].id;
        }
      }
    } else if (profileResponse.ok) {
      const profileResult = await profileResponse.json();
      profileId = profileResult.data.id;
    } else {
      const error = await profileResponse.text();
      return res.status(profileResponse.status).json({ error: 'Profile creation failed', details: error });
    }

    if (!profileId) {
      return res.status(500).json({ error: 'Could not find or create profile' });
    }

    // List mein add karo
    const listResponse = await fetch(`https://a.klaviyo.com/api/lists/${listId}/relationships/profiles/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        'revision': '2025-01-15'
      },
      body: JSON.stringify({
        data: [{ type: 'profile', id: profileId }]
      })
    });

    if (listResponse.status === 409 || listResponse.ok) {
      return res.status(200).json({ success: true, message: 'Successfully subscribed!' });
    }

    const error = await listResponse.text();
    return res.status(listResponse.status).json({ error: 'Failed to add to list', details: error });
    
  } catch (error) {
    console.error('Klaviyo API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
