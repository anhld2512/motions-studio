<template>
  <!-- #region ALD 22/05/2026 - Apple-style workflow node
       Soft white card, tinted-square icon, refined typography, subtle shadow.
       Selected state: System Blue ring (#007AFF). -->
  <div
    :class="[
      'apl-node',
      selected ? 'is-selected' : '',
      data._runState ? `state-${data._runState}` : ''
    ]"
    :style="{ '--accent': accent, '--accent-soft': accentSoft, '--accent-text': accentText }"
    ref="rootEl"
  >
    <!-- Status pill bottom (refined Apple capsule) -->
    <span class="apl-status" :data-state="data._runState || 'idle'">
      <i v-if="data._runState === 'success'" class="bi bi-check" />
      <i v-else-if="data._runState === 'error'" class="bi bi-exclamation" />
      <i v-else-if="data._runState === 'warn'" class="bi bi-exclamation" />
      <i v-else-if="data._runState === 'running'" class="bi bi-dot" />
    </span>

    <!-- Input handle (LEFT) — không có cho input* nodes (entry points).
         fashion-motion = 4 handles. motion = 3 handles (image / motion / audio). -->
    <template v-if="multiTargets.length">
      <Handle
        v-for="(slot, idx) in multiTargets"
        :key="slot.id"
        :id="slot.id"
        type="target"
        :position="Position.Left"
        :style="{ top: `${20 + idx * 20}%` }"
        :class="['apl-handle handle-target', `handle-${slot.id}`]"
      />
      <span
        v-for="(slot, idx) in multiTargets"
        :key="`lbl-${slot.id}`"
        :class="['handle-pill', `pill-${slot.id}`]"
        :style="{ top: `calc(${20 + idx * 20}% - 8px)` }"
      >{{ slot.label }}</span>
    </template>
    <Handle
      v-else-if="!isEntryNode"
      type="target"
      :position="Position.Left"
      class="apl-handle handle-target"
    />

    <!-- ALD 24/05/2026 - Preview thumbnail (chỉ hiện khi có data thực):
         · Input image/video: staticData (base64) hoặc URL config
         · Input audio: data URL / URL / signed URL từ library → mini audio player
         · Output: video placeholder khi đang chạy, video player khi done. -->
    <!-- ALD 24/05/2026 - Output node: preview giữ aspectRatio nhận từ workflow run.
         Nút Download overlay góc dưới phải khi có video kết quả. -->
    <div v-if="outputImageGrid.length > 1" class="apl-preview apl-preview-grid" :style="aspectStyle">
      <a
        v-for="(img, idx) in outputImageGrid"
        :key="img.url || idx"
        :href="img.url"
        target="_blank"
        class="apl-preview-grid-item"
        :title="img.label || `Ảnh ${idx + 1}`"
        @click.stop
      >
        <img :src="img.url" alt="" @load="_syncHandles" />
        <span>{{ img.label || `Ảnh ${idx + 1}` }}</span>
      </a>
      <button
        v-if="isOutputResult"
        type="button"
        class="apl-download-btn"
        title="Tải ảnh đầu tiên"
        @click.stop="onDownload"
      >
        <i class="bi bi-download" />
      </button>
    </div>
    <div v-else-if="previewSrc && !previewIsAudio" class="apl-preview" :style="aspectStyle">
      <video v-if="previewIsVideo" :src="previewSrc" muted playsinline preload="metadata" controls @loadedmetadata="_syncHandles" />
      <img   v-else                :src="previewSrc" alt="" @load="_syncHandles" />
      <button
        v-if="isOutputResult"
        type="button"
        class="apl-download-btn"
        title="Tải về"
        @click.stop="onDownload"
      >
        <i class="bi bi-download" />
      </button>
    </div>
    <div v-else-if="previewIsAudio && previewSrc" class="apl-preview apl-preview-audio">
      <audio :src="previewSrc" controls preload="metadata" @click.stop />
    </div>
    <div v-else-if="showOutputPlaceholder" class="apl-preview apl-preview-placeholder" :style="aspectStyle">
      <i :class="['bi', isOutputRunning ? 'bi-camera-reels animate-pulse' : 'bi-camera-reels']" />
      <span>{{ isOutputRunning ? 'Đang xử lý…' : 'Kết quả sẽ hiển thị ở đây' }}</span>
    </div>

    <div class="apl-body">
      <span class="apl-icon">
        <i :class="['bi', icon]" />
      </span>
      <div class="apl-text">
        <div class="apl-label">{{ label }}</div>
        <div :class="['apl-subtitle', !isConfigured && 'empty']" :title="subtitleTitle">
          <!-- ALD 11/06/2026 - Đang chạy/chờ/xong → chỉ hiện trạng thái (Processing/Waiting/Done), KHÔNG hiện model AI. -->
          <template v-if="runStateLabel">{{ runStateLabel }}</template>
          <template v-else-if="data.type === 'fashion-motion' && garmentIconClass">
            <span>{{ data.config?.preset || '15s-720p' }}</span>
            <i :class="['bi mx-0.5', garmentIconClass]" />
            <span v-if="data.config?.aspectRatio">{{ data.config.aspectRatio }}</span>
            <span v-if="data.config?.saveIntermediate" class="opacity-60">· +tryon</span>
          </template>
          <template v-else>{{ subtitle || 'Chưa cấu hình' }}</template>
        </div>
      </div>
    </div>

    <!-- Output handle (RIGHT) — variants:
         (1) condition: 2 handles true/false
         (2) onError='route': 2 handles success/error
         (3) output node: no handle
         (4) default: 1 handle (success) -->
    <template v-if="data.type === 'condition'">
      <Handle
        id="true"
        type="source"
        :position="Position.Right"
        :style="{ top: '40%' }"
        class="apl-handle handle-source handle-true"
      />
      <span class="branch-pill pill-true">True</span>
      <Handle
        id="false"
        type="source"
        :position="Position.Right"
        :style="{ top: '72%' }"
        class="apl-handle handle-source handle-false"
      />
      <span class="branch-pill pill-false">False</span>
    </template>
    <template v-else-if="errorRouted && data.type !== 'output'">
      <Handle
        id="success"
        type="source"
        :position="Position.Right"
        :style="{ top: '40%' }"
        class="apl-handle handle-source"
      />
      <span class="branch-pill pill-success">OK</span>
      <Handle
        id="error"
        type="source"
        :position="Position.Right"
        :style="{ top: '72%' }"
        class="apl-handle handle-source handle-error"
      />
      <span class="branch-pill pill-error">Err</span>
    </template>
    <Handle
      v-else-if="data.type !== 'output'"
      type="source"
      :position="Position.Right"
      class="apl-handle handle-source"
    />
  </div>
  <!-- #endregion -->
</template>

<script setup>
import { Handle, Position, useVueFlow } from '@vue-flow/core'

const props = defineProps({
  id: { type: String, default: '' },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

// ALD 02/06/2026 - FIX dây nối lệch khỏi chấm cổng: node đổi chiều cao (ảnh preview load xong, đổi
// subtitle…) → handle (đặt theo %) dịch, nhưng Vue Flow vẫn neo dây ở vị trí CŨ → dây 1 nơi, cổng 1 nơi.
// Phải gọi updateNodeInternals để Vue Flow tính lại điểm neo. ResizeObserver bắt mọi thay đổi size node.
const { updateNodeInternals } = useVueFlow()
const rootEl = ref(null)
let _ro = null
function _syncHandles() { if (props.id) updateNodeInternals([props.id]) }
onMounted(() => {
  _syncHandles()
  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    _ro = new ResizeObserver(() => requestAnimationFrame(_syncHandles))
    _ro.observe(rootEl.value)
  }
})
onBeforeUnmount(() => { if (_ro) { _ro.disconnect(); _ro = null } })

// Apple system colors — tinted icons giống iOS Symbols
// Common base color cho input variants — tất cả màu xanh emerald
const INPUT_BASE = { accent: '#34C759', accentSoft: '#E8F8EC', accentText: '#1F7D38' }
// Variant per contentType — icon + label đổi theo config.contentType
const INPUT_VARIANTS = {
  text:    { icon: 'bi-chat-left-text',  label: 'Input Text' },
  image:   { icon: 'bi-image',           label: 'Input Image' },
  video:   { icon: 'bi-film',            label: 'Input Video' },
  audio:   { icon: 'bi-music-note-beamed', label: 'Input Audio' },
  file:    { icon: 'bi-file-earmark',    label: 'Input File' },
  history: { icon: 'bi-clock-history',   label: 'Input History' }
}

const NODE_META = {
  // Legacy types — kept for backward compat (now all route to type='input' with config.contentType)
  inputText:    { ...INPUT_BASE, ...INPUT_VARIANTS.text },
  inputImage:   { ...INPUT_BASE, ...INPUT_VARIANTS.image },
  inputFile:    { ...INPUT_BASE, ...INPUT_VARIANTS.file },
  inputHistory: { ...INPUT_BASE, ...INPUT_VARIANTS.history },
  // Processing
  validate:      { icon: 'bi-check2-square',          accent: '#1F7D38', accentSoft: '#DCF4E2', accentText: '#0F4F1F', label: 'Validate' },
  motion:    { icon: 'bi-film',                  accent: '#FF2D55', accentSoft: '#FCE5EB', accentText: '#A11D38', label: 'Motion Transfer' },
  tryon:     { icon: 'bi-person-vcard',          accent: '#FF9500', accentSoft: '#FFF1DE', accentText: '#A86200', label: 'Try-on' },
  'create-image': { icon: 'bi-images',           accent: '#AF52DE', accentSoft: '#F4E9FB', accentText: '#702A98', label: 'Create Image' },
  compose:   { icon: 'bi-person-bounding-box',   accent: '#5856D6', accentSoft: '#ECECFB', accentText: '#3E3CA8', label: 'Ghép vào mẫu' },
  'fashion-motion': { icon: 'bi-magic',          accent: '#AF52DE', accentSoft: '#F4E9FB', accentText: '#702A98', label: 'Fashion Motion' },
  teaser:    { icon: 'bi-camera-reels-fill',     accent: '#FF2D55', accentSoft: '#FCE5EB', accentText: '#A11D38', label: 'Teaser' },
  'text-to-video': { icon: 'bi-camera-reels',    accent: '#FF2D55', accentSoft: '#FCE5EB', accentText: '#A11D38', label: 'Text → Video' },
  ss:        { icon: 'bi-film',                  accent: '#5856D6', accentSoft: '#ECECFB', accentText: '#3E3CA8', label: 'SS' },
  'wan-i2v': { icon: 'bi-camera-reels',          accent: '#FF2D55', accentSoft: '#FCE5EB', accentText: '#A11D38', label: 'Ảnh → Video (Wan)' },
  talk:      { icon: 'bi-mic-fill',              accent: '#34C759', accentSoft: '#E3F9E9', accentText: '#1B7A38', label: 'Nói (lip-sync)' },
  voiceover: { icon: 'bi-soundwave',             accent: '#34C759', accentSoft: '#E3F9E9', accentText: '#1B7A38', label: 'Lồng tiếng' },
  concat:    { icon: 'bi-collection-play-fill',  accent: '#5856D6', accentSoft: '#E8E8FB', accentText: '#3A38A6', label: 'Ghép cảnh' },
  subtitle:  { icon: 'bi-badge-cc',              accent: '#FF9500', accentSoft: '#FFF1DD', accentText: '#B36800', label: 'Language' },
  bds:       { icon: 'bi-buildings-fill',        accent: '#FF9500', accentSoft: '#FFF1DD', accentText: '#B36800', label: 'Time Lapse Construction' },
  debug:     { icon: 'bi-bug-fill',              accent: '#FF9500', accentSoft: '#FFEFD9', accentText: '#A86200', label: 'Debug' },
  http:      { icon: 'bi-cloud-arrow-up-fill',   accent: '#5856D6', accentSoft: '#ECEBFB', accentText: '#3E3CA8', label: 'HTTP' },
  // Flow control
  workflow:  { icon: 'bi-diagram-3-fill',        accent: '#FF2D55', accentSoft: '#FCE5EB', accentText: '#A11D38', label: 'Workflow' },
  condition: { icon: 'bi-shuffle',               accent: '#FF9500', accentSoft: '#FFEFD9', accentText: '#A86200', label: 'Condition' },
  output:    { icon: 'bi-box-arrow-right',       accent: '#8E8E93', accentSoft: '#EFEFF4', accentText: '#3C3C43', label: 'Output' },
  // ALD 11/06/2026 - Node khai báo API key (HuggingFace/Gemini/Veo/custom): nối cổng ra → cổng "API Key" của
  // node đích (ưu tiên nhất), hoặc đặt rời = tự phân bổ theo Type. Chỉ self-host không cần key.
}

const meta = computed(() => {
  // input node: variant theo config.contentType (text/image/file/history)
  if (props.data.type === 'input') {
    const ct = props.data.config?.contentType || 'text'
    return { ...INPUT_BASE, ...(INPUT_VARIANTS[ct] || INPUT_VARIANTS.text) }
  }
  return NODE_META[props.data.type] || { icon: 'bi-circle', accent: '#8E8E93', accentSoft: '#EFEFF4', accentText: '#3C3C43', label: props.data.type }
})
const icon = computed(() => meta.value.icon)
// ALD 24/05/2026 - Ưu tiên config.label do user/seed đặt (vd "Ảnh người mẫu", "Video motion")
// để phân biệt nhiều input cùng loại trong 1 workflow. Fallback về meta.label.
const label = computed(() => {
  const custom = props.data.config?.label
  if (custom && String(custom).trim()) return String(custom).trim()
  return meta.value.label
})
const accent = computed(() => meta.value.accent)
const accentSoft = computed(() => meta.value.accentSoft)
const accentText = computed(() => meta.value.accentText)

// ALD 11/06/2026 - Khi node đang chạy/chờ/xong → subtitle chỉ hiện TRẠNG THÁI (không hiện model AI/config).
const RUN_STATE_LABEL = { queued: 'Waiting', running: 'Processing', success: 'Done', error: 'Error', warn: 'Warning' }
const runStateLabel = computed(() => RUN_STATE_LABEL[props.data._runState] || '')

const subtitle = computed(() => {
  const c = props.data.config || {}
  if (props.data.type === 'input' || props.data.type === 'inputText' || props.data.type === 'inputImage' || props.data.type === 'inputFile' || props.data.type === 'inputHistory') {
    return inputSubtitle(c, props.data.type)
  }
  switch (props.data.type) {
    // ALD 11/06/2026 - KHÔNG hiện tên model/engine AI trên node (theo yêu cầu). Chỉ giữ thông tin chức năng.
    case 'motion': {
      const parts = [c.preset || '15s-720p']
      if (c.mode && c.mode !== 'transfer') parts.push(c.mode)
      if (c.refImageSource === 'url' && c.refImageUrl) parts.push('ref:URL')
      if (c.motionVideoSource === 'url' && c.motionVideoUrl) parts.push('vid:URL')
      return parts.join(' · ')
    }
    case 'fashion-motion': {
      // Subtitle text fallback (title attr + accessibility). Visual render dùng icon Bootstrap
      // qua template ngoài (xem template apl-subtitle với data.type === 'fashion-motion').
      const parts = [c.preset || '15s-720p']
      const garmentLabel = { upper: 'Áo', lower: 'Quần', dress: 'Váy', bikini: 'Bikini', accessory: 'Phụ kiện' }[c.garmentType]
      if (garmentLabel) parts.push(garmentLabel)
      if (c.aspectRatio) parts.push(c.aspectRatio)
      if (c.saveIntermediate) parts.push('+tryon')
      return parts.join(' · ')
    }
    case 'tryon': {
      // ALD 11/06/2026 - KHÔNG hiện engine (Qwen-Edit/Gemini). Chỉ loại đồ.
      const garmentLabel = { upper: 'Áo', lower: 'Quần', dress: 'Váy', set: 'Set', bikini: 'Bikini', accessory: 'Phụ kiện' }[c.garmentType]
      return garmentLabel || 'Thử đồ'
    }
    case 'create-image': {
      // ALD 11/06/2026 - KHÔNG hiện engine. Chỉ mô tả.
      if (c.prompt && c.prompt.trim()) {
        const p = c.prompt.trim()
        return p.length > 36 ? p.slice(0, 36) + '…' : p
      }
      return '— chưa có mô tả'
    }
    case 'workflow':  return c.slug ? `/${c.slug}` : '— no slug'
    case 'condition': return c.expression || '— no expression'
    case 'http':      return c.url ? `${(c.method || 'POST').toUpperCase()} ${c.url.length > 40 ? c.url.slice(0, 40) + '…' : c.url}` : '— no URL'
    case 'validate': {
      const f = (c.required_fields || []).length
      const m = (c.math_checks || []).length
      const mode = c.strict ? 'strict' : 'warn-only'
      return `${f} fields · ${m} math · ${mode}`
    }
    case 'output':    return `format: ${c.format || 'markdown'}`
    case 'debug': {
      const labels = []
      if (c.captureImage !== false) labels.push('image')
      if (c.captureVideo !== false) labels.push('video')
      if (c.captureAudio)            labels.push('audio')
      if (c.captureText !== false)  labels.push('text')
      return `${c.label || 'Debug step'} · ${labels.join('/')}`
    }
    case 'teaser': {
      const parts = []
      if (c.targetDurationSec) parts.push(`${c.targetDurationSec}s`)
      parts.push(`${Math.max(1, Math.min(6, Number(c.productCount) || 1))} ảnh`)
      if (Number(c.modelCount) > 0) parts.push(`${c.modelCount} mẫu`)
      if (c.aiDirector !== false) parts.push('AI')
      return parts.join(' · ')
    }
    case 'compose': {
      const np = Math.max(1, Math.min(2, Number(c.personCount) || 1))
      return `mẫu + ${np} ${c.subjectKind === 'product' ? 'SP' : 'người'}`
    }
    case 'talk': {
      const v = (c.voice || '').includes('Puck') || (c.voice || '').includes('Charon') ? 'giọng nam'
        : (c.voice || '').includes('Aoede') || (c.voice || '').includes('Kore') ? 'giọng nữ'
        : (c.voice || '').startsWith('vixtts') ? 'clone' : (c.voice || 'mặc định')
      const l = (c.line || '').trim()
      return `${v}${l ? ' · ' + (l.length > 22 ? l.slice(0, 22) + '…' : l) : ''}`
    }
    case 'concat':    return 'ghép các cảnh (giữ tiếng)'
    default:          return ''
  }
})

// "Đã cấu hình" check — TRUE nếu user đã set bất kỳ field nào ngoài defaults
const isConfigured = computed(() => {
  const c = props.data.config || {}
  switch (props.data.type) {
    case 'motion': return !!c.preset
    case 'fashion-motion': return !!c.preset && !!c.garmentType
    case 'teaser': return !!(c.scriptText && String(c.scriptText).trim())
    case 'tryon': return !!c.garmentType
    case 'create-image': return !!(c.prompt && c.prompt.trim())
    case 'compose': return true
    case 'concat': return true
    case 'debug': return true
    case 'workflow': return !!c.slug
    case 'condition': return !!c.expression
    case 'http': return !!c.url
    case 'output': return true
    case 'input': case 'inputText': case 'inputImage': case 'inputFile': case 'inputHistory': return true
    default: return false
  }
})

// Input subtitle: show source + relevant info per source
function inputSubtitle(c, type) {
  // Legacy infer
  const ct = c.contentType || ({ inputText: 'text', inputImage: 'image', inputFile: 'file', inputHistory: 'history' }[type] || 'text')
  const source = c.source || 'session'
  if (source === 'session') return `session.${c.field || ct}`
  if (source === 'url') {
    if (!c.url) return 'URL — chưa set'
    try { return `URL · ${new URL(c.url).hostname}` } catch { return `URL · ${c.url.slice(0, 24)}` }
  }
  if (source === 'static') {
    if (ct === 'text') return c.staticText ? `Static · "${c.staticText.slice(0, 18)}…"` : 'Static text — empty'
    return c.staticName ? `Upload · ${c.staticName.slice(0, 22)}` : 'Upload — chưa chọn'
  }
  // ALD 24/05/2026 - Library source: hiện tên file đã pick (nếu config.label đã track),
  // fallback gọn "Library /audio" / "Library /storage" để node không hiện "Chưa cấu hình".
  if (source === 'library') {
    if (!c.libraryId) return ct === 'audio' ? 'Library /audio — chưa pick' : 'Library /storage — chưa pick'
    return ct === 'audio' ? `Library /audio · ${String(c.libraryId).slice(0, 8)}` : `Library /storage · ${String(c.libraryId).slice(0, 8)}`
  }
  return ''
}

// Render error handle khi user bật "On Failure: route" trong inspector
const errorRouted = computed(() => (props.data.config?.onError) === 'route')

// ALD 24/05/2026 - Bootstrap icon class theo garmentType (NO emoji). Bootstrap Icons không
// có shirt/dress chuyên dụng → map tương đối:
//   upper       → bi-person          (focus phần trên)
//   lower       → bi-person-walking  (phần dưới / di chuyển)
//   dress       → bi-person-arms-up  (toàn thân váy liền)
//   accessory   → bi-bag-heart       (phụ kiện túi)
const garmentIconClass = computed(() => ({
  upper: 'bi-person-fill',
  lower: 'bi-person-walking',
  dress: 'bi-person-arms-up',
  bikini: 'bi-water',
  accessory: 'bi-bag-heart-fill',
}[props.data.config?.garmentType] || ''))
const subtitleTitle = computed(() => subtitle.value || 'Chưa cấu hình')

// ALD 24/05/2026 - Library signed URL resolver (audio /audio, image-video-file /storage).
// Cache theo libraryId trên local ref để không spam fetch khi Vue Flow re-render.
// ALD 27/05/2026 - Ưu tiên workflow-scoped endpoint /workflows/:wfId/asset/:libId nếu đang
// trong context workflow editor (route.params.id) → public viewer truy cập được asset owner
// reference trong def. Fallback direct /audio-files /storage-files cho trường hợp ngoài
// editor (vd shared component nếu có).
const libraryResolvedUrl = ref('')
const libraryResolvingId = ref('')
const route = useRoute()
const wf = useWorkflows()
async function resolveLibraryUrl(libId, ct) {
  if (!libId) { libraryResolvedUrl.value = ''; return }
  if (libraryResolvingId.value === libId && libraryResolvedUrl.value) return
  libraryResolvingId.value = libId
  const wfId = route?.params?.id
  const kind = ct === 'audio' ? 'audio' : 'storage'
  try {
    if (wfId) {
      const item = await wf.getAsset(String(wfId), libId, kind)
      if (item?.signedUrl) {
        if (libraryResolvingId.value === libId) libraryResolvedUrl.value = item.signedUrl
        return
      }
      // Fallthrough — endpoint mới trả null (e.g., libId không reference trong def) thì
      // thử direct (owner trường hợp picker chưa save vào def).
    }
    if (ct === 'audio') {
      const audio = useAudioFiles()
      const url = await audio.getSignedUrl(libId)
      if (libraryResolvingId.value === libId) libraryResolvedUrl.value = url || ''
    } else {
      const storage = useStorageFiles()
      const data = await storage.getSignedUrl(libId).catch(() => null)
      const url = data?.signedUrl || data?.signed_url || ''
      if (libraryResolvingId.value === libId) libraryResolvedUrl.value = url
    }
  } catch {
    libraryResolvedUrl.value = ''
  }
}
watch(() => [props.data.config?.libraryId, props.data.config?.contentType, props.data.config?.source], ([id, ct, src]) => {
  if (src === 'library' && id) resolveLibraryUrl(id, ct)
  else libraryResolvedUrl.value = ''
}, { immediate: true })

// Preview src cho node:
// · Input: staticData (base64) → wrap data:URL; OR url field (skip nếu template `{{...}}`)
// · Library: signed URL từ /audio (audio) / /storage (image/video/file)
// · Output: data._runOutput.video / .image sau khi Test xong
const previewSrc = computed(() => {
  const c = props.data.config || {}
  const t = props.data.type
  if (t === 'input' || t === 'inputText' || t === 'inputImage' || t === 'inputFile' || t === 'inputHistory') {
    const ct = c.contentType || ''
    if (!['image', 'video', 'audio'].includes(ct)) return null
    // ALD 27/05/2026 - staticUrl (FE upload → storage) ưu tiên hơn staticData (base64 legacy).
    // Refactor static base64 → URL: workflow lưu URL persistent → canvas FlowNode preview
    // hiện ngay không cần chờ run. Engine fetch URL khi chạy + re-sign nếu expire.
    if (c.source === 'static' && c.staticUrl) return c.staticUrl
    if (c.source === 'static' && c.staticData) {
      if (/^data:/.test(c.staticData)) return c.staticData
      const mime = c.staticMime || (ct === 'video' ? 'video/mp4' : ct === 'audio' ? 'audio/mpeg' : 'image/jpeg')
      return `data:${mime};base64,${c.staticData}`
    }
    if (c.source === 'url' && c.url && !/^\{\{/.test(c.url)) return c.url
    if (c.source === 'library' && libraryResolvedUrl.value) return libraryResolvedUrl.value
    // ALD 27/05/2026 - Fallback: khi user click run cũ, workflow def staticData đã bị
    // strip trên BE save. Watcher selectedRunId extract URL upload từ events đặt vào
    // _runOutput. Hiện ở preview để user thấy "input nào đã dùng cho run đó".
    const out = props.data._runOutput
    if (out && (out.image || out.video || out.audio)) {
      return out.video || out.image || out.audio
    }
    return null
  }
  if (t === 'output') {
    const out = props.data._runOutput || {}
    return out.video || out.image || out.images?.[0]?.url || null
  }
  // ALD 27/05/2026 - Intermediate nodes (tryon/motion/fashion-motion) cũng có
  // _runOutput sau khi run xong (engine emit previewUrl trong success event).
  // Tryon → image PNG, motion / fashion-motion → video MP4.
  if (t === 'tryon' || t === 'create-image' || t === 'compose' || t === 'motion' || t === 'fashion-motion' || t === 'teaser' || t === 'subtitle') {
    const out = props.data._runOutput || {}
    return out.video || out.image || out.images?.[0]?.url || null
  }
  return null
})
const previewIsVideo = computed(() => {
  const c = props.data.config || {}
  const t = props.data.type
  if (t === 'output' || t === 'tryon' || t === 'create-image' || t === 'compose' || t === 'motion' || t === 'fashion-motion' || t === 'teaser' || t === 'subtitle') {
    return !!(props.data._runOutput?.video)
  }
  return c.contentType === 'video'
})
const previewIsAudio = computed(() => {
  const c = props.data.config || {}
  return c.contentType === 'audio'
})
const outputImageGrid = computed(() => {
  if (props.data.type !== 'output') return []
  const out = props.data._runOutput || {}
  const list = Array.isArray(out.images) ? out.images : []
  return list
    .map((it, idx) => typeof it === 'string' ? { url: it, label: `Ảnh ${idx + 1}` } : it)
    .filter((it) => it?.url && !String(it.url).toLowerCase().endsWith('.mp4'))
})
// Output node placeholder: hiện skeleton khi đang chạy / queued, hoặc khi format=video
// nhưng chưa có kết quả — để user thấy chỗ video sẽ render.
const isOutputRunning = computed(() => {
  return props.data.type === 'output' && (props.data._runState === 'running' || props.data._runState === 'queued')
})
const showOutputPlaceholder = computed(() => {
  if (props.data.type !== 'output') return false
  const fmt = props.data.config?.format
  if (fmt !== 'video' && fmt !== 'image') return false
  return isOutputRunning.value || !props.data._runOutput
})
const isOutputResult = computed(() => props.data.type === 'output' && !!props.data._runOutput)

// ALD 27/05/2026 - aspectStyle giờ chỉ override khi metadata explicit aspect_ratio
// (vd output có metadata.aspect_ratio='9:16'). Mặc định để CSS class .apl-preview
// dùng 16:9. Bỏ giá trị fallback `{ height: '160px' }` để tỉ lệ luôn áp dụng.
const aspectStyle = computed(() => {
  if (props.data.type !== 'output') return {}
  const ratio = props.data._runOutput?.metadata?.aspect_ratio
              || props.data.config?.aspectRatio
              || ''
  const m = String(ratio).match(/^(\d+):(\d+)$/)
  if (!m) return {}  // fallback 16:9 từ CSS
  const w = Number(m[1]); const h = Number(m[2])
  return { aspectRatio: `${w} / ${h}` }
})
async function onDownload() {
  const src = previewSrc.value
  if (!src) return
  try {
    const res = await fetch(src)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ext = previewIsVideo.value ? 'mp4' : 'png'
    a.download = `output-${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.warn('[FlowNode] download fail, fallback open:', e)
    window.open(src, '_blank')
  }
}

// Entry nodes (input*) không có input handle bên trái — chúng là source của data.
const isEntryNode = computed(() => {
  const t = props.data.type
  if (['input', 'inputText', 'inputImage', 'inputFile', 'inputHistory'].includes(t)) return true
  // ALD 14/06/2026 - text-to-video: CHỈ prompt (không ảnh) → node NGUỒN, KHÔNG có cổng input bên trái.
  if (t === 'text-to-video') return true
  // ALD 31/05/2026 - Create Image với 0 cổng ảnh = node NGUỒN (sinh ảnh từ prompt) →
  // không có điểm nối input. Có ≥1 ảnh thì dùng multi-handle (image1..N) nên không tới đây.
  // (11/06: nếu provider cần key thì multiTargets đã có cổng apikey → template đi nhánh multi, không tới đây.)
  if (t === 'create-image') {
    const n = Number(props.data.config?.inputCount)
    return !(Number.isFinite(n) && n > 0)
  }
  return false
})

// ALD 24/05/2026 - fashion-motion node có 4 target handles (slot riêng theo purpose).
// Edge.targetHandle = id giúp engine map đúng input → slot.
// #region ALD 10/06/2026 - Tryon/Fashion-Motion: cổng SP động (config.productCount 1-2). Ảnh góc 2 (mặt sau/
// bên hông) → Qwen-Edit image3 → render đúng sản phẩm khi người mẫu quay lưng/xoay người. Qwen tối đa 3 slot
// ảnh (model chiếm 1) nên cap 2 ảnh SP. Handle id khớp worker: product + product2.
const PRODUCT_PORT_COUNT = computed(() => {
  const n = Number(props.data.config?.productCount)
  return Math.max(1, Math.min(2, Number.isFinite(n) && n > 0 ? n : 1))
})
const productPorts = (count) => Array.from({ length: count }, (_, i) => ({
  id: i === 0 ? 'product' : `product${i + 1}`,
  label: count >= 2 ? `Ảnh SP ${i + 1}` : 'Sản phẩm'
}))
const FASHION_TARGETS = computed(() => [
  { id: 'model',   label: 'Người mẫu' },
  ...productPorts(PRODUCT_PORT_COUNT.value),
  { id: 'motion',  label: 'Motion' },
  { id: 'audio',   label: 'Audio (opt)' }
])
// Motion Transfer: 3 handles (image + motion + audio)
const MOTION_TARGETS = [
  { id: 'image',   label: 'Người mẫu' },
  { id: 'motion',  label: 'Motion' },
  { id: 'audio',   label: 'Audio (opt)' }
]
// Tryon: model + 1-2 cổng sản phẩm. Output image (ảnh đã thay đồ).
const TRYON_TARGETS = computed(() => [
  { id: 'model',   label: 'Người mẫu' },
  ...productPorts(PRODUCT_PORT_COUNT.value)
])
// #endregion
// Create Image: số cổng ảnh động theo config.inputCount (MẶC ĐỊNH 0 = text→image thuần).
// ALD 31/05/2026 - 0 cổng = sinh ảnh CHỈ từ prompt (không cần input ảnh). Thêm cổng (1-6) =
// chỉnh/sinh theo ảnh tham chiếu. Chỉnh ở Inspector (props.config.inputCount).
const CREATE_IMAGE_COUNT = computed(() => {
  const n = Number(props.data.config?.inputCount)
  return Math.max(0, Math.min(6, Number.isFinite(n) && n >= 0 ? n : 0))
})
// ≥2 ảnh: Ảnh 1 = "Ảnh mẫu" (base/tham chiếu phong cách-trang phục), còn lại "Ảnh 2..N".
// 1 ảnh = "Ảnh gốc" (ảnh chỉnh sửa). Handle id giữ image1..N (worker gom theo thứ tự, image1=base).
const CREATE_IMAGE_TARGETS = computed(() => {
  const n = CREATE_IMAGE_COUNT.value
  return Array.from({ length: n }, (_, i) => ({
    id: `image${i + 1}`,
    label: n >= 2 ? (i === 0 ? 'Ảnh mẫu' : `Ảnh ${i + 1}`) : 'Ảnh gốc',
  }))
})
// ALD 31/05/2026 - Teaser: cổng động — Sản phẩm (config.productCount 1-6) + Người mẫu
// (config.modelCount 0-3, opt). Bỏ cổng Motion (teaser không có motion video) + Nhạc
// (chuyển sang upload trong Inspector → params.musicKey). Handle id khớp worker gom
// product/product\d+ + model/model\d+. Nhạc nền: Inspector → engine nạp vào inputs.music.
const TEASER_PRODUCT_COUNT = computed(() => {
  const n = Number(props.data.config?.productCount)
  return Math.max(1, Math.min(6, Number.isFinite(n) && n > 0 ? n : 1))
})
// ALD 02/06/2026 - Teaser = product-hero THUẦN (KHÔNG người mẫu) → chỉ cổng ảnh SP.
const TEASER_TARGETS = computed(() => {
  const out = []
  for (let i = 0; i < TEASER_PRODUCT_COUNT.value; i++)
    out.push({ id: i === 0 ? 'product' : `product${i + 1}`, label: `Ảnh SP ${i + 1}` })
  return out
})
// ALD 31/05/2026 - Compose "Ghép vào mẫu": cổng image1 = Ảnh mẫu (base latent) +
// image2..N = Người (config.personCount 1-2). Qwen-Edit tối đa 3 ảnh = mẫu + 2 người.
const COMPOSE_PERSON_COUNT = computed(() => {
  const n = Number(props.data.config?.personCount)
  return Math.max(1, Math.min(2, Number.isFinite(n) && n > 0 ? n : 1))
})
const COMPOSE_TARGETS = computed(() => {
  const kind = props.data.config?.subjectKind === 'product' ? 'SP' : 'Người'
  const out = [{ id: 'image1', label: 'Ảnh mẫu' }]
  for (let i = 0; i < COMPOSE_PERSON_COUNT.value; i++)
    out.push({ id: `image${i + 2}`, label: `${kind} ${i + 1}` })
  return out
})
// ALD 03/06/2026 - Concat "Ghép cảnh": cổng clip1..N — mỗi cổng 1 phân cảnh.
// ALD 17/06/2026 - max 8 (trước 6): generator BĐS có thể dựng tới 6 công đoạn + cảnh đêm = 7 clip. run_concat (BE) gom clip bất kỳ.
const CONCAT_CLIP_COUNT = computed(() => {
  const n = Number(props.data.config?.clipCount)
  return Math.max(2, Math.min(8, Number.isFinite(n) && n >= 2 ? n : 2))
})
const CONCAT_TARGETS = computed(() => {
  const out = []
  for (let i = 0; i < CONCAT_CLIP_COUNT.value; i++) out.push({ id: `clip${i + 1}`, label: `Cảnh ${i + 1}` })
  return out
})
// ALD 15/06/2026 - SS cổng vào ĐỘNG 1–3 ảnh (model động) theo config.inputCount. id 'input' (1st)/'image2'/'image3'.
const SS_TARGETS = computed(() => {
  const n = Math.max(1, Math.min(3, Number(props.data.config?.inputCount) || 1))
  return ['input', 'image2', 'image3'].slice(0, n).map((id, i) => ({ id, label: `Ảnh ${i + 1}` }))
})
// ALD 18/06/2026 - wan-i2v: cổng 'start' (ảnh đầu, BẮT BUỘC) + 'end' (ảnh cuối, TUỲ CHỌN) → FLF morph start→end (liền mạch).
const WAN_I2V_TARGETS = [{ id: 'start', label: 'Ảnh đầu' }, { id: 'end', label: 'Ảnh cuối (opt)' }]
// ALD 18/06/2026 - motions-studio: API key cấu hình ở Cài đặt → Provider (theo nhóm), KHÔNG còn node/cổng API Key.
// Unified multi-target lookup theo node type
const multiTargets = computed(() => {
  if (props.data.type === 'fashion-motion') return FASHION_TARGETS.value
  // motion: ẩn cổng 'audio' khi dùng ÂM GỐC video (audioPassthrough mặc định true) — chỉ hiện khi chọn "Âm thay thế".
  if (props.data.type === 'motion')
    return props.data.config?.audioPassthrough === false ? MOTION_TARGETS : MOTION_TARGETS.filter((s) => s.id !== 'audio')
  if (props.data.type === 'tryon') return TRYON_TARGETS.value
  if (props.data.type === 'create-image') return CREATE_IMAGE_TARGETS.value
  if (props.data.type === 'compose') return COMPOSE_TARGETS.value
  if (props.data.type === 'ss') return SS_TARGETS.value
  if (props.data.type === 'wan-i2v') return WAN_I2V_TARGETS
  if (props.data.type === 'teaser') return TEASER_TARGETS.value
  if (props.data.type === 'concat') return CONCAT_TARGETS.value
  return []
})
// Đổi SỐ cổng input (vd ẩn/hiện cổng audio motion theo audioPassthrough) → Vue Flow phải tính lại điểm neo dây.
watch(() => multiTargets.value.length, () => nextTick(() => _syncHandles()))
</script>

<style scoped>
/* #region ALD 22/05/2026 - Apple HIG-inspired node */
.apl-node {
  position: relative;
  /* ALD 24/05/2026 - Width cố định 240px. KHÔNG overflow:hidden — sẽ clip Vue Flow
     handles (chấm tròn nối) thò ra cạnh trái/phải. */
  width: 240px;
  min-width: 240px;
  max-width: 240px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border-radius: 20px;
  border: 0.5px solid rgba(60, 60, 67, 0.10);
  box-shadow:
    0 0.5px 1px rgba(0, 0, 0, 0.04),
    0 2px 6px rgba(0, 0, 0, 0.05),
    0 16px 32px -8px rgba(0, 0, 0, 0.10);
  transition: box-shadow 0.25s cubic-bezier(0.32, 0.72, 0, 1),
              border-color 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  cursor: grab;
}
.apl-node:active { cursor: grabbing; }
/* Hover: KHÔNG transform — chỉ shadow tăng + border đậm hơn. Transform làm vỡ
   layout edges (handle position dịch theo) → đường nối bể. */
.apl-node:hover {
  border-color: rgba(60, 60, 67, 0.22);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.06),
    0 8px 18px rgba(0, 0, 0, 0.08);
}
.apl-node.is-selected {
  border-color: rgba(0, 122, 255, 0.7);
  box-shadow:
    0 0 0 2px rgba(0, 122, 255, 0.2),
    0 6px 18px rgba(0, 122, 255, 0.08);
}

/* Run state */
.apl-node.state-running {
  border-color: rgba(255, 149, 0, 0.5);
  animation: apl-pulse 1.4s ease-in-out infinite;
}
.apl-node.state-success { border-color: rgba(52, 199, 89, 0.55); }
.apl-node.state-warn    { border-color: rgba(255, 149, 0, 0.55); box-shadow: 0 0 0 3px rgba(255, 149, 0, 0.12); }
.apl-node.state-error   { border-color: rgba(255, 59, 48, 0.55); box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.12); }
@keyframes apl-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 149, 0, 0.18), 0 8px 24px rgba(255, 149, 0, 0.1); }
  50%      { box-shadow: 0 0 0 8px rgba(255, 149, 0, 0), 0 8px 24px rgba(255, 149, 0, 0.15); }
}

.apl-preview {
  position: relative;
  width: 100%;
  /* ALD 27/05/2026 - Adaptive aspect ratio: box auto-fit theo natural ratio của content
     (image/video). User feedback: 16:9 cứng làm portrait Wan output 9:16 bị letterbox
     2 bên đen — xấu. Bỏ aspect-ratio cứng, để <img>/<video> sizing tự nhiên fill width
     và đặt box height theo content. Cap max-height để không vỡ layout node. */
  max-height: 360px;
  overflow: hidden;
  background: #0a0a0a;
  /* Round top corners theo node radius (20) — không phụ thuộc parent overflow */
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  /* Layout flex để image/video center khi có max-height crop */
  display: flex;
  align-items: center;
  justify-content: center;
}
.apl-preview img,
.apl-preview video {
  width: 100%;
  height: auto;
  max-height: 360px;
  object-fit: contain;
  display: block;
}
.apl-preview-grid {
  max-height: 360px;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  justify-content: stretch;
  gap: 8px;
  overflow-y: auto;
  background: #f6f7f9;
}
.apl-preview-grid-item {
  min-width: 0;
  overflow: hidden;
  border-radius: 10px;
  background: white;
  border: 0.5px solid rgba(60,60,67,0.14);
  text-decoration: none;
  color: rgba(60,60,67,0.72);
}
.apl-preview-grid-item img {
  width: 100%;
  aspect-ratio: 1 / 1;
  height: auto;
  max-height: none;
  object-fit: cover;
  display: block;
}
.apl-preview-grid-item span {
  display: block;
  padding: 4px 6px 5px;
  font-size: 9.5px;
  line-height: 1.2;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* ALD 27/05/2026 - Audio override .apl-preview adaptive aspect → audio compact height. */
.apl-preview-audio {
  height: 64px;
  max-height: 64px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  background: linear-gradient(135deg, rgba(52,199,89,0.14), rgba(48,176,199,0.14));
}
.apl-preview-audio audio {
  width: 100%;
  min-width: 0;       /* override native min-width */
  height: 36px;
  display: block;
}
/* ALD 24/05/2026 - Output placeholder: skeleton khi workflow đang chạy hoặc chưa có kết quả */
/* ALD 27/05/2026 - Placeholder không có content → set min-height đảm bảo thấy được */
.apl-preview-placeholder {
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: repeating-linear-gradient(
    45deg,
    rgba(60,60,67,0.04),
    rgba(60,60,67,0.04) 8px,
    rgba(60,60,67,0.08) 8px,
    rgba(60,60,67,0.08) 16px
  );
  color: rgba(60,60,67,0.5);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.apl-preview-placeholder i { font-size: 22px; }
.apl-download-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55);
  color: white;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.16s cubic-bezier(0.32, 0.72, 0, 1);
  z-index: 2;
}
.apl-download-btn:hover { background: rgba(0,0,0,0.78); transform: scale(1.06); }

.apl-body {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px 16px;
}
.apl-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 18px;
  /* iOS app icon-like with subtle inner glow */
  box-shadow:
    inset 0 0.5px 0 rgba(255,255,255,0.6),
    0 0.5px 2px rgba(0,0,0,0.04);
}
.apl-text { min-width: 0; flex: 1; }
.apl-label {
  font-size: 14.5px;
  font-weight: 600;
  color: #1c1c1e;
  letter-spacing: -0.022em;
  line-height: 1.18;
}
.apl-subtitle {
  font-size: 11.5px;
  font-weight: 500;
  color: rgba(60, 60, 67, 0.55);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.005em;
  display: flex;
  align-items: center;
  gap: 4px;
}
.apl-subtitle i.bi { font-size: 12px; opacity: 0.85; }
.apl-subtitle.empty {
  color: rgba(60, 60, 67, 0.3);
  font-style: italic;
}

/* Status pill bottom-right — small capsule */
.apl-status {
  position: absolute;
  bottom: -6px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: #C7C7CC;             /* iOS gray idle */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  font-weight: 800;
  box-shadow: 0 0 0 3px white, 0 1px 2px rgba(0,0,0,0.1);
  padding: 0 2px;
}
.apl-status[data-state="running"] { background: #FF9500; animation: apl-blink 1s infinite; }
.apl-status[data-state="success"] { background: #34C759; }
.apl-status[data-state="warn"]    { background: #FF9500; }
.apl-status[data-state="error"]   { background: #FF3B30; }
@keyframes apl-blink {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.15); }
}

/* Handles — bigger để dễ click, hover chỉ glow ring (không scale → edge không bể) */
:deep(.apl-handle) {
  width: 14px !important;
  height: 14px !important;
  background: white !important;
  border: 2.5px solid var(--accent) !important;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  transition: box-shadow 0.18s ease, background 0.18s ease;
  z-index: 10;
}
:deep(.apl-handle:hover) {
  background: var(--accent) !important;
  box-shadow: 0 0 0 6px var(--accent-soft), 0 2px 4px rgba(0,0,0,0.12);
  cursor: crosshair;
}
:deep(.apl-handle.connectingfrom),
:deep(.apl-handle.connectingto) {
  background: #007AFF !important;
  box-shadow: 0 0 0 8px rgba(0, 122, 255, 0.18) !important;
}
:deep(.handle-target) {
  border-color: #94a3b8 !important;
  left: -8px !important;
}
:deep(.handle-source) {
  right: -8px !important;
}
:deep(.handle-true)  { border-color: #34C759 !important; }
:deep(.handle-false) { border-color: #FF3B30 !important; }
:deep(.handle-error) { border-color: #FF9500 !important; }

/* Branch pills (condition) — iOS-style capsule */
.branch-pill {
  position: absolute;
  right: -8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: -0.01em;
  padding: 2px 8px;
  border-radius: 999px;
  background: white;
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  transform: translateX(100%);
  margin-left: 14px;
}
.pill-true    { top: calc(40% - 10px); color: #1F7D38; }
.pill-false   { top: calc(72% - 10px); color: #9F2620; }
.pill-success { top: calc(40% - 10px); color: #1F7D38; }
.pill-error   { top: calc(72% - 10px); color: #A86200; }

/* ALD 24/05/2026 - Fashion Motion target handle pills (4 slot bên trái) */
.handle-pill {
  position: absolute;
  left: -8px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  padding: 1.5px 7px;
  border-radius: 999px;
  background: white;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  transform: translateX(-100%);
  margin-right: 14px;
  color: #AF52DE;
}
.pill-audio { color: #FF9500; }
/* fashion-motion node cần cao hơn để chứa 4 handle thoải mái */
.apl-node:has(.handle-pill) {
  min-height: 132px;
}
/* #endregion */
</style>
