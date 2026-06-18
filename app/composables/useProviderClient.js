// #region ALD 18/06/2026 - Gọi provider AI THẲNG TỪ BROWSER (FE-only). Nhận object resolve từ
// [[useProviders]] (.resolve(capability) → { baseUrl, apiKey, model, headers, provider.kind }).
// Hỗ trợ 3 kind: openai (OpenAI-compatible — mặc định/custom base URL), anthropic, gemini.
// Trả về dạng thống nhất để [[useWorkflowEngine]] dùng. Ảnh trả base64 → data: URL (không cần storage).

function _bearer(apiKey) { return apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }

async function _postJson(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : {} } catch { data = { _raw: text } }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || data?._raw || `HTTP ${res.status}`
    throw new Error(`${res.status}: ${String(msg).slice(0, 300)}`)
  }
  return data
}

export function useProviderClient() {
  // ── CHAT / TEXT ──
  // messages: [{ role:'system'|'user'|'assistant', content }]. Trả { text }.
  async function chat(rsv, messages, opts = {}) {
    if (!rsv) throw new Error('Chưa gắn provider cho nhóm "Văn bản". Vào Cài đặt → Provider.')
    const { baseUrl, apiKey, model, headers, provider } = rsv
    const kind = provider?.kind || 'openai'
    const temperature = opts.temperature ?? 0.4

    if (kind === 'anthropic') {
      // Anthropic Messages API. System tách riêng. browserHeader (anthropic-dangerous-direct-browser-access) đã có trong headers.
      const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
      const msgs = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: String(m.content) }))
      const data = await _postJson(`${baseUrl}/messages`, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', ...headers },
        { model: model || 'claude-sonnet-4-6', max_tokens: opts.maxTokens || 4096, temperature, system: sys || undefined, messages: msgs })
      return { text: (data.content || []).map((c) => c.text || '').join('') }
    }

    if (kind === 'gemini') {
      // Gemini generateContent. Key qua query ?key=.
      const contents = messages.filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] }))
      const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
      const url = `${baseUrl}/models/${model || 'gemini-2.0-flash'}:generateContent?key=${encodeURIComponent(apiKey)}`
      const data = await _postJson(url, headers, { contents, systemInstruction: sys ? { parts: [{ text: sys }] } : undefined, generationConfig: { temperature } })
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
      return { text }
    }

    // openai-compatible (mặc định / custom)
    const data = await _postJson(`${baseUrl}/chat/completions`, { ..._bearer(apiKey), ...headers },
      { model: model || 'gpt-4o-mini', messages, temperature })
    return { text: data.choices?.[0]?.message?.content ?? '' }
  }

  // ── IMAGE ──
  // prompt + ảnh tham chiếu (data URL / URL) tuỳ chọn. Trả { url } (data: URL nếu b64).
  async function generateImage(rsv, prompt, opts = {}) {
    if (!rsv) throw new Error('Chưa gắn provider cho nhóm "Tạo / sửa ảnh". Vào Cài đặt → Provider.')
    const { baseUrl, apiKey, model, headers, provider } = rsv
    const kind = provider?.kind || 'openai'
    const refs = (opts.images || []).filter(Boolean)

    // fal.ai (Kling/Runway/Luma/Flux/Nano-Banana…) — POST {baseUrl}/{model}, auth "Key <key>".
    if (kind === 'fal' || /fal\.run/.test(baseUrl)) {
      const body = { prompt }
      if (refs[0]) body.image_url = refs[0]
      const data = await _postJson(`${baseUrl}/${model || 'fal-ai/flux/dev'}`, { Authorization: `Key ${apiKey}`, ...headers }, body)
      const url = data?.images?.[0]?.url || data?.image?.url
      if (!url) throw new Error('fal không trả ảnh')
      return { url }
    }

    if (kind === 'gemini') {
      // Gemini image (Imagen / 2.5-flash-image). Trả inlineData base64.
      const parts = [{ text: prompt }, ...refs.map((u) => _geminiInline(u)).filter(Boolean)]
      const url = `${baseUrl}/models/${model || 'gemini-2.5-flash-image'}:generateContent?key=${encodeURIComponent(apiKey)}`
      const data = await _postJson(url, headers, { contents: [{ role: 'user', parts }] })
      const img = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)
      if (!img) throw new Error('Provider không trả ảnh')
      return { url: `data:${img.inlineData.mimeType || 'image/png'};base64,${img.inlineData.data}` }
    }

    // openai-compatible: /images/generations (text→image) hoặc /images/edits (có ảnh ref).
    if (refs.length) {
      // edits cần multipart — nhiều provider OpenAI-compatible hỗ trợ. Gửi ảnh đầu làm base.
      const form = new FormData()
      form.append('model', model || 'gpt-image-1')
      form.append('prompt', prompt)
      form.append('image[]', await _toBlob(refs[0]))
      const res = await fetch(`${baseUrl}/images/edits`, { method: 'POST', headers: { ..._bearer(apiKey), ...headers }, body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`${res.status}: ${data?.error?.message || 'images/edits lỗi'}`)
      return { url: _imgFromOpenAI(data) }
    }
    const data = await _postJson(`${baseUrl}/images/generations`, { ..._bearer(apiKey), ...headers },
      { model: model || 'gpt-image-1', prompt, size: opts.size || '1024x1024', n: 1 })
    return { url: _imgFromOpenAI(data) }
  }

  function _imgFromOpenAI(data) {
    const d = data?.data?.[0]
    if (!d) throw new Error('Provider không trả ảnh')
    if (d.b64_json) return `data:image/png;base64,${d.b64_json}`
    if (d.url) return d.url
    throw new Error('Ảnh không hợp lệ')
  }
  function _geminiInline(u) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(u || '')
    return m ? { inlineData: { mimeType: m[1], data: m[2] } } : null
  }
  async function _toBlob(u) {
    if (/^data:/.test(u)) { const r = await fetch(u); return await r.blob() }
    const r = await fetch(u); return await r.blob()
  }

  // ── VIDEO ── (Gemini Veo: text/ảnh → video, long-running → poll). openai-compatible: best-effort /videos.
  async function generateVideo(rsv, prompt, opts = {}) {
    if (!rsv) throw new Error('Chưa gắn provider cho nhóm "Video". Vào Cài đặt → Provider.')
    const { baseUrl, apiKey, model, headers, provider } = rsv
    const kind = provider?.kind || 'openai'
    const onProgress = opts.onProgress || (() => {})

    // fal.ai — Kling / Runway / Luma / Minimax / Veo qua 1 API. POST {baseUrl}/{model}, auth "Key <key>".
    if (kind === 'fal' || /fal\.run/.test(baseUrl)) {
      onProgress('Đang tạo video qua fal.ai… (có thể vài phút)')
      const body = { prompt }
      if (opts.image) body.image_url = opts.image
      const data = await _postJson(`${baseUrl}/${model || 'fal-ai/kling-video/v2/master/image-to-video'}`, { Authorization: `Key ${apiKey}`, ...headers }, body)
      const url = data?.video?.url || data?.videos?.[0]?.url
      if (!url) throw new Error('fal không trả video')
      return { url }
    }

    if (kind === 'gemini') {
      const veo = model || 'veo-3.0-generate-001'
      const instance = { prompt }
      if (opts.image) { const m = /^data:([^;]+);base64,(.+)$/.exec(opts.image); if (m) instance.image = { bytesBase64Encoded: m[2], mimeType: m[1] } }
      const start = await _postJson(`${baseUrl}/models/${veo}:predictLongRunning?key=${encodeURIComponent(apiKey)}`, headers,
        { instances: [instance], parameters: { aspectRatio: opts.aspectRatio || '16:9' } })
      let op = start.name
      if (!op) throw new Error('Veo không trả operation')
      // poll tối đa ~4 phút
      for (let i = 0; i < 80; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const st = await _getJson(`${baseUrl}/${op}?key=${encodeURIComponent(apiKey)}`, headers)
        onProgress(`Đang tạo video… (${i * 3}s)`)
        if (st.done) {
          const v = st.response?.generateVideoResponse?.generatedSamples?.[0]?.video
            || st.response?.videos?.[0] || st.response?.predictions?.[0]
          const uri = v?.uri || v?.video?.uri
          if (!uri) throw new Error('Veo xong nhưng không có video URI')
          // URI Veo cần key để tải → trả kèm key (FE-only).
          return { url: uri.includes('key=') ? uri : `${uri}${uri.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}` }
        }
        if (st.error) throw new Error(st.error.message || 'Veo lỗi')
      }
      throw new Error('Veo quá thời gian chờ')
    }

    // openai-compatible best-effort (vd nhà cung cấp clone Sora/Runway theo chuẩn /videos)
    try {
      const data = await _postJson(`${baseUrl}/videos/generations`, { ..._bearer(apiKey), ...headers },
        { model: model || 'sora', prompt })
      const url = data?.data?.[0]?.url || data?.url
      if (url) return { url }
    } catch (e) { /* fallthrough */ }
    throw new Error('Provider không hỗ trợ tạo video. Dùng Gemini (Veo) cho nhóm Video.')
  }

  // ── SPEECH (TTS) ── text → audio (data: URL). voice = id giọng của provider (đã bỏ tiền tố provider:).
  async function generateSpeech(rsv, text, opts = {}) {
    if (!rsv) throw new Error('Chưa gắn provider cho nhóm "Giọng nói". Vào Cài đặt → Provider.')
    const { baseUrl, apiKey, model, headers, provider } = rsv
    const kind = provider?.kind || 'openai'
    const voice = String(opts.voice || '').replace(/^[a-z]+:/i, '').trim()   // bỏ 'gemini:'/'openai:'... còn id thuần

    // ElevenLabs — hỗ trợ CLONE giọng (clone bên ElevenLabs ra voice_id rồi dán vào node).
    if (kind === 'elevenlabs' || /elevenlabs/i.test(baseUrl)) {
      const voiceId = voice || '21m00Tcm4TlvDq8ikWAM'   // Rachel (mặc định)
      const res = await fetch(`${baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey, ...headers },
        body: JSON.stringify({ text, model_id: model || 'eleven_multilingual_v2' })
      })
      if (!res.ok) throw new Error(`${res.status}: ElevenLabs TTS lỗi`)
      return { url: await _blobToDataUrl(await res.blob()) }
    }

    if (kind === 'gemini') {
      const speechConfig = voice ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } : undefined
      const data = await _postJson(`${baseUrl}/models/${model || 'gemini-2.5-flash-preview-tts'}:generateContent?key=${encodeURIComponent(apiKey)}`, headers,
        { contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig } })
      const a = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)
      if (!a) throw new Error('TTS không trả audio')
      return { url: `data:${a.inlineData.mimeType || 'audio/wav'};base64,${a.inlineData.data}` }
    }
    // openai /audio/speech → binary
    const res = await fetch(`${baseUrl}/audio/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json', ..._bearer(apiKey), ...headers },
      body: JSON.stringify({ model: model || 'gpt-4o-mini-tts', voice: voice || 'alloy', input: text }) })
    if (!res.ok) throw new Error(`${res.status}: TTS lỗi`)
    const blob = await res.blob()
    return { url: await _blobToDataUrl(blob) }
  }

  // ── TRANSCRIPTION (ASR) ── audio/video URL → text.
  async function transcribe(rsv, mediaUrl, opts = {}) {
    if (!rsv) throw new Error('Chưa gắn provider cho nhóm "Nhận dạng / phụ đề". Vào Cài đặt → Provider.')
    const { baseUrl, apiKey, model, headers } = rsv
    const blob = await _toBlob(mediaUrl)
    const form = new FormData()
    form.append('model', model || 'whisper-1')
    form.append('file', blob, 'audio')
    if (opts.translate) form.append('response_format', 'json')
    const res = await fetch(`${baseUrl}/audio/transcriptions`, { method: 'POST', headers: { ..._bearer(apiKey), ...headers }, body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${res.status}: ${data?.error?.message || 'ASR lỗi'}`)
    return { text: data.text || '' }
  }

  async function _getJson(url, headers) {
    const res = await fetch(url, { headers })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${res.status}: ${data?.error?.message || 'GET lỗi'}`)
    return data
  }
  function _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
  }

  return { chat, generateImage, generateVideo, generateSpeech, transcribe }
}
// #endregion
