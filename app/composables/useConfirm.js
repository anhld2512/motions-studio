// #region ALD 20/05/2026 - Modal confirm chung (singleton). Trả Promise<boolean>.
// Cách dùng:
//   const confirm = useConfirm()
//   const ok = await confirm.ask({
//     title: 'Xoá hội thoại?',
//     message: 'Hành động không thể hoàn tác.',
//     confirmText: 'Xoá',
//     variant: 'danger'   // 'primary' | 'danger'
//   })
//   if (ok) { ... }
// Modal mount 1 lần ở app.vue qua <UiConfirm />.
export function useConfirm() {
  const state = useState('confirm.state', () => ({
    open: false,
    title: '',
    message: '',
    confirmText: 'Xác nhận',
    cancelText: 'Huỷ',
    variant: 'primary',  // 'primary' | 'danger'
    resolver: null
  }))

  function ask(opts = {}) {
    return new Promise((resolve) => {
      state.value = {
        open: true,
        title: opts.title || 'Xác nhận',
        message: opts.message || '',
        confirmText: opts.confirmText || 'Xác nhận',
        cancelText: opts.cancelText || 'Huỷ',
        variant: opts.variant || 'primary',
        resolver: resolve
      }
    })
  }

  function _resolve(value) {
    state.value.resolver?.(value)
    state.value = { ...state.value, open: false, resolver: null }
  }

  function accept() { _resolve(true) }
  function reject() { _resolve(false) }

  return { state, ask, accept, reject }
}
// #endregion
