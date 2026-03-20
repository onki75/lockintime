export function formatMinutes(minutes: number): string {
  if (minutes < 1) {
    return '0分'
  }

  if (minutes < 60) {
    return `${Math.floor(minutes)}分`
  }

  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)

  return `${h}時間${m > 0 ? `${m}分` : ''}`
}

export function formatChange(diff: number): { text: string; positive: boolean } {
  const abs = Math.abs(Math.floor(diff))

  if (diff < 0) {
    return { text: `昨日より${abs}分少ない`, positive: true }
  }

  if (diff > 0) {
    return { text: `昨日より${abs}分多い`, positive: false }
  }

  return { text: '昨日と同じ', positive: true }
}
