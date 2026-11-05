(el) => {
  const wrapped = el.closest('label');
  if (wrapped) return wrapped.innerText;
  const linked = document.querySelector('label[for="' + el.id + '"]');
  return linked ? linked.innerText : '';
}
