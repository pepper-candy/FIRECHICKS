/**
 * Vercel Serverless Function
 * Route: /api/turn-credentials
 *
 * Security: Cloudflare TURN Token ID + API Token must stay server-side.
 * This endpoint returns only short-lived WebRTC ICE server credentials.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const tokenId = process.env.CLOUDFLARE_TURN_TOKEN_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (!tokenId || !apiToken) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'TURN credentials are not configured on the server.' }));
    return;
  }

  try {
    const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(
      tokenId,
    )}/credentials/generate-ice-servers`;

    const cfResp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: 86400 }),
    });

    const text = await cfResp.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!cfResp.ok) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(
        JSON.stringify({
          error: 'Failed to generate TURN credentials.',
          upstreamStatus: cfResp.status,
        }),
      );
      return;
    }

    const iceServers = data?.iceServers;
    if (!Array.isArray(iceServers)) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ error: 'Upstream returned an unexpected payload.' }));
      return;
    }

    // Do not cache: credentials are user/session sensitive.
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ iceServers }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Unexpected server error.' }));
  }
}

