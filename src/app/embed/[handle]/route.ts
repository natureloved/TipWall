import { getProfile } from '@/lib/kv'

export const dynamic = 'force-dynamic'

/**
 * One-line embed for creators' own sites:
 *   <script src="https://<host>/embed/<handle>" defer></script>
 * Injects a paper-styled floating button that opens the wall in a popup
 * (with ?ref=embed so the funnel can attribute it). No framework required.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await params
  const handle = raw.replace(/\.js$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
  const profile = await getProfile(handle)
  if (!profile) return new Response('// wall not found', { status: 404, headers: { 'Content-Type': 'application/javascript' } })

  const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(_request.url).origin).replace(/\/+$/, '')

  const js = `(function () {
  var handle = ${JSON.stringify(handle)};
  var origin = ${JSON.stringify(origin)};
  if (document.getElementById('tipwall-fab')) return;
  function mount() {
    if (document.getElementById('tipwall-fab') || !document.body) return;
    var btn = document.createElement('button');
    btn.id = 'tipwall-fab';
    btn.type = 'button';
    btn.textContent = '\\u{1F4B8} Tip @' + handle;
    btn.setAttribute('style', [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483000',
      'background:#f05a3c', 'color:#171614', 'border:2px solid #171614',
      'border-radius:999px', 'padding:10px 18px', 'font:700 14px system-ui,sans-serif',
      'cursor:pointer', 'box-shadow:3px 3px 0 #171614', 'margin:0'
    ].join(';'));
    btn.addEventListener('click', function () {
      var url = origin + '/' + handle + '?ref=embed';
      var w = window.open(url, 'tipwall-tip', 'width=480,height=800,noopener');
      if (!w) { var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click(); }
    });
    document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
`

  return new Response(js, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  })
}
