<template>
  <!-- #region ALD 18/06/2026 - Tab "Dữ liệu": chọn nơi lưu workflow/run. Mặc định localStorage;
       hoặc dán URL Neon (postgres:// qua HTTP) + "Đồng bộ" → tạo bảng + đẩy dữ liệu local lên. -->
  <div class="w-full space-y-3">
    <!-- Trạng thái hiện tại -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="glass shadow-card rounded-2xl p-3 flex items-center gap-3">
        <span :class="cn('inline-flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0', isNeon ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-primary')">
          <i :class="['bi', isNeon ? 'bi-database-fill-check' : 'bi-hdd']" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-bold text-gray-900">{{ isNeon ? 'Database: Neon' : 'Database: localStorage' }}</div>
          <div class="text-[11px] text-gray-500 truncate">{{ isNeon ? 'Đồng bộ Postgres — nhiều máy' : 'Lưu trong trình duyệt này' }}</div>
        </div>
        <button v-if="isNeon" type="button" class="press h-7 px-2.5 rounded-full glass text-[11px] font-semibold text-gray-600 hover:bg-white" @click="onUseLocal">Về local</button>
      </div>
      <div class="glass shadow-card rounded-2xl p-3 flex items-center gap-3">
        <span :class="cn('inline-flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0', fileStore.enabled() ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-50 text-rose-600')">
          <i class="bi bi-images" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-bold text-gray-900">{{ fileStore.enabled() ? 'File: Supabase' : 'File: localStorage' }}</div>
          <div class="text-[11px] text-gray-500 truncate">{{ fileStore.enabled() ? 'Upload Storage' : 'Nhúng data URL' }}</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
      <!-- Cấu hình DB -->
      <section class="glass shadow-card rounded-3xl p-4 space-y-2">
        <h3 class="text-sm font-bold text-gray-900"><i class="bi bi-database me-1.5 text-primary" />Database (workflow) — tuỳ chọn</h3>
        <p class="text-[11.5px] text-gray-500 leading-snug">
          Dán <b>URL Postgres của Neon</b> (SQL-over-HTTP chạy thẳng từ browser). Bấm <b>Đồng bộ</b> để tự tạo bảng + đẩy dữ liệu local lên. Trống = dùng localStorage.
        </p>
        <input v-model="url" type="text" placeholder="postgresql://…neon.tech/neondb?sslmode=require" class="apl-input w-full font-mono text-[12px]" autocomplete="off" spellcheck="false" />
        <div class="flex items-center gap-2 pt-0.5 flex-wrap">
          <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" :disabled="busy || !url" @click="onTest"><i class="bi bi-plug me-1" />Kiểm tra</button>
          <button type="button" class="press h-9 px-5 rounded-full bg-primary text-white text-sm font-semibold shadow-pill hover:bg-primary-dark" :disabled="busy || !url" @click="onSync"><i class="bi bi-arrow-repeat me-1" />{{ busy ? 'Đang…' : 'Đồng bộ' }}</button>
          <span v-if="msg" :class="['text-[12px] font-semibold', msgOk ? 'text-emerald-600' : 'text-rose-600']">{{ msg }}</span>
        </div>
      </section>

      <!-- Lưu trữ FILE (Supabase) -->
      <section class="glass shadow-card rounded-3xl p-4 space-y-2">
        <h3 class="text-sm font-bold text-gray-900"><i class="bi bi-images me-1.5 text-violet-600" />Lưu trữ file — tuỳ chọn</h3>
        <p class="text-[11.5px] text-gray-500 leading-snug">
          Có Supabase → ảnh/video/audio sinh ra upload lên <b>Storage</b>; không → giữ data URL (localStorage). Key <b>mã hoá</b> <i class="bi bi-lock-fill" />.
        </p>
        <div class="grid grid-cols-3 gap-2">
          <input v-model="fs.url" type="text" placeholder="https://xxx.supabase.co" class="apl-input font-mono text-[12px] col-span-2" autocomplete="off" />
          <input v-model="fs.bucket" type="text" placeholder="bucket" class="apl-input text-[13px]" />
        </div>
        <input v-model="fs.key" type="password" :placeholder="fsHasKey ? '•••• (giữ key cũ)' : 'service_role / anon key'" class="apl-input w-full font-mono text-[12px]" autocomplete="off" />
        <div class="flex items-center gap-2 pt-0.5 flex-wrap">
          <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" :disabled="fsBusy" @click="onFsSave">Lưu</button>
          <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" :disabled="fsBusy || !fileStore.enabled()" @click="onFsTest"><i class="bi bi-plug me-1" />Kiểm tra</button>
          <button v-if="fileStore.enabled()" type="button" class="press h-9 px-3 rounded-full text-rose-500 hover:bg-rose-50 text-sm font-semibold" @click="onFsClear">Tắt</button>
          <span v-if="fsMsg" :class="['text-[12px] font-semibold', fsOk ? 'text-emerald-600' : 'text-rose-600']">{{ fsMsg }}</span>
        </div>
      </section>
    </div>

    <p class="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
      <i class="bi bi-info-circle me-1" /> URL/key nằm trong trình duyệt (FE-only). Chỉ dùng dịch vụ nội bộ/được phép. API key + Supabase key được mã hoá; URL Postgres (chứa mật khẩu) thì không — cân nhắc.
    </p>
  </div>
  <!-- #endregion -->
</template>

<script setup>
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
  try {
    await db.testConnection(url.value.trim())
    _set(true, 'Kết nối OK ✓')
  } catch (e) {
    _set(false, 'Lỗi: ' + (e?.message || e))
  } finally { busy.value = false }
}

async function onSync() {
  busy.value = true; _set(false, '')
  try {
    const { pushed } = await db.sync(url.value.trim())
    _set(true, `Đã tạo bảng + đẩy ${pushed} bản ghi. Đang dùng Database.`)
  } catch (e) {
    _set(false, 'Đồng bộ lỗi: ' + (e?.message || e))
  } finally { busy.value = false }
}

function onUseLocal() {
  db.useLocalMode()
  _set(true, 'Đã chuyển về localStorage.')
}

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
    _fsSet(true, fileStore.enabled() ? 'Đã lưu — file mới sẽ lên Supabase.' : 'Đã lưu (thiếu thông tin → vẫn localStorage).')
  } catch (e) { _fsSet(false, 'Lỗi: ' + (e?.message || e)) } finally { fsBusy.value = false }
}
async function onFsTest() {
  fsBusy.value = true; _fsSet(false, '')
  try { await fileStore.testConnection(); _fsSet(true, 'Upload thử OK ✓') }
  catch (e) { _fsSet(false, 'Lỗi: ' + (e?.message || e)) } finally { fsBusy.value = false }
}
function onFsClear() { fileStore.clearConfig(); fs.url = ''; fs.bucket = 'media'; fs.key = ''; _fsSet(true, 'Đã tắt Supabase — quay về localStorage.') }
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
