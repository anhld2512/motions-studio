// #region ALD 24/05/2026 - SSE stream cho fashion-motion job (thay polling 5s).
// Edge function /fashion-motion-jobs/:id/logs/stream emit events 'log' + 'status' +
// 'end'. FE subscribe qua fetch + ReadableStream (cần Authorization header → không
// dùng được EventSource native).
//
// Usage:
//   const stream = useFashionMotionStream()
//   stream.subscribe(jobId, { onStatus, onLog, onEnd })
//   // ... khi cần huỷ
//   stream.unsubscribe(jobId)
export function useFashionMotionStream() {
  const auth = useAuth()
  const config = useRuntimeConfig()
  const active = new Map()  // jobId → { abortCtrl, reconnectTimer }

  async function _connect(jobId, handlers) {
    const slot = active.get(jobId)
    if (!slot || slot._closed) return
    const ctrl = new AbortController()
    slot.abortCtrl = ctrl
    try {
      const token = auth.token.value || ''
      // ALD 25/05/2026 - Dispatch endpoint theo kind. fashion-motion → fashion-motion-jobs,
      // motion → motion-jobs. Cả 2 cùng SSE schema (status + log + end events).
      const kind = handlers.kind || 'fashion-motion'
      const endpoint = kind === 'motion' ? 'motion-jobs' : 'fashion-motion-jobs'
      const url = `${config.public.motionBackendUrl}/functions/v1/${endpoint}/${jobId}/logs/stream`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) throw new Error(`SSE HTTP ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buf = ''
      while (!slot._closed) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          let evName = 'message'
          const dataLines = []
          for (const line of chunk.split('\n')) {
            if (line.startsWith(':')) continue
            if (line.startsWith('event:')) evName = line.slice(6).trim()
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
          }
          if (!dataLines.length) continue
          let payload
          try { payload = JSON.parse(dataLines.join('\n')) } catch { continue }
          if (evName === 'log')   handlers.onLog?.(payload)
          else if (evName === 'status') handlers.onStatus?.(payload)
          else if (evName === 'end') {
            handlers.onEnd?.(payload)
            slot._closed = true
            return
          }
          else if (evName === 'warn') handlers.onWarn?.(payload)
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      console.warn('[fashion-motion-stream] disconnect:', err.message)
      // Tự reconnect sau 3s nếu chưa explicitly unsubscribe (Edge runtime có thể
      // close connection sau ~60s idle).
      if (!slot._closed) {
        slot.reconnectTimer = setTimeout(() => _connect(jobId, handlers), 3000)
      }
    }
  }

  function subscribe(jobId, handlers) {
    if (active.has(jobId)) return  // đã subscribe
    active.set(jobId, { _closed: false, abortCtrl: null, reconnectTimer: null })
    _connect(jobId, handlers)
  }

  function unsubscribe(jobId) {
    const slot = active.get(jobId)
    if (!slot) return
    slot._closed = true
    try { slot.abortCtrl?.abort() } catch { /* ignore */ }
    if (slot.reconnectTimer) clearTimeout(slot.reconnectTimer)
    active.delete(jobId)
  }

  function unsubscribeAll() {
    for (const id of [...active.keys()]) unsubscribe(id)
  }

  return { subscribe, unsubscribe, unsubscribeAll }
}
// #endregion
