// #region ALD 18/06/2026 - Provider store (motions-studio): gắn AI provider THEO NHÓM NĂNG LỰC, không
// phải gắn từng provider cho từng node. Ý tưởng giống "pull models theo origin/group":
//   • providers[]      : các kết nối provider (base URL kiểu OpenAI-compatible + API key ĐÃ MÃ HOÁ).
//   • bindings{cap}    : mỗi NHÓM NĂNG LỰC (text/image/video/speech/transcription) trỏ tới 1 provider + model.
// Node chỉ khai báo nó thuộc capability nào → tự lấy provider theo binding. Khỏi cấu hình lặp từng node.
// Thay cho tab "Models AI" cũ. API key mã hoá qua [[useSecureVault]] trước khi ghi localStorage/DB.

const LS_PROVIDERS = 'ms.providers.v1'
const LS_BINDINGS = 'ms.provider.bindings.v1'

// Các nhóm năng lực — map từ node type sang đây (xem capabilityOf()).
export const CAPABILITIES = [
  { id: 'text',          label: 'Văn bản / LLM',     icon: 'bi-chat-square-text', hint: 'Đạo diễn cảnh, viết lời, dịch phụ đề, suy luận.' },
  { id: 'image',         label: 'Tạo / sửa ảnh',     icon: 'bi-images',           hint: 'create-image, try-on, ghép mẫu, ảnh từng shot.' },
  { id: 'video',         label: 'Tạo video',         icon: 'bi-camera-reels',     hint: 'ảnh→video, text→video, motion, teaser, time-lapse.' },
  { id: 'speech',        label: 'Giọng nói (TTS)',   icon: 'bi-mic',              hint: 'lip-sync, lồng tiếng, đọc kịch bản.' },
  { id: 'transcription', label: 'Nhận dạng / phụ đề', icon: 'bi-badge-cc',        hint: 'phụ đề: ASR + dịch.' }
]

// node type → capability. Type không có trong map = node luồng/tiện ích (không cần provider).
const NODE_CAPABILITY = {
  'create-image': 'image', tryon: 'image', compose: 'image',
  motion: 'video', 'fashion-motion': 'video', ss: 'video', 'wan-i2v': 'video',
  'text-to-video': 'video', teaser: 'video', bds: 'video',
  talk: 'speech', voiceover: 'speech',
  subtitle: 'transcription',
  chat: 'text', image: 'image'
}
export function capabilityOf(nodeType) {
  return NODE_CAPABILITY[nodeType] || null
}

// Provider kind: hiện chỉ "openai" (OpenAI-compatible: nhiều provider clone chuẩn này) + "anthropic" + "gemini".
// Mặc định 'openai' vì user chọn "cấu hình mở (custom base URL)".
export const PROVIDER_KINDS = [
  { id: 'openai',    label: 'OpenAI-compatible', baseUrl: 'https://api.openai.com/v1', browserHeader: null },
  { id: 'anthropic', label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com/v1', browserHeader: { 'anthropic-dangerous-direct-browser-access': 'true' } },
  { id: 'gemini',    label: 'Google Gemini',      baseUrl: 'https://generativelanguage.googleapis.com/v1beta', browserHeader: null },
  // ElevenLabs: TTS + CLONE giọng (nhóm speech). voice = voice_id (clone bên ElevenLabs → dán id vào node).
  { id: 'elevenlabs', label: 'ElevenLabs (TTS/clone)', baseUrl: 'https://api.elevenlabs.io/v1', browserHeader: null },
  { id: 'custom',    label: 'Custom (tự nhập URL)', baseUrl: '', browserHeader: null }
]

function _uid() {
  // Math.random/Date.now bị cấm trong workflow scripts, nhưng đây là composable FE bình thường → OK.
  return 'p_' + Math.random().toString(36).slice(2, 10)
}

export function useProviders() {
  const vault = useSecureVault()
  // useState: shared SSR-safe singleton trong app.
  const providers = useState('ms-providers', () => [])
  const bindings = useState('ms-provider-bindings', () => ({}))
  const loaded = useState('ms-providers-loaded', () => false)

  function _load() {
    if (loaded.value || !import.meta.client) return
    try {
      providers.value = JSON.parse(localStorage.getItem(LS_PROVIDERS) || '[]')
    } catch { providers.value = [] }
    try {
      bindings.value = JSON.parse(localStorage.getItem(LS_BINDINGS) || '{}')
    } catch { bindings.value = {} }
    loaded.value = true
  }

  function _persist() {
    if (!import.meta.client) return
    localStorage.setItem(LS_PROVIDERS, JSON.stringify(providers.value))
    localStorage.setItem(LS_BINDINGS, JSON.stringify(bindings.value))
  }

  // Thêm/sửa provider. plainApiKey (nếu có) sẽ được MÃ HOÁ trước khi lưu (apiKeyEnc).
  async function saveProvider({ id, name, kind = 'openai', baseUrl = '', plainApiKey, models = {}, extraHeaders = {} }) {
    _load()
    const kindDef = PROVIDER_KINDS.find((k) => k.id === kind)
    const rec = {
      id: id || _uid(),
      name: name || kindDef?.label || 'Provider',
      kind,
      baseUrl: baseUrl || kindDef?.baseUrl || '',
      models: models || {},        // { text:'gpt-4o', image:'gpt-image-1', ... } default model theo capability
      extraHeaders: extraHeaders || {}
    }
    const existing = providers.value.find((p) => p.id === rec.id)
    // apiKey: chỉ cập nhật khi user nhập mới (plainApiKey !== undefined). Giữ ciphertext cũ nếu để trống.
    if (plainApiKey !== undefined && plainApiKey !== null) {
      rec.apiKeyEnc = plainApiKey ? await vault.encrypt(plainApiKey) : ''
    } else {
      rec.apiKeyEnc = existing?.apiKeyEnc || ''
    }
    const idx = providers.value.findIndex((p) => p.id === rec.id)
    if (idx >= 0) providers.value[idx] = rec
    else providers.value.push(rec)
    _persist()
    return rec.id
  }

  function removeProvider(id) {
    _load()
    providers.value = providers.value.filter((p) => p.id !== id)
    // gỡ binding nào đang trỏ tới provider này
    for (const cap of Object.keys(bindings.value)) {
      if (bindings.value[cap]?.providerId === id) delete bindings.value[cap]
    }
    _persist()
  }

  // Gắn 1 capability vào provider + model (cái user gọi là "gắn theo group").
  function setBinding(capability, providerId, model = '') {
    _load()
    if (!providerId) delete bindings.value[capability]
    else bindings.value[capability] = { providerId, model }
    _persist()
  }

  function bindingFor(capability) {
    _load()
    return bindings.value[capability] || null
  }

  // Resolve runtime cho 1 capability: trả { provider, apiKey(đã giải mã), model, headers } để node gọi API.
  async function resolve(capability) {
    _load()
    const b = bindings.value[capability]
    if (!b) return null
    const provider = providers.value.find((p) => p.id === b.providerId)
    if (!provider) return null
    const apiKey = provider.apiKeyEnc ? await vault.decrypt(provider.apiKeyEnc) : ''
    const kindDef = PROVIDER_KINDS.find((k) => k.id === provider.kind)
    return {
      provider,
      apiKey,
      model: b.model || provider.models?.[capability] || '',
      baseUrl: (provider.baseUrl || kindDef?.baseUrl || '').replace(/\/$/, ''),
      headers: { ...(kindDef?.browserHeader || {}), ...(provider.extraHeaders || {}) }
    }
  }

  // Đã giải mã key của 1 provider (cho UI test/preview, KHÔNG log).
  async function revealKey(id) {
    _load()
    const p = providers.value.find((x) => x.id === id)
    return p?.apiKeyEnc ? await vault.decrypt(p.apiKeyEnc) : ''
  }

  return {
    providers, bindings, CAPABILITIES, PROVIDER_KINDS,
    load: _load, saveProvider, removeProvider, setBinding, bindingFor, resolve, revealKey,
    capabilityOf, hasKey: (p) => !!p?.apiKeyEnc, mask: vault.mask
  }
}
// #endregion
