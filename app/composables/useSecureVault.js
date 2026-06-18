// #region ALD 18/06/2026 - Két mã hoá API key (FE-only, KHÔNG backend).
// Yêu cầu user: "mã hoá an toàn các API key". Cách an toàn nhất cho app chỉ-chạy-trình-duyệt:
//   • Sinh 1 CryptoKey AES-GCM 256-bit, NON-EXTRACTABLE (extractable=false) bằng Web Crypto.
//   • Lưu chính object CryptoKey vào IndexedDB (structured-clone giữ nguyên non-extractable) → raw key
//     KHÔNG BAO GIỜ lộ ra JS, không nằm trong localStorage, không serialize được.
//   • Mọi API key được mã hoá bằng key này (IV ngẫu nhiên mỗi lần) rồi mới ghi vào localStorage/DB.
// Như vậy ngay cả khi đọc được localStorage (vd export JSON) cũng chỉ thấy ciphertext; muốn giải mã phải
// chạy trong đúng trình duyệt này (key bound theo device/origin). Có thể nâng cấp thêm lớp passphrase sau.
//
// Tuỳ chọn passphrase (nâng cao): unlockWithPassphrase() phái sinh key AES từ PBKDF2 thay cho device-key —
// để dành, mặc định dùng device-key cho tiện (không phải nhập gì).

const DB_NAME = 'motions-studio-vault'
const STORE = 'keys'
const KEY_ID = 'device-key-v1'

let _keyPromise = null   // cache Promise<CryptoKey> trong phiên

function _idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function _idbGet(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const r = tx.objectStore(STORE).get(id)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function _idbPut(db, id, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const r = tx.objectStore(STORE).put(val, id)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })
}

// Lấy (hoặc tạo lần đầu) device-key non-extractable.
async function _getDeviceKey() {
  if (_keyPromise) return _keyPromise
  _keyPromise = (async () => {
    const db = await _idb()
    let key = await _idbGet(db, KEY_ID)
    if (!key) {
      key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false /* non-extractable */, ['encrypt', 'decrypt'])
      await _idbPut(db, KEY_ID, key)
    }
    return key
  })()
  return _keyPromise
}

const _enc = new TextEncoder()
const _dec = new TextDecoder()

function _toB64(bytes) {
  let s = ''
  const b = new Uint8Array(bytes)
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s)
}
function _fromB64(b64) {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

// Định dạng ciphertext: "v1.<base64(iv)>.<base64(ct)>" — tự mô tả version + IV để giải mã.
const PREFIX = 'v1.'

export function useSecureVault() {
  const supported = typeof indexedDB !== 'undefined'
    && typeof crypto !== 'undefined' && !!crypto.subtle

  async function encrypt(plaintext) {
    if (!plaintext) return ''
    if (!supported) return plaintext   // fail-open: môi trường không hỗ trợ (SSR) → trả nguyên (FE sẽ mã hoá lại sau)
    const key = await _getDeviceKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, _enc.encode(String(plaintext)))
    return PREFIX + _toB64(iv) + '.' + _toB64(ct)
  }

  async function decrypt(payload) {
    if (!payload) return ''
    if (!isEncrypted(payload)) return payload   // giá trị cũ chưa mã hoá → trả nguyên
    if (!supported) return ''
    try {
      const [, ivB64, ctB64] = payload.split('.')
      const key = await _getDeviceKey()
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _fromB64(ivB64) }, key, _fromB64(ctB64))
      return _dec.decode(pt)
    } catch (e) {
      console.warn('[vault] decrypt fail (key đổi / dữ liệu hỏng):', e)
      return ''
    }
  }

  function isEncrypted(v) {
    return typeof v === 'string' && v.startsWith(PREFIX)
  }

  // Hiển thị an toàn: chỉ lộ 4 ký tự cuối (giá trị đã giải mã) — dùng cho UI "••••abcd".
  function mask(plaintext) {
    const s = String(plaintext || '')
    if (!s) return ''
    return '••••••' + s.slice(-4)
  }

  return { supported, encrypt, decrypt, isEncrypted, mask }
}
// #endregion
