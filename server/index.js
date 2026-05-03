// Express server — leaderboard API
// TODO: POST /api/scores, GET /api/leaderboard, persist to scores.json or SQLite
const express = require('express')
const app = express()
const PORT = 4000

app.use(express.json())

// GET /api/leaderboard
app.get('/api/leaderboard', (req, res) => {
  res.json([]) // placeholder
})

// POST /api/scores
app.post('/api/scores', (req, res) => {
  res.json({ ok: true }) // placeholder
})

app.listen(PORT, () => console.log(`Void Rush API running on :${PORT}`))
