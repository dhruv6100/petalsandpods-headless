// pages/api/subscribe.js (ya /api/subscribe.js)
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phoneNumber, listId } = req.body;
  
  const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;

  if (!KLAVIYO_PRIVATE_KEY) {
    console.error('Missing Klaviyo API key');
    return res.status(500).json({ error: 'Klaviyo API key not configured' });
  }

  try {
    // Profile attributes
    const profileData = {};
    if (email) profileData.email = email;
    if (phoneNumber) {
      profileData.phone_number = phoneNumber;
      profileData.properties = { 
        sms_consent: true,
        source: 'website_form'
      };
    }

    console.log('Subscribing to list:', listId, profileData);

    // Klaviyo API call - Subscribe profile to list
    const response = await fetch(`https://a.klaviyo.com/api/lists/${listId}/relationships/profiles/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        'revision': '2025-01-15'
      },
      body: JSON.stringify({
        data: [
          {
            type: 'profile',
            attributes: profileData
          }
        ]
      })
    });

    const responseText = await response.text();
    console.log('Klaviyo response:', response.status, responseText);

    // 201, 202, 409 all mean success/already exists
    if (response.ok || response.status === 202 || response.status === 409) {
      return res.status(200).json({ 
        success: true, 
        message: 'Successfully subscribed!' 
      });
    }

    // Alternative method: create profile first then add to list
    if (response.status === 404 || response.status === 400) {
      // Try create profile endpoint
      const createRes = await fetch('https://a.klaviyo.com/api/profiles/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
          'revision': '2025-01-15'
        },
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes: profileData
          }
        })
      });
      
      if (createRes.ok || createRes.status === 202) {
        return res.status(200).json({ success: true, message: 'Subscribed' });
      }
    }

    return res.status(response.status).json({ 
      error: 'Subscription failed', 
      details: responseText 
    });
    
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}