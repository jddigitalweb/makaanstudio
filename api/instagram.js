const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const FIELDS = 'id,media_url,permalink,media_type,thumbnail_url,timestamp'
const LIMIT = 12
const CACHE_TTL = 3600

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, s-maxage=3600')

  try {
    const cached = await redis.get('instagram_posts')
    if (cached) {
      return res.json(cached)
    }

    const token = await redis.get('instagram_token')
    if (!token) {
      return res.status(503).json({ error: 'Instagram not connected yet' })
    }

    // Get user ID
    const userRes = await fetch(
      `https://graph.instagram.com/me?fields=id&access_token=${token}`
    )
    const userData = await userRes.json()

    if (userData.error) {
      return res.status(500).json({ error: userData.error.message, detail: userData.error })
    }

    const userId = userData.id

    // Fetch media using user ID
    const response = await fetch(
      `https://graph.instagram.com/${userId}/media?fields=${FIELDS}&limit=${LIMIT}&access_token=${token}`
    )
    const data = await response.json()

    if (data.error) {
      return res.status(500).json({ error: data.error.message, detail: data.error })
    }

    await redis.setex('instagram_posts', CACHE_TTL, data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
