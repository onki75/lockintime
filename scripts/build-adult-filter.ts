import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const BLOCKLIST_URL =
  'https://blocklistproject.github.io/Lists/alt-version/porn-nl.txt'

export const DEFAULT_CACHE_PATH = 'scripts/.cache/adult-domains.txt'
export const DEFAULT_OUTPUT_PATH = 'public/rules/adult-filter.json'

export const WHITELIST_PATTERNS = [
  /\.edu$/,
  /\.ac\.jp$/,
  /\.go\.jp$/,
  /\.gov$/,
  /\.org$/,
  /^who\.int$/,
  /^planned(?:parenthood|\.org)/,
  /^glaad\.org$/,
  /^thetrevorproject\.org$/,
  /^itgetsbetter\.org$/,
]

export type AdultFilterRule = {
  id: number
  priority: number
  action: {
    type: 'redirect'
    redirect: {
      extensionPath: string
    }
  }
  condition: {
    requestDomains: string[]
    resourceTypes: ['main_frame']
  }
}

type BuildOptions = {
  cachePath?: string
  outputPath?: string
  skipDownload?: boolean
  domainsInput?: string
}

function isWhitelisted(domain: string): boolean {
  return WHITELIST_PATTERNS.some((pattern) => pattern.test(domain))
}

function parseDomainList(content: string): string[] {
  const seen = new Set<string>()
  const domains: string[] = []

  for (const raw of content.split(/\r?\n/u)) {
    const line = raw.trim()
    if (line.length === 0 || line.startsWith('#')) {
      continue
    }

    const domain = line.toLowerCase()
    if (seen.has(domain) || isWhitelisted(domain)) {
      continue
    }

    seen.add(domain)
    domains.push(domain)
  }

  return domains.sort()
}

async function downloadBlocklist(cachePath: string): Promise<string> {
  await mkdir(dirname(cachePath), { recursive: true })

  console.log(`Downloading blocklist from ${BLOCKLIST_URL} ...`)
  const response = await fetch(BLOCKLIST_URL)
  if (!response.ok) {
    throw new Error(`Failed to download blocklist: ${response.status} ${response.statusText}`)
  }

  const content = await response.text()
  await writeFile(cachePath, content, 'utf8')
  console.log(`Cached blocklist to ${cachePath} (${content.length} bytes)`)
  return content
}

export async function buildAdultFilterRules(
  options: BuildOptions = {},
): Promise<AdultFilterRule[]> {
  const cachePath = options.cachePath ?? DEFAULT_CACHE_PATH
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH

  let content: string
  if (options.domainsInput !== undefined) {
    content = options.domainsInput
  } else if (options.skipDownload) {
    content = await readFile(cachePath, 'utf8')
  } else {
    content = await downloadBlocklist(cachePath)
  }

  const domains = parseDomainList(content)
  console.log(`Parsed ${domains.length} unique domains (after whitelist filtering)`)

  const rules: AdultFilterRule[] = domains.length > 0
    ? [{
        id: 1,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            extensionPath: '/blocked.html?filter=adult',
          },
        },
        condition: {
          requestDomains: domains,
          resourceTypes: ['main_frame'],
        },
      }]
    : []

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(rules)}\n`, 'utf8')
  console.log(`Wrote ${outputPath} (${rules.length} rule, ${domains.length} domains)`)

  return rules
}

async function main(): Promise<void> {
  await buildAdultFilterRules({
    cachePath: resolve(process.cwd(), DEFAULT_CACHE_PATH),
    outputPath: resolve(process.cwd(), DEFAULT_OUTPUT_PATH),
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
