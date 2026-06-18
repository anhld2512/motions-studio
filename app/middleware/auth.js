export default defineNuxtRouteMiddleware(() => {
  // ALD 18/06/2026 - motions-studio là công cụ FE-only, 1 người dùng cục bộ → KHÔNG bắt đăng nhập backend.
  // Giữ file để page khai báo middleware:'auth' vẫn hợp lệ (no-op).
})
