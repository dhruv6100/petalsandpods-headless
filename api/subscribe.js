export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phoneNumber, listId } = req.body;

  // Klaviyo Private API Key - Vercel Environment Variable se
  const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;

  if (!KLAVIYO_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Klaviyo API key not configured' });
  }

  try {
    let profileId;

    // Profile data prepare karo
    let profileAttributes = {};
    if (email) profileAttributes.email = email;
    if (phoneNumber) {
      profileAttributes.phone_number = phoneNumber;
      profileAttributes.properties = { sms_consent: true };
    }

    // Profile create/get karo
    const profilePayload = {
      data: {
        type: 'profile',
        attributes: profileAttributes
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

    // 409 = Profile already exists - yeh error nahi hai!
    if (profileResponse.status === 409) {
      // Profile pehle se hai, hume existing profile ID find karni hogi
      // Simple solution: Search for profile by email/phone
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
    } 
    else if (!profileResponse.ok) {
      const error = await profileResponse.text();
      return res.status(profileResponse.status).json({ error: 'Profile creation failed', details: error });
    }
    else {
      const profileResult = await profileResponse.json();
      profileId = profileResult.data.id;
    }

    if (!profileId) {
      return res.status(500).json({ error: 'Could not find or create profile' });
    }

    // Profile ko list mein add karo (agar already hai toh 409 aayega - ignore karo)
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

    // 409 = Already in list - treat as success
    if (listResponse.status === 409 || listResponse.ok) {
      return res.status(200).json({ success: true, message: 'Already subscribed or successfully added' });
    }

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
