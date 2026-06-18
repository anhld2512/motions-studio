// #region ALD 18/06/2026 - Đổi ngôn ngữ giao diện (VI ⇄ EN). Dùng @nuxtjs/i18n quản lý locale + cookie + detect.
// useLang() = lớp mỏng trên useI18n: cấp `lang` (ref locale), `setLang`, `toggle`, và helper `t('vi','en')`
// cho các chuỗi nhúng/nhãn động (không cần khai báo key). Catalog JSON theo key có thể thêm sau qua i18n.
// Dùng: const { lang, t, toggle } = useLang(); t('Tạo ảnh', 'Create Image')
export function useLang() {
  const i18n = useI18n()
  const lang = i18n.locale   // WritableComputedRef<'vi'|'en'> do @nuxtjs/i18n cấp (persist cookie ms_lang)

  async function setLang(l) {
    const next = l === 'en' ? 'en' : 'vi'
    if (typeof i18n.setLocale === 'function') await i18n.setLocale(next)
    else lang.value = next
  }
  function toggle() { setLang(lang.value === 'vi' ? 'en' : 'vi') }

  // t(vi, en): chọn chuỗi theo locale hiện tại. Thiếu en → fallback vi.
  const t = (vi, en) => (lang.value === 'en' ? (en ?? vi) : vi)

  return { lang, setLang, toggle, t, load: () => {} }
}
// #endregion
