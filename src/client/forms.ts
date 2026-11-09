export function validateForm(root: ParentNode) {
  for (const input of root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
    if (!input.disabled && input.getClientRects().length && !input.reportValidity()) return false;
  }
  return true;
}
