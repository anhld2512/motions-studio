<template>
  <!-- #region ALD 18/06/2026 - Tab "Provider" (thay tab "Models AI"). Gắn provider THEO NHÓM NĂNG LỰC.
       Trên: 5 nhóm (text/image/video/speech/transcription) — mỗi nhóm chọn 1 provider + model.
       Dưới: danh sách provider (base URL + API key MÃ HOÁ). Node tự lấy provider theo nhóm. -->
  <div class="space-y-6 max-w-4xl">
    <!-- Cảnh báo môi trường mã hoá -->
    <div v-if="!vaultOk" class="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800">
      <i class="bi bi-shield-exclamation me-1" /> Trình duyệt không hỗ trợ Web Crypto/IndexedDB — API key sẽ KHÔNG được mã hoá. Dùng trình duyệt hiện đại.
    </div>

    <!-- ── Nhóm năng lực (capability bindings) ── -->
    <section>
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-bold text-gray-900">Gắn provider theo nhóm</h3>
        <span class="text-[11px] text-gray-400">Node tự dùng provider của nhóm — khỏi gắn từng node</span>
      </div>
      <div class="space-y-2">
        <div
          v-for="cap in CAPABILITIES"
          :key="cap.id"
          class="glass shadow-card rounded-2xl p-3 flex items-center gap-3"
        >
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-primary flex-shrink-0">
            <i :class="['bi', cap.icon]" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-bold text-gray-900">{{ cap.label }}</div>
            <div class="text-[11px] text-gray-500 truncate">{{ cap.hint }}</div>
          </div>
          <select
            :value="bindings[cap.id]?.providerId || ''"
            class="apl-select h-9 text-sm"
            @change="onBindProvider(cap.id, $event.target.value)"
          >
            <option value="">— chưa gắn —</option>
            <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <input
            :value="bindings[cap.id]?.model || ''"
            type="text"
            placeholder="model (vd gpt-4o)"
            class="apl-input h-9 text-sm w-40"
            :disabled="!bindings[cap.id]?.providerId"
            @change="onBindModel(cap.id, $event.target.value)"
          />
        </div>
      </div>
    </section>

    <!-- ── Danh sách provider ── -->
    <section>
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-bold text-gray-900">Providers</h3>
        <button type="button" class="press inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-white text-xs font-semibold shadow-pill hover:bg-primary-dark" @click="openNew()">
          <i class="bi bi-plus-lg" /> Thêm provider
        </button>
      </div>

      <div v-if="!providers.length" class="text-center text-sm text-gray-400 py-8 glass rounded-2xl">
        Chưa có provider. Bấm “Thêm provider” và dán API key (sẽ được mã hoá).
      </div>

      <div v-else class="space-y-2">
        <div v-for="p in providers" :key="p.id" class="glass shadow-card rounded-2xl p-3 flex items-center gap-3">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 flex-shrink-0">
            <i class="bi bi-plug-fill" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-bold text-gray-900 truncate">{{ p.name }}</div>
            <div class="text-[11px] text-gray-500 truncate">
              {{ kindLabel(p.kind) }} · <code class="font-mono">{{ p.baseUrl || '—' }}</code>
              <span :class="p.apiKeyEnc ? 'text-emerald-600' : 'text-amber-600'">
                · {{ p.apiKeyEnc ? 'key đã mã hoá 🔒' : 'chưa có key' }}
              </span>
            </div>
          </div>
          <button type="button" class="press h-8 px-3 rounded-full glass text-xs font-semibold text-gray-700 hover:bg-white" @click="openEdit(p)">Sửa</button>
          <button type="button" class="press h-8 w-8 rounded-full text-rose-500 hover:bg-rose-50" title="Xoá" @click="onRemove(p)"><i class="bi bi-trash" /></button>
        </div>
      </div>
    </section>

    <!-- ── Editor modal ── -->
    <div v-if="editing" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" @click.self="editing = null">
      <div class="glass shadow-island-lg rounded-3xl w-full max-w-md p-5 space-y-3">
        <h4 class="text-base font-bold text-gray-900">{{ form.id ? 'Sửa provider' : 'Thêm provider' }}</h4>
        <label class="block">
          <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">Tên</span>
          <input v-model="form.name" type="text" placeholder="vd OpenAI prod" class="apl-input w-full mt-1" />
        </label>
        <label class="block">
          <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">Loại</span>
          <select v-model="form.kind" class="apl-select w-full mt-1" @change="onKindChange">
            <option v-for="k in PROVIDER_KINDS" :key="k.id" :value="k.id">{{ k.label }}</option>
          </select>
        </label>
        <label class="block">
          <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">Base URL</span>
          <input v-model="form.baseUrl" type="text" placeholder="https://api.openai.com/v1" class="apl-input w-full mt-1 font-mono text-[13px]" />
        </label>
        <label class="block">
          <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">API key <span class="text-emerald-600">🔒 mã hoá khi lưu</span></span>
          <input
            v-model="form.apiKey"
            type="password"
            :placeholder="form.id && hasExistingKey ? '•••• (giữ key cũ — để trống nếu không đổi)' : 'dán API key'"
            class="apl-input w-full mt-1 font-mono text-[13px]"
            autocomplete="off"
          />
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-600" @click="editing = null">Huỷ</button>
          <button type="button" class="press h-9 px-5 rounded-full bg-primary text-white text-sm font-semibold shadow-pill hover:bg-primary-dark" :disabled="saving" @click="onSave">
            {{ saving ? 'Đang lưu…' : 'Lưu' }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const prov = useProviders()
const { providers, bindings, CAPABILITIES, PROVIDER_KINDS } = prov
prov.load()
const vaultOk = useSecureVault().supported

const editing = ref(null)
const saving = ref(false)
const form = reactive({ id: '', name: '', kind: 'openai', baseUrl: '', apiKey: '' })
const hasExistingKey = ref(false)

function kindLabel(kind) { return PROVIDER_KINDS.find((k) => k.id === kind)?.label || kind }

function openNew() {
  const def = PROVIDER_KINDS[0]
  Object.assign(form, { id: '', name: '', kind: def.id, baseUrl: def.baseUrl, apiKey: '' })
  hasExistingKey.value = false
  editing.value = true
}
function openEdit(p) {
  Object.assign(form, { id: p.id, name: p.name, kind: p.kind, baseUrl: p.baseUrl, apiKey: '' })
  hasExistingKey.value = !!p.apiKeyEnc
  editing.value = true
}
function onKindChange() {
  const def = PROVIDER_KINDS.find((k) => k.id === form.kind)
  if (def && def.baseUrl && !form.baseUrl) form.baseUrl = def.baseUrl
}
async function onSave() {
  saving.value = true
  try {
    // apiKey: chỉ gửi khi user nhập (để trống = giữ key cũ → truyền undefined).
    const plainApiKey = form.apiKey ? form.apiKey : (form.id ? undefined : '')
    await prov.saveProvider({ id: form.id || undefined, name: form.name, kind: form.kind, baseUrl: form.baseUrl, plainApiKey })
    editing.value = null
  } finally {
    saving.value = false
  }
}
function onRemove(p) {
  if (confirm(`Xoá provider "${p.name}"?`)) prov.removeProvider(p.id)
}
function onBindProvider(cap, providerId) { prov.setBinding(cap, providerId, bindings.value[cap]?.model || '') }
function onBindModel(cap, model) {
  const pid = bindings.value[cap]?.providerId
  if (pid) prov.setBinding(cap, pid, model)
}
</script>

<style scoped>
.apl-input, .apl-select {
  border: 1px solid rgba(60,60,67,0.16);
  border-radius: 12px;
  padding: 0 12px;
  height: 38px;
  background: rgba(255,255,255,0.7);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.apl-input:focus, .apl-select:focus { border-color: #007AFF; box-shadow: 0 0 0 3px rgba(0,122,255,0.12); }
.apl-input:disabled { opacity: .5; }
</style>
