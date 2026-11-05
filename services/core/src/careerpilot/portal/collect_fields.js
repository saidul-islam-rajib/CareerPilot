() => {
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const labelOf = (el) => {
    const ids = el.getAttribute('aria-labelledby');
    if (ids) return ids.split(' ').map(i => (document.getElementById(i) || {}).innerText || '').join(' ').trim();
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) return l.innerText.trim(); }
    const wrap = el.closest('label'); if (wrap) return wrap.innerText.trim();
    return (el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim();
  };
  const groupLabel = (el) => {
    const set = el.closest('fieldset'); if (set) { const l = set.querySelector('legend'); if (l) return l.innerText.trim(); }
    const p = el.closest('[role=radiogroup],[role=group]'); if (p && p.getAttribute('aria-label')) return p.getAttribute('aria-label');
    const wrap = el.closest('div'); const q = wrap && wrap.parentElement ? wrap.parentElement.querySelector('label,legend,p,span') : null;
    return q ? q.innerText.trim() : '';
  };
  const out = []; const groups = {}; let n = 0;
  document.querySelectorAll('input,select,textarea').forEach((el) => {
    const type = (el.getAttribute('type') || el.tagName).toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) return;
    if (type !== 'file' && !visible(el)) return;
    if (type === 'radio') {
      const key = el.name; if (!groups[key]) { groups[key] = {handle: 'group:' + key, kind: 'radio', label: groupLabel(el), name: key, autocomplete: '', required: el.required, options: [], value: ''}; out.push(groups[key]); }
      groups[key].options.push(labelOf(el)); if (el.checked) groups[key].value = labelOf(el); return;
    }
    n += 1; const handle = 'f' + n; el.setAttribute('data-cp', handle);
    const kind = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : type;
    const options = el.tagName === 'SELECT' ? Array.from(el.options).filter(o => o.value !== '').map(o => o.text.trim()) : [];
    out.push({handle, kind, label: labelOf(el), name: el.name || el.id || '', autocomplete: el.getAttribute('autocomplete') || '', required: el.required || el.getAttribute('aria-required') === 'true', options, value: type === 'checkbox' ? (el.checked ? 'true' : '') : (el.value || '')});
  });
  return out;
}
