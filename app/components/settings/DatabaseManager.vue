<template>
  <!-- #region ALD 18/06/2026 - Tab "Dữ liệu": nơi lưu workflow/run (localStorage|Neon) + nơi lưu FILE output
       (IndexedDB mặc định | Supabase Storage) + trình quản lý file cục bộ. FE-only, 1 màn không cuộn dài. -->
  <div class="w-full space-y-3">
    <!-- Trạng thái: 3 thẻ -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="glass shadow-card rounded-2xl p-3 flex items-center gap-3">
        <span :class="['inline-flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0', isNeon ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-primary']">
          <i :class="['bi', isNeon ? 'bi-database-fill-check' : 'bi-hdd']" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-bold text-gray-900">{{ isNeon ? t('data.dataNeon') : t('data.dataBrowser') }}</div>
          <div class="text-[11px] text-gray-500 truncate">{{ isNeon ? t('data.dataNeonHint') : t('data.dataBrowserHint') }}</div>
        </div>
        <button v-if="isNeon" type="button" class="press h-7 px-2.5 rounded-full glass text-[11px] font-semibold text-gray-600 hover:bg-white" @click="onUseLocal">{{ t('data.backToLocal') }}</button>
      </div>
      <div class="glass shadow-card rounded-2xl p-3 flex items-center gap-3">
        <span :class="['inline-flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0', fileStore.enabled() ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-50 text-violet-600']">
          <i :class="['bi', fileStore.enabled() ? 'bi-cloud-check-fill' : 'bi-images']" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-bold text-gray-900">{{ fileStore.enabled() ? t('data.fileSupabase') : t('data.fileBrowser') }}</div>
          <div class="text-[11px] text-gray-500 truncate">{{ fileStore.enabled() ? t('data.fileSupabaseHint') : t('data.fileBrowserHint') }}</div>
        </div>
      </div>
      <div class="glass shadow-card rounded-2xl p-3 flex items-center gap-3">
        <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 bg-amber-50 text-amber-600"><i class="bi bi-folder2-open" /></span>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-bold text-gray-900">{{ t('data.localFilesCount', { n: usage.count }) }}</div>
          <div class="text-[11px] text-gray-500 truncate">{{ t('data.inIndexedDb', { size: fmtBytes(usage.bytes) }) }}</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
      <!-- Cấu hình DB (Neon) -->
      <section class="glass shadow-card rounded-3xl p-4 space-y-2">
        <h3 class="text-sm font-bold text-gray-900"><i class="bi bi-database me-1.5 text-primary" />{{ t('data.neonTitle') }}</h3>
        <p class="text-[11.5px] text-gray-500 leading-snug">
          {{ t('data.neonHelp') }}
        </p>
        <input v-model="url" type="text" placeholder="postgresql://…neon.tech/neondb?sslmode=require" class="apl-input w-full font-mono text-[12px]" autocomplete="off" spellcheck="false" />
        <div class="flex items-center gap-2 pt-0.5 flex-wrap">
          <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" :disabled="busy || !url" @click="onTest"><i class="bi bi-plug me-1" />{{ t('data.test') }}</button>
          <button type="button" class="press h-9 px-5 rounded-full bg-primary text-white text-sm font-semibold shadow-pill hover:bg-primary-dark" :disabled="busy || !url" @click="onSync"><i class="bi bi-arrow-repeat me-1" />{{ busy ? t('data.syncing') : t('data.sync') }}</button>
          <span v-if="msg" :class="['text-[12px] font-semibold', msgOk ? 'text-emerald-600' : 'text-rose-600']">{{ msg }}</span>
        </div>
      </section>

      <!-- Lưu trữ FILE (Supabase) -->
      <section class="glass shadow-card rounded-3xl p-4 space-y-2">
        <h3 class="text-sm font-bold text-gray-900"><i class="bi bi-cloud-arrow-up me-1.5 text-violet-600" />{{ t('data.fileStoreTitle') }}</h3>
        <p class="text-[11.5px] text-gray-500 leading-snug">
          {{ t('data.fileStoreHelp') }} <i class="bi bi-lock-fill" />.
        </p>
        <div class="grid grid-cols-3 gap-2">
          <input v-model="fs.url" type="text" placeholder="https://xxx.supabase.co" class="apl-input font-mono text-[12px] col-span-2" autocomplete="off" />
          <input v-model="fs.bucket" type="text" placeholder="bucket" class="apl-input text-[13px]" />
        </div>
        <input v-model="fs.key" type="password" :placeholder="fsHasKey ? t('data.keyKeepPlaceholder') : 'service_role / anon key'" class="apl-input w-full font-mono text-[12px]" autocomplete="off" />
        <div class="flex items-center gap-2 pt-0.5 flex-wrap">
          <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" :disabled="fsBusy" @click="onFsSave">{{ t('data.save') }}</button>
          <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" :disabled="fsBusy || !fileStore.enabled()" @click="onFsTest"><i class="bi bi-plug me-1" />{{ t('data.test') }}</button>
          <button v-if="fileStore.enabled()" type="button" class="press h-9 px-3 rounded-full text-rose-500 hover:bg-rose-50 text-sm font-semibold" @click="onFsClear">{{ t('data.turnOff') }}</button>
          <span v-if="fsMsg" :class="['text-[12px] font-semibold', fsOk ? 'text-emerald-600' : 'text-rose-600']">{{ fsMsg }}</span>
        </div>
      </section>
    </div>

    <!-- File output cục bộ (IndexedDB) -->
    <section class="glass shadow-card rounded-3xl p-4">
      <div class="flex items-center gap-2 mb-2.5">
        <h3 class="text-sm font-bold text-gray-900"><i class="bi bi-folder2-open me-1.5 text-amber-600" />{{ t('data.localOutputTitle') }}</h3>
        <span class="text-[11px] text-gray-400">{{ t('data.fileCount', { n: usage.count }) }} · {{ fmtBytes(usage.bytes) }}</span>
        <div class="ml-auto flex items-center gap-2">
          <button type="button" class="press h-8 px-3 rounded-full glass text-[12px] font-semibold text-gray-600 hover:bg-white" @click="refreshFiles"><i class="bi bi-arrow-clockwise me-1" />{{ t('data.reload') }}</button>
          <button type="button" class="press h-8 px-3 rounded-full text-rose-500 hover:bg-rose-50 text-[12px] font-semibold" :disabled="!files.length" @click="onClearAll"><i class="bi bi-trash3 me-1" />{{ t('data.clearAll') }}</button>
        </div>
      </div>
      <p v-if="!files.length" class="text-[12px] text-gray-400 py-6 text-center">{{ t('data.emptyFiles') }}</p>
      <div v-else class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2 max-h-[230px] overflow-auto pr-1">
        <div v-for="f in files" :key="f.id" class="group relative rounded-xl overflow-hidden border border-white/70 bg-gray-50 aspect-square">
          <img v-if="(f.mime||'').startsWith('image/')" :src="fileStore.mediaSrc('idb://' + f.id)" class="w-full h-full object-cover" alt="" loading="lazy" />
          <video v-else-if="(f.mime||'').startsWith('video/')" :src="fileStore.mediaSrc('idb://' + f.id)" class="w-full h-full object-cover" muted />
          <div v-else class="w-full h-full flex items-center justify-center text-gray-400"><i class="bi bi-file-earmark-music text-xl" /></div>
          <button type="button" class="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 transition" :title="t('data.delete')" @click="onDelFile(f.id)"><i class="bi bi-x-lg text-[11px]" /></button>
          <span class="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[9px] px-1 py-0.5 truncate">{{ fmtBytes(f.size) }}</span>
        </div>
      </div>
    </section>

    <p class="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
      <i class="bi bi-info-circle me-1" /> {{ t('data.footerNote') }}
    </p>
  </div>
  <!-- #endregion -->
</template>

<script setup>
const { t } = useI18n()
const db = useLocalDb()
db.load()
const isNeon = computed(() => db.isNeon())
const url = ref(db.cfg.value.url || '')
const busy = ref(false)
const msg = ref('')
const msgOk = ref(false)

function _set(ok, text) { msgOk.value = ok; msg.value = text }

async function onTest() {
  busy.value = true; _set(false, '')
  try { await db.testConnection(url.value.trim()); _set(true, t('data.msgConnectOk')) }
  catch (e) { _set(false, t('data.msgError', { err: (e?.message || e) })) } finally { busy.value = false }
}
async function onSync() {
  busy.value = true; _set(false, '')
  try { const { pushed } = await db.sync(url.value.trim()); _set(true, t('data.msgSynced', { n: pushed })) }
  catch (e) { _set(false, t('data.msgSyncError', { err: (e?.message || e) })) } finally { busy.value = false }
}
function onUseLocal() { db.useLocalMode(); _set(true, t('data.msgSwitchedLocal')) }

// ── Lưu trữ file (Supabase) ──
const fileStore = useFileStore()
fileStore.load()
const fs = reactive({ url: fileStore.cfg.value.url || '', bucket: fileStore.cfg.value.bucket || 'media', key: '' })
const fsHasKey = computed(() => !!fileStore.cfg.value.keyEnc)
const fsBusy = ref(false)
const fsMsg = ref('')
const fsOk = ref(false)
function _fsSet(ok, t) { fsOk.value = ok; fsMsg.value = t }

async function onFsSave() {
  fsBusy.value = true; _fsSet(false, '')
  try {
    await fileStore.saveConfig({ url: fs.url.trim(), bucket: fs.bucket.trim() || 'media', plainKey: fs.key ? fs.key : (fsHasKey.value ? undefined : '') })
    fs.key = ''
    _fsSet(true, fileStore.enabled() ? t('data.fsMsgSaved') : t('data.fsMsgSavedIncomplete'))
  } catch (e) { _fsSet(false, t('data.msgError', { err: (e?.message || e) })) } finally { fsBusy.value = false }
}
async function onFsTest() {
  fsBusy.value = true; _fsSet(false, '')
  try { await fileStore.testConnection(); _fsSet(true, t('data.fsMsgUploadOk')) }
  catch (e) { _fsSet(false, t('data.msgError', { err: (e?.message || e) })) } finally { fsBusy.value = false }
}
function onFsClear() { fileStore.clearConfig(); fs.url = ''; fs.bucket = 'media'; fs.key = ''; _fsSet(true, t('data.fsMsgCleared')) }

// ── File output cục bộ (IndexedDB) ──
const files = ref([])
const usage = ref({ count: 0, bytes: 0 })
async function refreshFiles() {
  files.value = (await fileStore.listLocalFiles()).sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
  usage.value = { count: files.value.length, bytes: files.value.reduce((s, f) => s + (f.size || 0), 0) }
}
async function onDelFile(id) { await fileStore.removeLocalFile(id); await refreshFiles() }
async function onClearAll() { await fileStore.clearLocalFiles(); await refreshFiles() }
function fmtBytes(n) {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`
}
onMounted(refreshFiles)
</script>

<style scoped>
.apl-input {
  border: 1px solid rgba(60,60,67,0.16);
  border-radius: 12px;
  padding: 0 12px;
  height: 40px;
  background: rgba(255,255,255,0.7);
  outline: none;
}
.apl-input:focus { border-color: #007AFF; box-shadow: 0 0 0 3px rgba(0,122,255,0.12); }
</style>
