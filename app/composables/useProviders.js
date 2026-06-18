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

// Preset provider: base URL có sẵn của các nhà lớn + model GỢI Ý theo từng nhóm năng lực (điền sẵn).
// Mọi kind KHÁC anthropic/gemini/elevenlabs đều được client xử lý như OpenAI-compatible (chat/completions, images/generations).
export const PROVIDER_KINDS = [
  {
    id: 'openai', label: 'OpenAI (ChatGPT)', baseUrl: 'https://api.openai.com/v1', browserHeader: null,
    models: {
      text: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o3-mini', 'o1'],
      image: ['gpt-image-1', 'dall-e-3'],
      speech: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
      transcription: ['whisper-1', 'gpt-4o-transcribe']
    }
  },
  {
    id: 'anthropic', label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com/v1',
    browserHeader: { 'anthropic-dangerous-direct-browser-access': 'true' },
    models: { text: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'] }
  },
  {
    id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', browserHeader: null,
    models: {
      text: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'],
      // "Nano Banana" = gemini-2.5-flash-image · "Nano Banana Pro" = gemini-3-pro-image-preview · imagen = sinh ảnh thuần.
      image: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image-preview', 'imagen-4.0-generate-001', 'imagen-3.0-generate-002'],
      video: ['veo-3.0-generate-001', 'veo-3.0-fast-generate-001', 'veo-2.0-generate-001'],
      speech: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']
    }
  },
  {
    id: 'elevenlabs', label: 'ElevenLabs (TTS/clone)', baseUrl: 'https://api.elevenlabs.io/v1', browserHeader: null,
    models: { speech: ['eleven_multilingual_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2_5'] }
  },
  {
    id: 'openrouter', label: 'OpenRouter (gộp nhiều hãng)', baseUrl: 'https://openrouter.ai/api/v1', browserHeader: null,
    models: { text: ['anthropic/claude-sonnet-4-6', 'google/gemini-2.5-pro', 'openai/gpt-4o', 'meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat'] }
  },
  {
    id: 'groq', label: 'Groq (siêu nhanh)', baseUrl: 'https://api.groq.com/openai/v1', browserHeader: null,
    models: { text: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] }
  },
  {
    id: 'xai', label: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', browserHeader: null,
    models: { text: ['grok-2-latest', 'grok-2-vision-1212'] }
  },
  {
    id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', browserHeader: null,
    models: { text: ['deepseek-chat', 'deepseek-reasoner'] }
  },
  {
    id: 'mistral', label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', browserHeader: null,
    models: { text: ['mistral-large-latest', 'mistral-small-latest', 'pixtral-large-latest'] }
  },
  {
    id: 'together', label: 'Together (FLUX/Llama)', baseUrl: 'https://api.together.xyz/v1', browserHeader: null,
    models: { text: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'], image: ['black-forest-labs/FLUX.1-schnell-Free', 'black-forest-labs/FLUX.1-dev'] }
  },
  {
    // fal.ai = cổng gộp VIDEO/ẢNH lớn nhất: Kling, Runway, Luma, Minimax/Hailuo, Veo, Flux… chạy thẳng từ browser.
    id: 'fal', label: 'fal.ai (Kling/Runway/Luma/Flux)', baseUrl: 'https://fal.run', browserHeader: null,
    models: {
      image: ['fal-ai/nano-banana', 'fal-ai/flux/dev', 'fal-ai/flux-pro/v1.1', 'fal-ai/flux/schnell'],
      video: [
        'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
        'fal-ai/kling-video/v2/master/image-to-video',
        'fal-ai/runway-gen3/turbo/image-to-video',
        'fal-ai/luma-dream-machine',
        'fal-ai/minimax/hailuo-02/standard/image-to-video',
        'fal-ai/veo3/image-to-video'
      ]
    }
  },
  {
    id: 'replicate', label: 'Replicate', baseUrl: 'https://api.replicate.com/v1', browserHeader: null,
    models: { image: ['black-forest-labs/flux-dev'], video: ['kwaivgi/kling-v2.1', 'minimax/hailuo-02', 'luma/ray'] }
  },
  { id: 'custom', label: 'Custom (tự nhập URL)', baseUrl: '', browserHeader: null, models: {} }
]

// Model gợi ý cho 1 provider theo capability (mảng id). Trả [] nếu provider/custom không có preset.
export function suggestedModels(kindId, capability) {
  return PROVIDER_KINDS.find((k) => k.id === kindId)?.models?.[capability] || []
}

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
    // models mặc định = model ĐẦU TIÊN trong preset của kind cho mỗi capability (để resolve() có fallback).
    const defaultModels = {}
    for (const [cap, list] of Object.entries(kindDef?.models || {})) if (list?.[0]) defaultModels[cap] = list[0]
    const rec = {
      id: id || _uid(),
      name: name || kindDef?.label || 'Provider',
      kind,
      baseUrl: baseUrl || kindDef?.baseUrl || '',
      models: (models && Object.keys(models).length) ? models : defaultModels,
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
    capabilityOf, suggestedModels, hasKey: (p) => !!p?.apiKeyEnc, mask: vault.mask
  }
}
// #endregion
