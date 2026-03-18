type RuntimeResponse<T> =
  | ({ ok: true } & T)
  | { ok: false; error?: string; status?: string }

function sendRuntimeMessage<T>(message: unknown): Promise<RuntimeResponse<T>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError?.message
      if (error) {
        reject(new Error(error))
        return
      }

      resolve((response ?? { ok: false, error: 'No response' }) as RuntimeResponse<T>)
    })
  })
}

export async function startTemporaryBypass(
  ruleId: string,
  durationMinutes: number,
): Promise<{ ruleId: string; expiresAt: number; createdAt: number }> {
  const response = await sendRuntimeMessage<{
    entry: { ruleId: string; expiresAt: number; createdAt: number }
  }>({
    type: 'bypass:start',
    ruleId,
    durationMinutes,
  })

  if (!response.ok) {
    throw new Error(response.error ?? response.status ?? 'Failed to start bypass')
  }

  return response.entry
}
