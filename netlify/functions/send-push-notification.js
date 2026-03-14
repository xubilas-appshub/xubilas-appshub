export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '368b352f-fed6-46db-b501-b5b2cb592949';
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!ONESIGNAL_REST_API_KEY) {
    console.error('ONESIGNAL_REST_API_KEY environment variable is not set');
    return new Response(JSON.stringify({
      error: 'Push notification service not configured. Set the ONESIGNAL_REST_API_KEY environment variable.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { title, message, url } = await req.json();

    if (!title || !message) {
      return new Response(JSON.stringify({ error: 'Title and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ['Subscribed Users'],
      headings: { en: title },
      contents: { en: message },
    };

    if (url) {
      notificationPayload.url = url;
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(notificationPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OneSignal API error:', data);
      return new Response(JSON.stringify({
        error: 'Failed to send push notification',
        details: data
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      recipients: data.recipients
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
