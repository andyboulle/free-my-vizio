export function createPowerDialog({onConfirm} = {}) {
  const dialog = document.querySelector('#confirm-dialog');
  if (!dialog) return {open: () => {}, close: () => {}, isOpen: () => false};
  const cancel = dialog.querySelector('[data-dialog-cancel]');
  const confirm = dialog.querySelector('[data-dialog-confirm]');
  let open = false;
  let previousFocus;
  const close = () => {
    open = false;
    dialog.hidden = true;
    document.querySelector('#app')?.removeAttribute('aria-hidden');
    previousFocus?.focus?.();
  };
  const keydown = event => {
    if (!open) return;
    if (event.key === 'Backspace' || event.keyCode === 8 || event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close(); return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); event.stopPropagation();
      (document.activeElement === cancel ? confirm : cancel)?.focus();
    } else if (event.key === 'Tab') {
      event.preventDefault(); event.stopPropagation();
      (document.activeElement === cancel ? confirm : cancel)?.focus();
    } else if (event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation();
      if (document.activeElement === confirm) { close(); onConfirm?.(); } else close();
    }
  };
  const openDialog = () => {
    open = true;
    previousFocus = document.activeElement;
    dialog.hidden = false;
    document.querySelector('#app')?.setAttribute('aria-hidden', 'true');
    cancel?.focus();
  };
  cancel?.addEventListener('click', close);
  confirm?.addEventListener('click', () => { close(); onConfirm?.(); });
  document.addEventListener('keydown', keydown, true);
  return {open: openDialog, close, isOpen: () => open};
}
