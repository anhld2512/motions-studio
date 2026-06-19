<template>
  <!-- #region ALD 18/06/2026 - Tab "Provider": gắn AI provider THEO NHÓM năng lực. Dropdown (UiDropdown),
       preset điền sẵn base URL + model, API key mã hoá. Chỉ dùng icon Bootstrap (không emoji). -->
  <div class="w-full space-y-3">
    <div v-if="!vaultOk" class="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-[13px] text-amber-800">
      <i class="bi bi-shield-exclamation me-1" /> {{ t('provider.vaultUnsupported') }}
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
      <!-- ── Nhóm năng lực (capability bindings) ── -->
      <section class="glass shadow-card rounded-3xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-gray-900"><i class="bi bi-diagram-2 me-1.5 text-primary" />{{ t('provider.bindByGroup') }}</h3>
          <span class="hidden sm:inline text-[11px] text-gray-400">{{ t('provider.bindByGroupHint') }}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-2">
          <div v-for="cap in CAPABILITIES" :key="cap.id" class="rounded-2xl bg-white/60 border border-white/70 p-2.5">
            <div class="flex items-center gap-2.5 mb-2">
              <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-primary flex-shrink-0">
                <i :class="['bi text-sm', cap.icon]" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="text-[13px] font-bold text-gray-900 leading-tight">{{ t(`cap.${cap.id}.label`) }}</div>
                <div class="text-[10.5px] text-gray-400 truncate">{{ t(`cap.${cap.id}.hint`) }}</div>
              </div>
            </div>
            <UiDropdown
              :model-value="bindings[cap.id]?.providerId || ''"
              :options="providerOptions"
              icon="bi-plug"
              :placeholder="t('provider.noProviderBound')"
              full-width
              @update:model-value="(v) => onBindProvider(cap.id, v)"
            />
            <!-- Model: dropdown (nhãn thân thiện) + tuỳ chọn tự nhập -->
            <div v-if="bindings[cap.id]?.providerId" class="mt-2">
              <UiDropdown
                :model-value="customModel[cap.id] ? '__custom__' : (bindings[cap.id]?.model || '')"
                :options="modelOptions(cap.id)"
                icon="bi-box" :placeholder="t('provider.selectModel')" full-width no-clear
                @update:model-value="(v) => onPickModel(cap.id, v)"
              />
              <input
                v-if="customModel[cap.id]"
                :value="bindings[cap.id]?.model || ''"
                type="text" :placeholder="t('provider.typeModelId')"
                class="apl-input h-8 text-[12.5px] w-full font-mono mt-1.5"
                @change="onBindModel(cap.id, $event.target.value)"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- ── Danh sách provider (sticky: nút thêm + preset luôn trong tầm mắt) ── -->
      <section class="glass shadow-card rounded-3xl p-4 xl:sticky xl:top-2 xl:self-start">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-bold text-gray-900"><i class="bi bi-plug-fill me-1.5 text-violet-600" />Providers</h3>
          <button type="button" class="press inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-white text-xs font-semibold shadow-pill hover:bg-primary-dark" @click="openNew()">
            <i class="bi bi-plus-lg" /> {{ t('provider.custom') }}
          </button>
        </div>

        <!-- Thêm nhanh: preset điền sẵn base URL + model -->
        <div class="flex flex-wrap gap-1.5 mb-3">
          <button v-for="k in PRESET_KINDS" :key="k.id" type="button"
            class="press inline-flex items-center gap-1.5 h-8 px-3 rounded-full glass border border-white/70 text-[12px] font-semibold text-gray-700 hover:bg-white"
            @click="openNew(k.id)">
            <i :class="['bi', kindIcon(k.id)]" /> {{ k.label }}
          </button>
        </div>

        <div v-if="!providers.length" class="text-center text-[13px] text-gray-400 py-8 rounded-2xl border border-dashed border-gray-200">
          {{ t('provider.emptyState') }}
        </div>

        <div v-else class="space-y-2">
          <div v-for="p in providers" :key="p.id" class="rounded-2xl bg-white/60 border border-white/70 p-2.5 flex items-center gap-2.5">
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600 flex-shrink-0">
              <i :class="['bi', kindIcon(p.kind)]" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-[13px] font-bold text-gray-900 truncate">{{ p.name }}</div>
              <div class="text-[10.5px] text-gray-400 truncate flex items-center gap-1">
                {{ kindLabel(p.kind) }} ·
                <span :class="p.apiKeyEnc ? 'text-emerald-600' : 'text-amber-600'" class="inline-flex items-center gap-0.5">
                  <i :class="['bi', p.apiKeyEnc ? 'bi-lock-fill' : 'bi-unlock']" />{{ p.apiKeyEnc ? t('provider.hasKey') : t('provider.noKey') }}
                </span>
              </div>
            </div>
            <button type="button" class="press h-7 px-2.5 rounded-full glass text-[11px] font-semibold text-gray-700 hover:bg-white" @click="openEdit(p)">{{ t('provider.edit') }}</button>
            <button type="button" class="press h-7 w-7 rounded-full text-rose-500 hover:bg-rose-50 text-sm" :title="t('provider.delete')" @click="onRemove(p)"><i class="bi bi-trash" /></button>
          </div>
        </div>
      </section>
    </div>

    <!-- ── Editor modal ── -->
    <div v-if="editing" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" @click.self="editing = null">
      <div class="glass shadow-island-lg rounded-3xl w-full max-w-md p-5 space-y-3">
        <h4 class="text-base font-bold text-gray-900">{{ form.id ? t('provider.editProvider') : t('provider.addProvider') }}</h4>
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">{{ t('provider.type') }}</span>
          <UiDropdown :model-value="form.kind" :options="kindOptions" icon="bi-grid" full-width no-clear class="mt-1" @update:model-value="onKindChange" />
        </div>
        <label class="block">
          <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">{{ t('provider.name') }}</span>
          <input v-model="form.name" type="text" :placeholder="t('provider.namePlaceholder')" class="apl-input w-full mt-1" />
        </label>
        <label class="block">
          <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">Base URL</span>
          <input v-model="form.baseUrl" type="text" placeholder="https://api.openai.com/v1" class="apl-input w-full mt-1 font-mono text-[13px]" />
        </label>
        <label class="block">
          <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            API key <span class="text-emerald-600 inline-flex items-center gap-0.5"><i class="bi bi-lock-fill" />{{ t('provider.encryptedOnSave') }}</span>
          </span>
          <input v-model="form.apiKey" type="password"
            :placeholder="form.id && hasExistingKey ? t('provider.keyKeepPlaceholder') : t('provider.keyPastePlaceholder')"
            class="apl-input w-full mt-1 font-mono text-[13px]" autocomplete="off" />
        </label>
        <p v-if="presetModelsHint" class="text-[11px] text-gray-400"><i class="bi bi-info-circle me-1" />{{ t('provider.suggestedModels') }}: <code class="font-mono">{{ presetModelsHint }}</code></p>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-600" @click="editing = null">{{ t('provider.cancel') }}</button>
          <button type="button" class="press h-9 px-5 rounded-full bg-primary text-white text-sm font-semibold shadow-pill hover:bg-primary-dark" :disabled="saving" @click="onSave">
            {{ saving ? t('provider.saving') : t('provider.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const { t } = useI18n()
const prov = useProviders()
const { providers, bindings, CAPABILITIES, PROVIDER_KINDS } = prov
prov.load()
const vaultOk = useSecureVault().supported

const editing = ref(null)
const saving = ref(false)
const form = reactive({ id: '', name: '', kind: 'openai', baseUrl: '', apiKey: '' })
const hasExistingKey = ref(false)

const KIND_ICON = { openai: 'bi-chat-dots', anthropic: 'bi-stars', gemini: 'bi-google', elevenlabs: 'bi-soundwave', openrouter: 'bi-diagram-3', groq: 'bi-lightning-charge', xai: 'bi-x-diamond', deepseek: 'bi-water', mistral: 'bi-wind', together: 'bi-collection', fal: 'bi-camera-reels-fill', replicate: 'bi-stack', custom: 'bi-sliders' }
const kindIcon = (k) => KIND_ICON[k] || 'bi-plug'
// Nhãn thân thiện cho 1 số model nổi tiếng (chip hiển thị tên này thay vì id thô).
const MODEL_NOTE = {
  'gemini-2.5-flash-image': 'Nano Banana',
  'gemini-3-pro-image-preview': 'Nano Banana Pro',
  'fal-ai/nano-banana': 'Nano Banana (fal)'
}
const customModel = reactive({})   // capId → đang ở chế độ tự nhập model
function modelOptions(capId) {
  const cur = bindings.value?.[capId]?.model
  const list = modelList(capId)
  const opts = list.map((m) => ({ value: m, label: MODEL_NOTE[m] || m }))
  if (cur && !list.includes(cur)) opts.unshift({ value: cur, label: `${MODEL_NOTE[cur] || cur} ${t('provider.customSuffix')}` })
  opts.push({ value: '__custom__', label: t('provider.customModelOption') })
  return opts
}
function onPickModel(capId, v) {
  if (v === '__custom__') { customModel[capId] = true; return }
  customModel[capId] = false
  onBindModel(capId, v)
}
const kindLabel = (k) => PROVIDER_KINDS.find((x) => x.id === k)?.label || k

const PRESET_KINDS = PROVIDER_KINDS.filter((k) => k.id !== 'custom')
const kindOptions = PROVIDER_KINDS.map((k) => ({ value: k.id, label: k.label }))

// Dropdown options
const providerOptions = computed(() => [{ value: '', label: t('provider.unbound') }, ...providers.value.map((p) => ({ value: p.id, label: p.name }))])
function modelList(capId) {
  const pid = bindings.value[capId]?.providerId
  const p = providers.value.find((x) => x.id === pid)
  if (!p) return []
  const list = [...prov.suggestedModels(p.kind, capId)]
  const cur = bindings.value[capId]?.model
  if (cur && !list.includes(cur)) list.unshift(cur)   // giữ model tự gõ đang chọn
  return list
}

const presetModelsHint = computed(() => {
  const m = PROVIDER_KINDS.find((k) => k.id === form.kind)?.models || {}
  return Object.values(m).flat().slice(0, 5).join(', ')
})

function openNew(kindId) {
  const def = PROVIDER_KINDS.find((k) => k.id === kindId) || PROVIDER_KINDS[0]
  Object.assign(form, { id: '', name: def.label, kind: def.id, baseUrl: def.baseUrl, apiKey: '' })
  hasExistingKey.value = false
  editing.value = true
}
function openEdit(p) {
  Object.assign(form, { id: p.id, name: p.name, kind: p.kind, baseUrl: p.baseUrl, apiKey: '' })
  hasExistingKey.value = !!p.apiKeyEnc
  editing.value = true
}
function onKindChange(kindId) {
  form.kind = kindId
  const def = PROVIDER_KINDS.find((k) => k.id === kindId)
  if (def) { form.baseUrl = def.baseUrl || form.baseUrl; if (!form.id) form.name = def.label }
}
async function onSave() {
  saving.value = true
  try {
    const plainApiKey = form.apiKey ? form.apiKey : (form.id ? undefined : '')
    await prov.saveProvider({ id: form.id || undefined, name: form.name, kind: form.kind, baseUrl: form.baseUrl, plainApiKey })
    editing.value = null
  } finally {
    saving.value = false
  }
}
function onRemove(p) {
  if (confirm(t('provider.confirmDelete', { name: p.name }))) prov.removeProvider(p.id)
}
// Gắn provider cho nhóm → tự điền model mặc định (model đầu trong preset của provider cho nhóm đó).
function onBindProvider(cap, providerId) {
  const p = providers.value.find((x) => x.id === providerId)
  const model = p ? (p.models?.[cap] || prov.suggestedModels(p.kind, cap)[0] || '') : ''
  prov.setBinding(cap, providerId, model)
}
function onBindModel(cap, model) {
  const pid = bindings.value[cap]?.providerId
  if (pid) prov.setBinding(cap, pid, model)
}
</script>

<style scoped>
.apl-input {
  border: 1px solid rgba(60,60,67,0.16);
  border-radius: 12px;
  padding: 0 12px;
  height: 38px;
  background: rgba(255,255,255,0.7);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.apl-input:focus { border-color: #007AFF; box-shadow: 0 0 0 3px rgba(0,122,255,0.12); }
.apl-mchip { padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; background: white; border: 1px solid rgba(60,60,67,0.16); color: #3c3c43; cursor: pointer; transition: all .12s; }
.apl-mchip:hover { border-color: #007AFF; color: #007AFF; }
.apl-mchip.is-active { background: #2563eb; color: white; border-color: #2563eb; }
</style>
