export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
  
  // Get Klaviyo API key from environment variable
  const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;

  if (!KLAVIYO_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Klaviyo API key not configured' });
  }

  try {
    // Prepare profile data
    const profileData = {};
    if (email) profileData.email = email;
    if (phoneNumber) {
      profileData.phone_number = phoneNumber;
      profileData.properties = { sms_consent: true };
    }

    console.log('Subscribing to list:', listId, 'with data:', profileData);

    // Direct subscription to list
    const response = await fetch(`https://a.klaviyo.com/api/lists/${listId}/profiles/`, {
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

    const responseText = await response.text();
    console.log('Klaviyo response status:', response.status);
    console.log('Klaviyo response body:', responseText);

    // 200, 201, 202, 409 all mean success
    if (response.ok || response.status === 202 || response.status === 409) {
      return res.status(200).json({ 
        success: true, 
        message: 'Successfully subscribed!' 
      });
    }

    // If we get here, something went wrong
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
