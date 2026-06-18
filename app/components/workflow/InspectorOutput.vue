<template>
  <div class="space-y-3">
    <div>
      <label class="apl-label">Format trả về end user</label>
      <div class="apl-segmented mt-1.5">
        <button
          v-for="f in formats"
          :key="f.id"
          type="button"
          :class="['apl-seg-btn', local.format === f.id ? 'is-active' : '']"
          @click="local.format = f.id"
        >
          <i :class="['bi mr-1', f.icon]" />
          {{ f.label }}
        </button>
      </div>
    </div>

    <div class="apl-card">
      <div class="apl-card-header">
        <i :class="['bi mr-1', activeFormat.icon]" />
        {{ activeFormat.label }}
      </div>
      <p class="apl-card-hint">{{ activeFormat.desc }}</p>
    </div>

  </div>
</template>

<script setup>
const props = defineProps({ config: { type: Object, required: true } })
const emit = defineEmits(['update:config'])

const formats = [
  { id: 'markdown', label: 'Markdown', icon: 'bi-markdown', desc: 'Chat render markdown (bảng, code, list). Default — phù hợp hầu hết case.' },
  { id: 'text',     label: 'Text',     icon: 'bi-text-paragraph', desc: 'Plain text monospace, không format. Cho output raw từ LLM/HTTP.' },
  { id: 'json',     label: 'JSON',     icon: 'bi-braces',  desc: 'Parse text → JSON object trong metadata.parsed. Chat render syntax highlight + UI để inspect.' },
  { id: 'video',    label: 'Video',    icon: 'bi-film',    desc: 'Render player MP4 inline (output.video URL). Cho Motion / Fashion Motion.' },
  { id: 'image',    label: 'Image',    icon: 'bi-image',   desc: 'Render ảnh preview (output.image URL). Cho Image generation nodes.' },
  { id: 'file',     label: 'File',     icon: 'bi-file-earmark-arrow-down', desc: 'Trả file download cho user (nếu prev node có .file).' }
]

const local = reactive({ format: props.config.format || 'markdown', cleanup: props.config.cleanup ?? false })
watch(local, (v) => emit('update:config', { ...v }), { deep: true })

const activeFormat = computed(() => formats.find((f) => f.id === local.format) || formats[0])
</script>

<style scoped>
.apl-label { display: block; font-size: 11px; font-weight: 700; color: rgba(60,60,67,0.6); text-transform: uppercase; letter-spacing: 0.04em; }
.apl-segmented {
  display: inline-flex; width: 100%;
  background: rgba(118,118,128,0.12); border-radius: 9px; padding: 2px;
}
.apl-seg-btn {
  flex: 1; padding: 6px 8px;
  background: transparent; border: none; border-radius: 7px;
  font-size: 11px; font-weight: 600; color: rgba(60,60,67,0.6);
  cursor: pointer; font-family: inherit;
  transition: all 0.18s cubic-bezier(0.32, 0.72, 0, 1);
}
.apl-seg-btn:hover { color: #1c1c1e; }
.apl-seg-btn.is-active {
  background: white; color: #1c1c1e;
  box-shadow: 0 0.5px 1px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.08);
}
.apl-card {
  padding: 12px;
  background: rgba(118,118,128,0.06);
  border-radius: 10px;
  border: 0.5px solid rgba(60,60,67,0.12);
}
.apl-card-header {
  font-size: 11px; font-weight: 700; color: rgba(60,60,67,0.7);
  text-transform: uppercase; letter-spacing: 0.04em;
}
.apl-card-hint { margin-top: 4px; font-size: 11px; color: rgba(60,60,67,0.6); line-height: 1.45; }
/* ALD 15/06/2026 - toggle xả RAM/VRAM */
.apl-toggle { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-top: 12px; padding: 10px 12px; background: rgba(255,255,255,0.6); border: 0.5px solid rgba(60,60,67,0.14); border-radius: 12px; cursor: pointer; }
.apl-toggle-title { display: block; font-size: 12.5px; font-weight: 700; color: rgba(60,60,67,0.85); }
.apl-toggle-input { flex-shrink: 0; width: 38px; height: 22px; margin-top: 2px; -webkit-appearance: none; appearance: none; background: rgba(60,60,67,0.22); border-radius: 999px; position: relative; cursor: pointer; transition: background 0.18s; }
.apl-toggle-input:checked { background: #34C759; }
.apl-toggle-input::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: white; transition: transform 0.18s; }
.apl-toggle-input:checked::after { transform: translateX(16px); }
</style>
