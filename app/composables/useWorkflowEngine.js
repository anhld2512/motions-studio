// #region ALD 18/06/2026 - Engine chạy workflow NGAY TRONG BROWSER (FE-only).
// Duyệt graph theo thứ tự topo, mỗi node gọi provider của NHÓM năng lực nó thuộc về (qua [[useProviders]] +
// [[useProviderClient]]). Ghi tiến trình vào run record ([[useLocalDb]]) đúng format mà editor đang poll:
//   events: [{ node_id, level:'info'|'success'|'warn'|'error', msg, extra:{previewUrl,previewKind} }]
//   output.metadata: { text?, image?, images?, video? }   ← node Output đọc cái này
// Giai đoạn đầu: nhóm IMAGE (create-image/tryon/compose) + TEXT chạy thật; video/speech/transcription báo
// "chưa hỗ trợ" rồi cho qua để run vẫn hoàn tất. Tiện cho enduser: bấm Test là thấy node chạy + ra ảnh.

export function useWorkflowEngine() {
  const db = useLocalDb()
  const providers = useProviders()
  const client = useProviderClient()
  const fileStore = useFileStore()
  providers.load(); fileStore.load()

  const nodeType = (n) => n.type || n.data?.type
  const cfgOf = (n) => n.data?.config || {}

  // Topo sort (Kahn). Trả mảng node theo thứ tự phụ thuộc; vòng lặp → đẩy phần còn lại cuối.
  function _topo(nodes, edges) {
    const indeg = new Map(nodes.map((n) => [n.id, 0]))
    const adj = new Map(nodes.map((n) => [n.id, []]))
    for (const e of edges) {
      if (!indeg.has(e.source) || !indeg.has(e.target)) continue
      adj.get(e.source).push(e.target)
      indeg.set(e.target, indeg.get(e.target) + 1)
    }
    const q = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id)
    const order = []
    const byId = new Map(nodes.map((n) => [n.id, n]))
    while (q.length) {
      const id = q.shift()
      order.push(byId.get(id))
      for (const t of adj.get(id) || []) { indeg.set(t, indeg.get(t) - 1); if (indeg.get(t) === 0) q.push(t) }
    }
    for (const n of nodes) if (!order.includes(n)) order.push(n)   // node trong vòng lặp / rời rạc
    return order
  }

  // Chạy 1 run: nạp record, duyệt graph, cập nhật dần. Không throw ra ngoài (ghi status='error').
  async function run(runId) {
    const runRec = await db.get('workflow_runs', runId)
    if (!runRec) return
    const def = runRec.definition || { nodes: [], edges: [] }
    const nodes = def.nodes || []
    const edges = def.edges || []
    const input = runRec.input || {}

    const events = runRec.events ? [...runRec.events] : []
    const outputs = new Map()   // nodeId → { kind, text?, url?, images? }
    let outputMeta = {}

    const emit = async (node_id, level, msg, extra) => {
      events.push({ ts: new Date().toISOString(), node_id, level, msg, ...(extra ? { extra } : {}) })
      await _save('running')
    }
    const _save = async (status) => {
      await db.put('workflow_runs', { ...runRec, status, events, output: { ...(runRec.output || {}), metadata: outputMeta } })
    }

    // gom input upstream của 1 node → { byHandle: {handle: out}, list: [out...] }
    function gather(node) {
      const ins = edges.filter((e) => e.target === node.id)
      const byHandle = {}; const list = []
      for (const e of ins) {
        const out = outputs.get(e.source)
        if (!out) continue
        byHandle[e.targetHandle || 'in'] = out
        list.push(out)
      }
      return { byHandle, list }
    }
    const imageUrlsFrom = (g) => g.list.filter((o) => o.kind === 'image' && o.url).map((o) => o.url)
    const textFrom = (g) => g.list.filter((o) => o.kind === 'text').map((o) => o.text).join('\n').trim()

    try {
      await _save('running')
      for (const node of _topo(nodes, edges)) {
        const type = nodeType(node)
        const cap = providers.capabilityOf(type)
        const c = cfgOf(node)
        const g = gather(node)

        // ── IO + luồng ──
        if (type === 'input' || /^input/i.test(type || '')) {
          const ct = c.contentType || (type === 'input-image' ? 'image' : type === 'input-video' ? 'video' : type === 'input-audio' ? 'audio' : 'text')
          let out
          if (ct === 'text') out = { kind: 'text', text: c.staticText ?? input[c.field || 'text'] ?? '' }
          else { const url = c.staticUrl || c.staticData || c.url || input[c.field || ct] || ''; out = { kind: ct, url } }
          outputs.set(node.id, out)
          await emit(node.id, 'success', `Input ${ct}`)
          continue
        }
        if (type === 'output') {
          const vid = g.list.find((o) => o.kind === 'video' && o.url)
          const img = g.list.find((o) => o.kind === 'image' && o.url)
          const aud = g.list.find((o) => o.kind === 'audio' && o.url)
          const txt = textFrom(g)
          if (vid) outputMeta = { ...outputMeta, video: vid.url, videos: [{ url: vid.url }] }
          if (img) outputMeta = { ...outputMeta, image: img.url, images: [{ url: img.url }] }
          if (aud) outputMeta = { ...outputMeta, audio: aud.url }
          if (txt) { outputMeta = { ...outputMeta, text: txt }; runRec.output = { ...(runRec.output || {}), text: txt } }
          outputs.set(node.id, vid || img || aud || { kind: 'text', text: txt })
          await emit(node.id, 'success', 'Kết quả đã sẵn sàng')
          continue
        }
        if (type === 'debug' || type === 'validate' || type === 'gpu-warmup' || type === 'gpu-free' || type === 'concat') {
          outputs.set(node.id, g.list[0] || { kind: 'text', text: '' })
          await emit(node.id, 'success', 'Bỏ qua (node tiện ích)')
          continue
        }

        // ── TEXT ──
        if (cap === 'text') {
          await emit(node.id, 'info', 'Đang gọi LLM…')
          const rsv = await providers.resolve('text')
          const sys = c.systemPrompt || c.prompt || ''
          const userText = textFrom(g) || c.prompt || ''
          const { text } = await client.chat(rsv, [
            ...(sys ? [{ role: 'system', content: sys }] : []),
            { role: 'user', content: userText || 'Xin chào' }
          ], { temperature: c.temperature })
          outputs.set(node.id, { kind: 'text', text })
          await emit(node.id, 'success', text.slice(0, 80) || 'Xong')
          continue
        }

        // ── IMAGE (create-image / tryon / compose) ──
        if (cap === 'image') {
          await emit(node.id, 'info', 'Đang tạo ảnh…')
          const rsv = await providers.resolve('image')
          const refs = imageUrlsFrom(g)
          const prompt = _imagePrompt(type, c, textFrom(g))
          const { url } = await client.generateImage(rsv, prompt, { images: refs, size: c.size })
          const stored = await fileStore.putFile(url, { prefix: 'image', contentType: 'image/png' })
          outputs.set(node.id, { kind: 'image', url: stored })
          await emit(node.id, 'success', 'Đã tạo ảnh', { previewUrl: stored, previewKind: 'image' })
          continue
        }

        // ── VIDEO (motion / ss / wan-i2v / text-to-video / fashion-motion / teaser / bds) ──
        if (cap === 'video') {
          await emit(node.id, 'info', 'Đang tạo video… (có thể vài phút)')
          const rsv = await providers.resolve('video')
          const refs = imageUrlsFrom(g)
          const prompt = (c.prompt || c.script || textFrom(g) || 'A short cinematic clip').trim()
          const { url } = await client.generateVideo(rsv, prompt, { image: refs[0], aspectRatio: c.aspectRatio, onProgress: (m) => emit(node.id, 'info', m) })
          const stored = await fileStore.putFile(url, { prefix: 'video', contentType: 'video/mp4' })
          outputs.set(node.id, { kind: 'video', url: stored })
          await emit(node.id, 'success', 'Đã tạo video', { previewUrl: stored, previewKind: 'video' })
          continue
        }

        // ── SPEECH (talk / voiceover) — TTS ──
        if (cap === 'speech') {
          await emit(node.id, 'info', 'Đang tạo giọng nói…')
          const rsv = await providers.resolve('speech')
          const text = (c.line || c.script || c.text || textFrom(g) || '').trim()
          if (!text) { await emit(node.id, 'warn', 'Không có lời để đọc — bỏ qua.'); outputs.set(node.id, g.list[0] || { kind: 'text', text: '' }); continue }
          const { url } = await client.generateSpeech(rsv, text, { voice: c.voice })
          const stored = await fileStore.putFile(url, { prefix: 'audio', contentType: 'audio/mpeg' })
          outputs.set(node.id, { kind: 'audio', url: stored })
          await emit(node.id, 'success', 'Đã tạo giọng nói')
          continue
        }

        // ── TRANSCRIPTION (subtitle) — ASR (+ dịch tuỳ chọn qua nhóm text) ──
        if (cap === 'transcription') {
          await emit(node.id, 'info', 'Đang nhận dạng lời thoại…')
          const rsv = await providers.resolve('transcription')
          const media = g.list.find((o) => (o.kind === 'video' || o.kind === 'audio') && o.url)?.url
          if (!media) { await emit(node.id, 'warn', 'Không có audio/video đầu vào — bỏ qua.'); outputs.set(node.id, { kind: 'text', text: '' }); continue }
          let { text } = await client.transcribe(rsv, media)
          if (c.targetLang && c.mode !== 'subtitle-only') {
            try {
              const trsv = await providers.resolve('text')
              const r = await client.chat(trsv, [{ role: 'user', content: `Dịch sang ${c.targetLang}, chỉ trả bản dịch:\n\n${text}` }])
              text = r.text || text
            } catch (e) { await emit(node.id, 'warn', 'Bỏ qua dịch: ' + (e?.message || e)) }
          }
          outputs.set(node.id, { kind: 'text', text })
          await emit(node.id, 'success', (text || '').slice(0, 80) || 'Xong')
          continue
        }

        // ── Không có provider (node luồng lạ) → cho qua ──
        if (cap) {
          await emit(node.id, 'warn', `Nhóm "${cap}" chưa cấu hình provider. Bỏ qua node.`)
        } else {
          await emit(node.id, 'warn', `Node "${type}" không có provider — bỏ qua.`)
        }
        outputs.set(node.id, g.list[0] || { kind: 'text', text: '' })
      }
      // editor poll dừng khi status === 'success' (KHÔNG phải 'done').
      await _save('success')
    } catch (e) {
      events.push({ ts: new Date().toISOString(), level: 'error', msg: 'Lỗi: ' + (e?.message || e) })
      await db.put('workflow_runs', { ...runRec, status: 'error', events, output: { ...(runRec.output || {}), metadata: outputMeta } })
    }
  }

  function _imagePrompt(type, c, upstreamText) {
    const base = (c.prompt || '').trim()
    if (type === 'tryon') {
      const g = { upper: 'áo', lower: 'quần', dress: 'váy', set: 'bộ đồ', bikini: 'bikini', accessory: 'phụ kiện' }[c.garmentType] || 'sản phẩm'
      return base || `Cho người mẫu trong ảnh mặc ${g} từ ảnh sản phẩm, giữ nguyên khuôn mặt và dáng người, ánh sáng studio chân thực.`
    }
    if (type === 'compose') return base || 'Ghép người vào ảnh mẫu, giữ khuôn mặt và bối cảnh tự nhiên, ảnh chân thực.'
    return [base, upstreamText].filter(Boolean).join('\n').trim() || 'A clean, high-detail product image.'
  }

  return { run }
}
// #endregion
