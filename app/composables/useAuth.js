// #region ALD 20/05/2026 - Composable auth: lưu session JWT vào cookie + helper apiFetch
// ALD 30/05/2026 - Thêm refresh token (chuẩn OAuth): access JWT ngắn hạn + refresh
// token dài hạn (dùng chung backend supabase.pebsteel.com với local-ai). apiFetch tự
// đổi refresh→access mới khi gặp 401 rồi RETRY 1 lần → user không bị đá ra sau khi
// access hết hạn (chỉ logout khi refresh cũng hết/bị thu hồi).

// Single-flight refresh: nhiều request 401 cùng lúc chỉ gọi /refresh ĐÚNG 1 lần.
// Dedupe redirect: tránh nhiều navigate khi nhiều request cùng 401 (page fan-out endpoint).
// Cả 2 chỉ chạy client nên module-scope = per-tab, không rò rỉ giữa request SSR khác user.
let _refreshPromise = null
let _expiredRedirecting = false

export function useAuth() {
  const config = useRuntimeConfig()

  // maxAge cookie = tuổi refresh token (30 ngày) để cookie access còn sống trong khi
  // JWT bên trong được xoay liên tục qua /refresh. Nếu maxAge access < refresh thì
  // cookie biến mất sớm → middleware đá về login trước khi kịp refresh.
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 ngày
  const tokenCookie = useCookie('pebsteel_session', {
    sameSite: 'lax',
    secure: false,
    maxAge: COOKIE_MAX_AGE
  })
  const refreshCookie = useCookie('pebsteel_refresh', {
    sameSite: 'lax',
    secure: false,
    maxAge: COOKIE_MAX_AGE
  })
  const userState = useState('auth.user', () => null)

  async function requestOtp(email) {
    return await $fetch('/auth/send-otp', {
      baseURL: config.public.motionBackendUrl,
      method: 'POST',
      body: { email }
    })
  }

  async function verifyOtp(email, code) {
    const res = await $fetch('/auth/verify-otp', {
      baseURL: config.public.motionBackendUrl,
      method: 'POST',
      body: { email, code }
    })
    if (res?.success && res?.token) {
      tokenCookie.value = res.token
      if (res.refreshToken) refreshCookie.value = res.refreshToken
      userState.value = res.user
    }
    return res
  }

  function logout() {
    // ALD 30/05/2026 - Đọc token TRƯỚC khi xoá để còn gửi kèm yêu cầu thu hồi.
    const rt = refreshCookie.value
    const headers = authHeader()
    // Xoá cookie NGAY (UI phản hồi tức thì), không chờ network.
    tokenCookie.value = null
    refreshCookie.value = null
    userState.value = null
    // Thu hồi phiên server-side (best-effort, chạy nền) → refresh token hết hiệu lực
    // ngay thay vì sống tới 30 ngày sau khi đăng xuất.
    if (import.meta.client && rt) {
      $fetch('/auth/logout', {
        baseURL: config.public.motionBackendUrl,
        method: 'POST',
        headers,
        body: { refreshToken: rt }
      }).catch(() => {})
    }
  }

  function authHeader() {
    return tokenCookie.value ? { Authorization: `Bearer ${tokenCookie.value}` } : {}
  }

  // #region ALD 30/05/2026 - Refresh flow
  /** Đổi refresh→access mới (single-flight). true nếu đã cập nhật tokenCookie. */
  function ensureRefreshed() {
    if (!_refreshPromise) {
      _refreshPromise = doRefresh().finally(() => { _refreshPromise = null })
    }
    return _refreshPromise
  }

  async function doRefresh() {
    const rt = refreshCookie.value
    if (!rt) return false
    try {
      const res = await $fetch('/auth/refresh', {
        baseURL: config.public.motionBackendUrl,
        method: 'POST',
        body: { refreshToken: rt }
      })
      if (res?.success && res?.token) {
        tokenCookie.value = res.token
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /** Clear session + đẩy về /login?expired=1 (giữ callbackUrl). */
  function handleExpired() {
    if (!import.meta.client) return
    if (_expiredRedirecting) return
    _expiredRedirecting = true

    tokenCookie.value = null
    refreshCookie.value = null
    userState.value = null

    const router = useRouter()
    const route = useRoute()
    const isOnLogin = route.path === '/login'
    const query = { expired: '1' }
    if (!isOnLogin && route.fullPath && route.fullPath !== '/') {
      query.callbackUrl = route.fullPath
    }
    Promise.resolve(router.push({ path: '/login', query })).finally(() => {
      setTimeout(() => { _expiredRedirecting = false }, 1500)
    })
  }
  // #endregion

  function rawFetch(path, options = {}) {
    return $fetch(path, {
      baseURL: config.public.motionBackendUrl,
      ...options,
      headers: {
        ...authHeader(),
        ...(options.headers ?? {})
      }
    })
  }

  /**
   * Wrapper $fetch với baseURL = supabaseUrl + auto attach Bearer token.
   * Dùng cho mọi endpoint /functions/v1/* yêu cầu session.
   *
   * ALD 30/05/2026 - 401 handling (client): refresh→retry 1 lần; thất bại → logout
   * + redirect /login?expired=1. SSR giữ hành vi cũ (chỉ $fetch, ném lỗi).
   */
  async function apiFetch(path, options = {}) {
    if (!import.meta.client) {
      return await rawFetch(path, options)
    }
    try {
      return await rawFetch(path, options)
    } catch (err) {
      const status = err?.response?.status ?? err?.statusCode
      if (status !== 401) throw err

      const refreshed = await ensureRefreshed()
      if (!refreshed) {
        handleExpired()
        throw err
      }
      try {
        return await rawFetch(path, options)
      } catch (err2) {
        const status2 = err2?.response?.status ?? err2?.statusCode
        if (status2 === 401) handleExpired()
        throw err2
      }
    }
  }

  // #region ALD 31/05/2026 - beFetch: gọi motion-backend trực tiếp (baseURL=motionBackendUrl)
  // + Bearer session (motion-backend chấp nhận token cùng secret qua bridge). Dùng cho
  // workflows/storage/ai-providers (đã port sang motion-backend). 401 → refresh→retry 1 lần.
  function beRawFetch(path, options = {}) {
    return $fetch(path, {
      baseURL: config.public.motionBackendUrl,
      ...options,
      headers: { ...authHeader(), ...(options.headers ?? {}) }
    })
  }
  async function beFetch(path, options = {}) {
    if (!import.meta.client) return await beRawFetch(path, options)
    try {
      return await beRawFetch(path, options)
    } catch (err) {
      const status = err?.response?.status ?? err?.statusCode
      if (status !== 401) throw err
      const refreshed = await ensureRefreshed()
      if (!refreshed) { handleExpired(); throw err }
      try { return await beRawFetch(path, options) }
      catch (err2) { if ((err2?.response?.status ?? err2?.statusCode) === 401) handleExpired(); throw err2 }
    }
  }
  // #endregion

  return {
    user: userState,
    token: tokenCookie,
    isAuthenticated: computed(() => !!tokenCookie.value),
    requestOtp,
    verifyOtp,
    logout,
    authHeader,
    apiFetch,
    beFetch
  }
}
// #endregion
