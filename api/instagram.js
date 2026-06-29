const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const token = await redis.get('instagram_token')

    if (!token) {
      return res.status(503).json({ error: 'No token found' })
    }

    const response = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${token}`
    )
    const data = await response.json()

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
