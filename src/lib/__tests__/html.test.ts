import { describe, expect, it } from 'vitest'
import { escapeHtml } from '../html'

describe('escapeHtml', () => {
  it('escapes text and attribute metacharacters', () => {
    expect(escapeHtml(`<a href="x">O'Reilly & friends</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;O&#39;Reilly &amp; friends&lt;/a&gt;',
    )
  })
})
