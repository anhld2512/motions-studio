// #region ALD 18/06/2026 - Lưu FILE (ảnh/video/audio do node sinh ra + upload).
// TÔN CHỈ (theo yêu cầu user): NẾU có cấu hình kết nối Supabase → upload file lên Supabase Storage,
// KHÔNG có → giữ nguyên data: URL (nhúng thẳng, tức là nằm trong localStorage cùng workflow/run).
// Gọi Storage REST trực tiếp (không cần thêm @supabase/supabase-js): POST {url}/storage/v1/object/{bucket}/{path}.
// Key Supabase được MÃ HOÁ qua [[useSecureVault]] giống API key provider.

const CFG_KEY = 'ms.filestore.v1'   // { url, bucket, keyEnc }

export function useFileStore() {
  const vault = useSecureVault()
  const cfg = useState('ms-filestore', () => ({ url: '', bucket: 'media', keyEnc: '' }))
  const loaded = useState('ms-filestore-loaded', () => false)

  function load() {
    if (loaded.value || !import.meta.client) return
    try { cfg.value = { url: '', bucket: 'media', keyEnc: '', ...(JSON.parse(localStorage.getItem(CFG_KEY) || '{}')) } } catch {}
    loaded.value = true
  }
  function _save() { if (import.meta.client) localStorage.setItem(CFG_KEY, JSON.stringify(cfg.value)) }

  const enabled = () => { load(); return !!(cfg.value.url && cfg.value.bucket && cfg.value.keyEnc) }

  // Lưu config (key plaintext → mã hoá). plainKey undefined = giữ key cũ.
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

  // Đưa 1 media (data: URL hoặc URL) về 1 URL bền vững.
  //   • Có Supabase  → upload → trả public URL.
  //   • Không        → nếu là data: URL thì giữ nguyên (đã ở localStorage); nếu URL ngoài cũng giữ nguyên.
  async function putFile(srcUrl, opts = {}) {
    if (!srcUrl) return srcUrl
    load()
    if (!enabled()) return srcUrl   // localStorage mode: data: URL nhúng thẳng
    const blob = await _toBlob(srcUrl)
    const mime = opts.contentType || blob.type || 'application/octet-stream'
    const path = `${opts.prefix || 'out'}/${_rand()}-${Date.now ? '' : ''}${_rand()}.${_ext(mime)}`
    const key = await vault.decrypt(cfg.value.keyEnc)
    const res = await fetch(`${cfg.value.url}/storage/v1/object/${cfg.value.bucket}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': mime, 'x-upsert': 'true' },
      body: blob
    })
    if (!res.ok) throw new Error(`Supabase upload ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return `${cfg.value.url}/storage/v1/object/public/${cfg.value.bucket}/${path}`
  }

  // Test: thử upload 1 file nhỏ rồi xoá.
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

  return { cfg, load, enabled, saveConfig, clearConfig, putFile, testConnection, mask: vault.mask }
}
// #endregion
