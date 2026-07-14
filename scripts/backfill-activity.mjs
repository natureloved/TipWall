import https from 'node:https'

const KV_URL = process.env.KV_REST_API_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN

if (!KV_URL || !KV_TOKEN) {
  console.error('Missing KV_REST_API_URL or KV_REST_API_TOKEN environment variables')
  process.exit(1)
}

const PREFIX = 'tipwall:'
const ACTIVITY_KEY = `${PREFIX}active`

function kvRequest(command, args = []) {
  return new Promise((resolve, reject) => {
    const url = new URL(KV_URL)
    const path = `/${command}/${args.map(a => encodeURIComponent(a)).join('/')}`
    const options = {
      hostname: url.hostname,
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error('Invalid JSON: ' + data))
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function backfill() {
  console.log('Fetching all profile keys...')
  const keysRes = await kvRequest('keys', [`${PREFIX}profile:*`])
  const keys = keysRes.result || []
  const handles = keys.map(k => k.slice(PREFIX.length)).filter(Boolean)
  console.log(`Found ${handles.length} profiles`)

  if (!handles.length) {
    console.log('Nothing to backfill.')
    return
  }

  let count = 0
  for (const handle of handles) {
    await kvRequest('zadd', [ACTIVITY_KEY, String(Date.now()), handle])
    count++
  }
  console.log(`Backfilled ${count} walls into activity index`)
}

backfill().catch((e) => {
  console.error(e)
  process.exit(1)
})
