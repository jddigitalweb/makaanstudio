const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

module.exports = async function handler(req, res) {
  // Vercel automatically sends Authorization: Bearer {CRON_SECRET} for cron jobs
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const token = await redis.get('instagram_token')
    if (!token) {
      return res.status(404).json({ error: 'No token stored — run auth first' })
    }

    const response = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`
    )
    const data = await response.json()

    if (!data.access_token) {
      return res.status(500).json({ error: 'Refresh failed', detail: data })
    }

    await redis.set('instagram_token', data.access_token)
    await redis.del('instagram_posts') // bust cache so next request fetches fresh posts

    res.json({ success: true, expires_in: data.expires_in })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
