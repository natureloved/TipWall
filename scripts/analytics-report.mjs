// Read-only ecosystem analytics for TipWall. Scans every wall in KV and rolls
// up site-wide totals — views, tips, walls, and how many creators have vs.
// haven't been tipped. Purely reads (keys/get/mget/scard); never writes.
//
// Usage:
//   node scripts/analytics-report.mjs
// Reads KV_REST_API_URL / KV_REST_API_TOKEN from the environment. Load your
// local values first, e.g. with:  node -r dotenv/config scripts/analytics-report.mjs dotenv_config_path=.env.local
// or export them in your shell.

import https from 'node:https'

const KV_URL = process.env.KV_REST_API_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN

if (!KV_URL || !KV_TOKEN) {
  console.error('Missing KV_REST_API_URL or KV_REST_API_TOKEN environment variables')
  process.exit(1)
}

const PREFIX = 'tipwall:'
const LUNA_PER_NIM = 100000

// Mirror of FUNNEL_EVENTS in src/lib/events.ts
const FUNNEL_EVENTS = [
  'TIP_WALL_VIEWED',
  'TIP_BUTTON_CLICKED',
  'INSTALL_PROMPT_SHOWN',
  'CLAIM_LINK_CREATED',
  'RETURNED_AFTER_INSTALL',
  'TIP_COMPLETED',
  'WALL_SHARED',
]

function kvRequest(command, args = []) {
  return new Promise((resolve, reject) => {
    const url = new URL(KV_URL)
    const path = `/${command}/${args.map(a => encodeURIComponent(a)).join('/')}`
    const options = {
      hostname: url.hostname,
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      timeout: 10000,
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
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    req.end()
  })
}

async function kvRequestRetry(command, args, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await kvRequest(command, args)
    } catch (err) {
      if (i === retries) throw err
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

const num = (v) => Number(v ?? 0) || 0

async function main() {
  console.log('Scanning walls…\n')

  const keysRes = await kvRequestRetry('keys', [`${PREFIX}profile:*`])
  const profileKeys = keysRes.result || []
  const handles = profileKeys.map(k => k.slice(`${PREFIX}profile:`.length)).filter(Boolean)

  const totals = {}
  for (const e of FUNNEL_EVENTS) totals[e] = 0

  let tippedCreators = 0
  let untippedCreators = 0
  let totalNIM = 0
  let totalVerifiedTips = 0 // distinct on-chain tx hashes across all walls

  for (const handle of handles) {
    // Funnel counters for this wall.
    const statKeys = FUNNEL_EVENTS.map(e => `${PREFIX}stats:${handle}:${e}:total`)
    const statRes = await kvRequestRetry('mget', statKeys)
    const statVals = statRes.result || []
    FUNNEL_EVENTS.forEach((e, i) => { totals[e] += num(statVals[i]) })

    // Lifetime verified NIM for this wall.
    const vtotalRes = await kvRequestRetry('get', [`${PREFIX}vtotal:${handle}`])
    const luna = num(vtotalRes.result)
    const nim = luna / LUNA_PER_NIM
    totalNIM += nim

    // Distinct verified tx hashes ever seen (lifetime, survives the 200 trim).
    const scardRes = await kvRequestRetry('scard', [`${PREFIX}txseen:${handle}`])
    const txCount = num(scardRes.result)
    totalVerifiedTips += txCount

    // A creator counts as "tipped" if any real NIM landed on their wall.
    if (nim > 0 || txCount > 0) tippedCreators++
    else untippedCreators++
  }

  const wallsCreated = handles.length
  const views = totals.TIP_WALL_VIEWED
  const tipClicks = totals.TIP_BUTTON_CLICKED
  const tipsCompleted = totals.TIP_COMPLETED
  const wallsShared = totals.WALL_SHARED
  const claimLinks = totals.CLAIM_LINK_CREATED

  const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—')

  console.log('════════════════════════════════════════')
  console.log('  TipWall — ecosystem analytics')
  console.log('════════════════════════════════════════\n')
  console.log(`Walls created ...................... ${wallsCreated}`)
  console.log(`Creators tipped .................... ${tippedCreators}`)
  console.log(`Creators not yet tipped ........... ${untippedCreators}`)
  console.log('')
  console.log(`Wall views (deduped) .............. ${views}`)
  console.log(`Tip button clicks ................. ${tipClicks}`)
  console.log(`Tips completed (funnel) ........... ${tipsCompleted}`)
  console.log(`Verified on-chain tips ............ ${totalVerifiedTips}`)
  console.log(`Total NIM tipped (lifetime) ....... ${Math.round(totalNIM).toLocaleString()} NIM`)
  console.log('')
  console.log(`Walls shared ...................... ${wallsShared}`)
  console.log(`Claim links created ............... ${claimLinks}`)
  console.log('')
  console.log('— Funnel conversion —')
  console.log(`View → tip click .................. ${pct(tipClicks, views)}`)
  console.log(`Tip click → completed ............. ${pct(tipsCompleted, tipClicks)}`)
  console.log(`View → completed .................. ${pct(tipsCompleted, views)}`)
  console.log('')

  // Ready-to-post draft. Uses the on-chain verified figures (most defensible).
  console.log('════════════════════════════════════════')
  console.log('  Draft X post')
  console.log('════════════════════════════════════════\n')
  console.log(
`TipWall by the numbers 📊

🧱 ${wallsCreated} creator walls
👀 ${views.toLocaleString()} wall views
💸 ${totalVerifiedTips.toLocaleString()} tips sent on-chain
🪙 ${Math.round(totalNIM).toLocaleString()} NIM to creators
🎉 ${tippedCreators} creators tipped

Tip the creator. Not the platform.
Built on @nimiq — zero fees.`
  )
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
