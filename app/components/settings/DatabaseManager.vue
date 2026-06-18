<template>
  <!-- #region ALD 18/06/2026 - Tab "Dữ liệu": chọn nơi lưu workflow/run. Mặc định localStorage;
       hoặc dán URL Neon (postgres:// qua HTTP) + "Đồng bộ" → tạo bảng + đẩy dữ liệu local lên. -->
  <div class="space-y-5 max-w-2xl">
    <!-- Trạng thái hiện tại -->
    <div class="glass shadow-card rounded-2xl p-4 flex items-center gap-3">
      <span :class="cn('inline-flex h-10 w-10 items-center justify-center rounded-2xl flex-shrink-0', isNeon ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-primary')">
        <i :class="['bi', isNeon ? 'bi-database-fill-check' : 'bi-hdd']" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-bold text-gray-900">{{ isNeon ? 'Đang dùng Database (Neon)' : 'Đang lưu cục bộ (localStorage)' }}</div>
        <div class="text-[11px] text-gray-500 truncate">
          {{ isNeon ? 'Dữ liệu đồng bộ trên Postgres — chạy được nhiều máy.' : 'Dữ liệu nằm trong trình duyệt này. Đồng bộ DB để dùng nhiều máy.' }}
        </div>
      </div>
      <button v-if="isNeon" type="button" class="press h-8 px-3 rounded-full glass text-xs font-semibold text-gray-600 hover:bg-white" @click="onUseLocal">Về localStorage</button>
    </div>

    <!-- Cấu hình DB -->
    <section class="space-y-2">
      <h3 class="text-sm font-bold text-gray-900">Kết nối Database (tuỳ chọn)</h3>
      <p class="text-[12px] text-gray-500">
        Dán <b>URL Postgres của Neon</b> (vd <code class="font-mono">postgresql://user:pass@ep-xxx.neon.tech/db</code>). Trình duyệt không kết nối được Postgres thường — Neon hỗ trợ SQL-over-HTTP nên chạy thẳng từ đây. Bấm <b>Đồng bộ</b> để tự tạo bảng trong DB rỗng và đẩy dữ liệu hiện có lên.
      </p>
      <input
        v-model="url"
        type="text"
        placeholder="postgresql://…neon.tech/neondb?sslmode=require"
        class="apl-input w-full font-mono text-[13px]"
        autocomplete="off" spellcheck="false"
      />
      <div class="flex items-center gap-2 pt-1">
        <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" :disabled="busy || !url" @click="onTest">
          <i class="bi bi-plug me-1" /> Kiểm tra
        </button>
        <button type="button" class="press h-9 px-5 rounded-full bg-primary text-white text-sm font-semibold shadow-pill hover:bg-primary-dark" :disabled="busy || !url" @click="onSync">
          <i class="bi bi-arrow-repeat me-1" /> {{ busy ? 'Đang…' : 'Đồng bộ' }}
        </button>
        <span v-if="msg" :class="['text-[12px] font-semibold', msgOk ? 'text-emerald-600' : 'text-rose-600']">{{ msg }}</span>
      </div>
    </section>

    <!-- ── Lưu trữ FILE (Supabase) ── -->
    <section class="space-y-2 pt-2 border-t border-gray-100">
      <h3 class="text-sm font-bold text-gray-900">Lưu trữ file (tuỳ chọn)</h3>
      <p class="text-[12px] text-gray-500">
        TÔN CHỈ: <b>có cấu hình Supabase</b> → ảnh/video/audio do workflow sinh ra được upload lên <b>Supabase Storage</b>;
        <b>không có</b> → giữ thẳng trong trình duyệt (data URL trong localStorage). Key Supabase được <b>mã hoá</b> 🔒.
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input v-model="fs.url" type="text" placeholder="https://xxx.supabase.co" class="apl-input font-mono text-[12px] sm:col-span-2" autocomplete="off" />
        <input v-model="fs.bucket" type="text" placeholder="bucket (vd media)" class="apl-input text-[13px]" />
      </div>
      <input v-model="fs.key" type="password" :placeholder="fsHasKey ? '•••• (giữ key cũ — để trống nếu không đổi)' : 'service_role / anon key'" class="apl-input w-full font-mono text-[12px]" autocomplete="off" />
      <div class="flex items-center gap-2 pt-1">
        <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" :disabled="fsBusy" @click="onFsSave">Lưu</button>
        <button type="button" class="press h-9 px-4 rounded-full glass text-sm font-semibold text-gray-700 hover:bg-white" :disabled="fsBusy || !fileStore.enabled()" @click="onFsTest"><i class="bi bi-plug me-1" />Kiểm tra</button>
        <button v-if="fileStore.enabled()" type="button" class="press h-9 px-3 rounded-full text-rose-500 hover:bg-rose-50 text-sm font-semibold" @click="onFsClear">Tắt</button>
        <span v-if="fsMsg" :class="['text-[12px] font-semibold', fsOk ? 'text-emerald-600' : 'text-rose-600']">{{ fsMsg }}</span>
      </div>
    </section>

    <p class="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
      <i class="bi bi-info-circle me-1" /> URL/key nằm trong trình duyệt (FE-only). Chỉ dùng dịch vụ nội bộ/được phép. API key provider + Supabase key luôn được mã hoá; URL Postgres (chứa mật khẩu) thì không — cân nhắc.
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
