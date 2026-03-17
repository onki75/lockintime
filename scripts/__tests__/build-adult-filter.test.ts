import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { buildAdultFilterRules } from '../build-adult-filter'

type AdultFilterRule = {
  id: number
  priority: 1
  action: {
    type: 'redirect'
    redirect: {
      url: string
    }
  }
  condition: {
    urlFilter: string
    resourceTypes: ['main_frame']
  }
}

const SAMPLE_DOMAINS = [
  'example-adult-1.com',
  'example-adult-2.com',
  'example-adult-3.com',
  'example-adult-4.com',
  'example-adult-5.com',
  'example-adult-6.com',
  'example-adult-7.com',
  'example-adult-8.com',
  'example-adult-9.com',
  'example-adult-10.com',
]

const createdDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    createdDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

async function createTempPaths() {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'adult-filter-build-'))
  createdDirectories.push(tempDirectory)

  return {
    inputPath: join(tempDirectory, 'adult-domains.txt'),
    outputPath: join(tempDirectory, 'public', 'rules', 'adult-filter.json'),
  }
}

describe('buildAdultFilterRules', () => {
  it('converts a 10-domain list into declarativeNetRequest redirect rules', async () => {
    const { inputPath, outputPath } = await createTempPaths()
    await writeFile(inputPath, `${SAMPLE_DOMAINS.join('\n')}\n`)

    await buildAdultFilterRules({ inputPath, outputPath })

    const output = await readFile(outputPath, 'utf8')
    const rules = JSON.parse(output) as AdultFilterRule[]

    expect(rules).toHaveLength(10)
    expect(rules[0]).toEqual({
      id: 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: 'blocked.html?url=example-adult-1.com&filter=adult',
        },
      },
      condition: {
        urlFilter: '||example-adult-1.com',
        resourceTypes: ['main_frame'],
      },
    })
    expect(rules[9]).toEqual({
      id: 10,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: 'blocked.html?url=example-adult-10.com&filter=adult',
        },
      },
      condition: {
        urlFilter: '||example-adult-10.com',
        resourceTypes: ['main_frame'],
      },
    })
  })

  it('trims blank lines and caps the output at 300000 rules', async () => {
    const { inputPath, outputPath } = await createTempPaths()
    const domains = Array.from({ length: 300005 }, (_, index) => `adult-${index + 1}.example`)
    const content = [' ', '', ...domains, '', '   '].join('\n')
    await writeFile(inputPath, content)

    await buildAdultFilterRules({ inputPath, outputPath })

    const output = await readFile(outputPath, 'utf8')
    const rules = JSON.parse(output) as AdultFilterRule[]

    expect(rules).toHaveLength(300000)
    expect(rules[0].condition.urlFilter).toBe('||adult-1.example')
    expect(rules[299999].condition.urlFilter).toBe('||adult-300000.example')
  })
})
