import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const MAX_ADULT_FILTER_RULES = 300000
export const DEFAULT_INPUT_PATH = 'public/rules/adult-domains.txt'
export const DEFAULT_OUTPUT_PATH = 'public/rules/adult-filter.json'

export type AdultFilterRule = {
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

type BuildAdultFilterRulesOptions = {
  inputPath?: string
  outputPath?: string
  maxRules?: number
}

export async function buildAdultFilterRules(
  options: BuildAdultFilterRulesOptions = {},
): Promise<AdultFilterRule[]> {
  const inputPath = options.inputPath ?? DEFAULT_INPUT_PATH
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH
  const maxRules = options.maxRules ?? MAX_ADULT_FILTER_RULES

  const domains = await readDomains(inputPath, maxRules)
  const rules = domains.map(createAdultFilterRule)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(rules, null, 2)}\n`, 'utf8')

  return rules
}

async function readDomains(inputPath: string, maxRules: number): Promise<string[]> {
  const content = await readFile(inputPath, 'utf8')

  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, maxRules)
}

function createAdultFilterRule(domain: string, index: number): AdultFilterRule {
  return {
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: `blocked.html?url=${domain}&filter=adult`,
      },
    },
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: ['main_frame'],
    },
  }
}

async function main(): Promise<void> {
  await buildAdultFilterRules({
    inputPath: resolve(process.cwd(), DEFAULT_INPUT_PATH),
    outputPath: resolve(process.cwd(), DEFAULT_OUTPUT_PATH),
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
