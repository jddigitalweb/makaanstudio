const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

module.exports = async function handler(req, res) {
  const { code, error } = req.query

  if (error || !code) {
    return res.status(400).send(`Authorization failed: ${error || 'no code'}`)
  }

  try {
    // Step 1: Exchange code for short-lived token
    const form = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID,
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: `https://${req.headers.host}/api/auth-callback`,
      code,
    })

    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const shortData = await shortRes.json()

    if (!shortData.access_token) {
      return res.status(500).send(`Failed to get short-lived token: ${JSON.stringify(shortData)}`)
    }

    await redis.set('instagram_user_id', String(shortData.user_id))

    // Step 2: Try long-lived exchange and show full response
    const longUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortData.access_token}`
    const longRes = await fetch(longUrl)
    const longText = await longRes.text()

    // Show everything on screen for debugging
    return res.send(`
      <html><body style="font-family:monospace;padding:40px">
        <h3>Short-lived token received ✅</h3>
        <p>user_id: ${shortData.user_id}</p>
        <p>token prefix: ${shortData.access_token.substring(0, 20)}...</p>
        <hr/>
        <h3>Long-lived token exchange response:</h3>
        <pre>${longText}</pre>
      </body></html>
    `)
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`)
  }
}
