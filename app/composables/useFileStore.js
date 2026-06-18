// #region ALD 18/06/2026 - Lưu FILE (ảnh/video/audio do node sinh ra + upload). FE-only, KHÔNG backend riêng.
// TÔN CHỈ (theo yêu cầu user):
//   • CÓ cấu hình Supabase  → upload lên Supabase Storage, trả public URL (bền, share được).
//   • KHÔNG có Supabase     → lưu blob vào IndexedDB (không phình localStorage như data: URL), trả ref "idb://<id>".
// Vì sao IndexedDB: localStorage ~5-10MB → 1 ảnh/video base64 là tràn quota → run kẹt "running". IDB chứa hàng trăm MB.
// Hiển thị: dùng mediaSrc(url) — idb:// → tạo object URL (cache reactive), http/data → giữ nguyên.
// Key Supabase MÃ HOÁ qua [[useSecureVault]].

const CFG_KEY = 'ms.filestore.v1'   // { url, bucket, keyEnc }
const IDB_NAME = 'ms-media'
const IDB_STORE = 'files'
const IDB_META = 'meta'
let _idbP = null
const _loading = new Set()   // id đang nạp object URL (tránh nạp trùng)

function _openIdb() {
  if (_idbP) return _idbP
  _idbP = new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, 1)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
      if (!db.objectStoreNames.contains(IDB_META)) db.createObjectStore(IDB_META)
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  return _idbP
}
async function _idbPut(id, blob, meta) {
  const db = await _openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_STORE, IDB_META], 'readwrite')
    tx.objectStore(IDB_STORE).put(blob, id)
    tx.objectStore(IDB_META).put(meta, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function _idbGet(id) {
  const db = await _openIdb()
  return new Promise((resolve, reject) => {
    const rq = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(id)
    rq.onsuccess = () => resolve(rq.result || null)
    rq.onerror = () => reject(rq.error)
  })
}
async function _idbDel(id) {
  const db = await _openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_STORE, IDB_META], 'readwrite')
    tx.objectStore(IDB_STORE).delete(id)
    tx.objectStore(IDB_META).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function _idbListMeta() {
  const db = await _openIdb()
  return new Promise((resolve, reject) => {
    const store = db.transaction(IDB_META, 'readonly').objectStore(IDB_META)
    const out = []
    const rq = store.openCursor()
    rq.onsuccess = () => {
      const cur = rq.result
      if (cur) { out.push({ id: cur.key, ...(cur.value || {}) }); cur.continue() }
      else resolve(out)
    }
    rq.onerror = () => reject(rq.error)
  })
}
async function _idbClear() {
  const db = await _openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_STORE, IDB_META], 'readwrite')
    tx.objectStore(IDB_STORE).clear()
    tx.objectStore(IDB_META).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function useFileStore() {
  const vault = useSecureVault()
  const cfg = useState('ms-filestore', () => ({ url: '', bucket: 'media', keyEnc: '' }))
  const loaded = useState('ms-filestore-loaded', () => false)
  const objCache = useState('ms-media-objurls', () => ({}))   // idb id → object URL (reactive)

  function load() {
    if (loaded.value || !import.meta.client) return
    try { cfg.value = { url: '', bucket: 'media', keyEnc: '', ...(JSON.parse(localStorage.getItem(CFG_KEY) || '{}')) } } catch {}
    loaded.value = true
  }
  function _save() { if (import.meta.client) localStorage.setItem(CFG_KEY, JSON.stringify(cfg.value)) }

  const enabled = () => { load(); return !!(cfg.value.url && cfg.value.bucket && cfg.value.keyEnc) }

  async function saveConfig({ url, bucket, plainKey }) {
    load()
    const next = { ...cfg.value, url: (url ?? cfg.value.url).replace(/\/$/, ''), bucket: bucket ?? cfg.value.bucket }
    if (plainKey !== undefined) next.keyEnc = plainKey ? await vault.encrypt(plainKey) : ''
    cfg.value = next
    _save()
  }
  function clearConfig() { load(); cfg.value = { url: '', bucket: 'media', keyEnc: '' }; _save() }

  function _ext(mime) {
    return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' })[mime] || 'bin'
  }
  async function _toBlob(u) { const r = await fetch(u); return await r.blob() }
  function _rand() { return Math.random().toString(36).slice(2, 10) }

  // Đưa 1 media (data: URL / blob: / URL ngoài) về 1 ref bền vững:
  //   • Có Supabase → upload → public URL.
  //   • data:/blob: + KHÔNG Supabase → IndexedDB → "idb://<id>".
  //   • URL http(s) ngoài → giữ nguyên (đã nhẹ, không cần lưu).
  async function putFile(srcUrl, opts = {}) {
    if (!srcUrl || typeof srcUrl !== 'string') return srcUrl
    load()
    const isLocalBlob = srcUrl.startsWith('data:') || srcUrl.startsWith('blob:')
    if (enabled() && isLocalBlob) {
      const blob = await _toBlob(srcUrl)
      const mime = opts.contentType || blob.type || 'application/octet-stream'
      const path = `${opts.prefix || 'out'}/${_rand()}${_rand()}.${_ext(mime)}`
      const key = await vault.decrypt(cfg.value.keyEnc)
      const res = await fetch(`${cfg.value.url}/storage/v1/object/${cfg.value.bucket}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': mime, 'x-upsert': 'true' },
        body: blob
      })
      if (!res.ok) throw new Error(`Supabase upload ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return `${cfg.value.url}/storage/v1/object/public/${cfg.value.bucket}/${path}`
    }
    if (isLocalBlob) {
      // FE-only: blob → IndexedDB, trả ref nhẹ.
      try {
        const blob = await _toBlob(srcUrl)
        const mime = opts.contentType || blob.type || 'application/octet-stream'
        const id = `${opts.prefix || 'out'}-${Date.now()}-${_rand()}`
        await _idbPut(id, blob, { mime, prefix: opts.prefix || 'out', size: blob.size, at: new Date().toISOString() })
        return `idb://${id}`
      } catch { return srcUrl }   // fallback hiếm: giữ nguyên (vẫn hiển thị được)
    }
    return srcUrl   // URL ngoài → giữ nguyên
  }

  // Resolver REACTIVE cho template: idb:// → object URL (nạp async, cache); còn lại trả nguyên.
  function mediaSrc(url) {
    if (!url || typeof url !== 'string') return url || ''
    if (!url.startsWith('idb://')) return url
    const id = url.slice(6)
    const cached = objCache.value[id]
    if (cached) return cached
    if (import.meta.client && !_loading.has(id)) {
      _loading.add(id)
      _idbGet(id).then((blob) => {
        if (blob) objCache.value = { ...objCache.value, [id]: URL.createObjectURL(blob) }
      }).finally(() => _loading.delete(id))
    }
    return ''   // lần đầu trả rỗng; khi nạp xong objCache đổi → template re-render.
  }

  // Chuyển ref về dạng provider GỬI ĐƯỢC: idb:// → data URL base64; http/https/data: giữ nguyên.
  // (Provider đám mây không fetch được idb://, phải nhúng base64 hoặc URL công khai.)
  async function toSendable(url) {
    if (!url || typeof url !== 'string') return url
    if (!url.startsWith('idb://')) return url
    if (!import.meta.client) return url
    const blob = await _idbGet(url.slice(6))
    if (!blob) return url
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => res(url); r.readAsDataURL(blob) })
  }

  // Quản lý file cục bộ (cho trang/section "Lưu trữ").
  async function listLocalFiles() { return import.meta.client ? await _idbListMeta() : [] }
  async function removeLocalFile(id) { if (import.meta.client) await _idbDel(id) }
  async function clearLocalFiles() { if (import.meta.client) { await _idbClear(); objCache.value = {} } }
  async function localUsage() {
    const rows = await listLocalFiles()
    return { count: rows.length, bytes: rows.reduce((s, r) => s + (r.size || 0), 0) }
  }

  async function testConnection() {
    load()
    const key = await vault.decrypt(cfg.value.keyEnc)
    const path = `__test/${_rand()}.txt`
    const up = await fetch(`${cfg.value.url}/storage/v1/object/${cfg.value.bucket}/${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'text/plain' }, body: 'ok'
    })
    if (!up.ok) throw new Error(`${up.status}: ${(await up.text()).slice(0, 160)}`)
    fetch(`${cfg.value.url}/storage/v1/object/${cfg.value.bucket}/${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}`, apikey: key } }).catch(() => {})
    return true
  }

  return { cfg, load, enabled, saveConfig, clearConfig, putFile, mediaSrc, toSendable, testConnection, mask: vault.mask,
           listLocalFiles, removeLocalFile, clearLocalFiles, localUsage }
}
// #endregion
