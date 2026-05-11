import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  buildAdultFilterRules,
  type AdultFilterRule,
} from '../build-adult-filter'

const SAMPLE_DOMAINS = [
  'example-adult-1.com',
  'example-adult-2.com',
  'example-adult-3.com',
  'example-adult-4.com',
  'example-adult-5.com',
]

const createdDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    createdDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

async function createTempOutputPath() {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'adult-filter-build-'))
  createdDirectories.push(tempDirectory)
  return join(tempDirectory, 'rules', 'adult-filter.json')
}

describe('buildAdultFilterRules', () => {
  it('creates a single requestDomains rule from a domain list', async () => {
    const outputPath = await createTempOutputPath()

    const rules = await buildAdultFilterRules({
      domainsInput: SAMPLE_DOMAINS.join('\n'),
      outputPath,
      skipDownload: true,
    })

    expect(rules).toHaveLength(1)
    expect(rules[0].id).toBe(1)
    expect(rules[0].action.type).toBe('redirect')
    expect(rules[0].action.redirect.extensionPath).toBe('/blocked.html?filter=adult')
    expect(rules[0].condition.resourceTypes).toEqual(['main_frame'])
    expect(rules[0].condition.requestDomains).toHaveLength(5)
    expect(rules[0].condition.requestDomains).toContain('example-adult-1.com')
    expect(rules[0].condition.requestDomains).toContain('example-adult-5.com')

    const output = await readFile(outputPath, 'utf8')
    const parsed = JSON.parse(output) as AdultFilterRule[]
    expect(parsed).toHaveLength(1)
    expect(parsed[0].condition.requestDomains).toHaveLength(5)
  })

  it('deduplicates domains and sorts alphabetically', async () => {
    const outputPath = await createTempOutputPath()
    const input = 'z-site.com\na-site.com\nz-site.com\nm-site.com\na-site.com'

    const rules = await buildAdultFilterRules({
      domainsInput: input,
      outputPath,
      skipDownload: true,
    })

    expect(rules[0].condition.requestDomains).toEqual([
      'a-site.com',
      'm-site.com',
      'z-site.com',
    ])
  })

  it('filters out whitelisted domains', async () => {
    const outputPath = await createTempOutputPath()
    const input = [
      'bad-site.com',
      'harvard.edu',
      'university.ac.jp',
      'ministry.go.jp',
      'another-bad.com',
      'who.int',
      'glaad.org',
    ].join('\n')

    const rules = await buildAdultFilterRules({
      domainsInput: input,
      outputPath,
      skipDownload: true,
    })

    const domains = rules[0].condition.requestDomains
    expect(domains).toContain('bad-site.com')
    expect(domains).toContain('another-bad.com')
    expect(domains).not.toContain('harvard.edu')
    expect(domains).not.toContain('university.ac.jp')
    expect(domains).not.toContain('ministry.go.jp')
    expect(domains).not.toContain('who.int')
    expect(domains).not.toContain('glaad.org')
  })

  it('skips comments and blank lines', async () => {
    const outputPath = await createTempOutputPath()
    const input = '# This is a comment\n\nbad-site.com\n  \n# Another comment\ngood-bad.com\n'

    const rules = await buildAdultFilterRules({
      domainsInput: input,
      outputPath,
      skipDownload: true,
    })

    expect(rules[0].condition.requestDomains).toEqual([
      'bad-site.com',
      'good-bad.com',
    ])
  })

  it('lowercases all domains', async () => {
    const outputPath = await createTempOutputPath()
    const input = 'BAD-SITE.COM\nAnother-Site.Com'

    const rules = await buildAdultFilterRules({
      domainsInput: input,
      outputPath,
      skipDownload: true,
    })

    expect(rules[0].condition.requestDomains).toEqual([
      'another-site.com',
      'bad-site.com',
    ])
  })

  it('skips invalid requestDomains entries', async () => {
    const outputPath = await createTempOutputPath()
    const input = [
      'valid-site.com',
      'www.phica.eu/forums/',
      'http://bad-site.com',
      'singlelabel',
      '*.wildcard.com',
      'two words.com',
      '||adblock-style.com^',
    ].join('\n')

    const rules = await buildAdultFilterRules({
      domainsInput: input,
      outputPath,
      skipDownload: true,
    })

    expect(rules[0].condition.requestDomains).toEqual([
      'adblock-style.com',
      'valid-site.com',
    ])
  })

  it('returns empty array for empty input', async () => {
    const outputPath = await createTempOutputPath()

    const rules = await buildAdultFilterRules({
      domainsInput: '',
      outputPath,
      skipDownload: true,
    })

    expect(rules).toEqual([])
  })
})
