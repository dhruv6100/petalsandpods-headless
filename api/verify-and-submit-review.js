export const config = { runtime: 'edge' };

const KLAVIYO_REVIEWS_KEY = process.env.KLAVIYO_REVIEWS_KEY;
const WC_CONSUMER_KEY = process.env.WC_CONSUMER_KEY;
const WC_CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET;
const REVISION = '2024-10-15';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const { action, email, review } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // STEP 1: Verify profile exists in Klaviyo
    const lookupUrl = `https://a.klaviyo.com/api/profiles/?filter=equals(email,"${encodeURIComponent(email)}")`;
    const lookupRes = await fetch(lookupUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Klaviyo-API-Key ${KLAVIYO_REVIEWS_KEY}`,
        'revision': REVISION,
        'Accept': 'application/json'
      }
    });

    if (!lookupRes.ok) {
      const errBody = await lookupRes.text();
      return new Response(JSON.stringify({ error: 'Verification failed', detail: errBody }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const lookupData = await lookupRes.json();
    const profileExists = lookupData.data && lookupData.data.length > 0;

    if (action === 'verify') {
      return new Response(JSON.stringify({ verified: profileExists }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'submit') {
      if (!profileExists) {
        return new Response(JSON.stringify({ error: 'Email not verified' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }

      if (!review || !review.rating || !review.headline || !review.body || !review.product) {
        return new Response(JSON.stringify({ error: 'Missing review fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      if (!review.product_id) {
        return new Response(JSON.stringify({ error: 'Missing product ID' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Persist review to WooCommerce moderation queue (status: hold)
      const wcAuth = btoa(WC_CONSUMER_KEY + ':' + WC_CONSUMER_SECRET);
      const wcRes = await fetch('https://shop.petalsandpods.com/wp-json/wc/v3/products/reviews', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + wcAuth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: review.product_id,
          review: review.headline + '\n\n' + review.body,
          reviewer: review.name || 'Anonymous',
          reviewer_email: email,
          rating: review.rating,
          status: 'hold'
        })
      });

      if (!wcRes.ok) {
        const errBody = await wcRes.text();
        return new Response(JSON.stringify({ error: 'Review submission failed', detail: errBody }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

      // Track in Klaviyo (best-effort — don't fail if this errors)
      const profileId = lookupData.data[0].id;
      try {
        const eventPayload = {
          data: {
            type: 'event',
            attributes: {
              properties: {
                product: review.product,
                product_handle: review.productHandle || '',
                rating: review.rating,
                headline: review.headline,
                body: review.body,
                reviewer_name: review.name || 'Anonymous',
                submitted_at: new Date().toISOString(),
                moderation_status: 'pending'
              },
              metric: { data: { type: 'metric', attributes: { name: 'Submitted Review' } } },
              profile: { data: { type: 'profile', id: profileId } }
            }
          }
        };

        await fetch('https://a.klaviyo.com/api/events/', {
          method: 'POST',
          headers: {
            'Authorization': `Klaviyo-API-Key ${KLAVIYO_REVIEWS_KEY}`,
            'revision': REVISION,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(eventPayload)
        });
      } catch (_) { /* Klaviyo tracking is best-effort */ }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Server error', detail: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
