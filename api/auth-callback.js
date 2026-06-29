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
      return res.status(500).send(`Failed to get token: ${JSON.stringify(shortData)}`)
    }

    // Step 2: Exchange for long-lived token using GET
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortData.access_token}`,
      { method: 'GET' }
    )
    const longText = await longRes.text()
    console.log('Long-lived token response:', longText)
    const longData = JSON.parse(longText)

    if (!longData.access_token) {
      // Fall back to storing short-lived token if exchange fails
      await redis.set('instagram_token', shortData.access_token)
      console.log('Stored short-lived token as fallback')
    } else {
      await redis.set('instagram_token', longData.access_token)
      console.log('Stored long-lived token')
    }

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>✅ Instagram connected successfully!</h2>
        <p>You can close this tab. The feed will appear on the site shortly.</p>
      </body></html>
    `)
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`)
  }
}
