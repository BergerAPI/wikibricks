type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Shows the browser's message for the first invalid visible control. Hidden ones belong to another tab.
 */
export function validateForm(root: ParentNode) {
  for (const control of root.querySelectorAll<FormControl>("input, select, textarea")) {
    if (control.getClientRects().length && !control.reportValidity()) return false;
  }
  return true;
}

/**
 * Keeps the button disabled until every rich-text editor has loaded, as only then their values are complete.
 */
export function waitForEditors(root: HTMLElement, button: HTMLButtonElement) {
  const update = () => {
    button.disabled = !!root.querySelector('[data-rich-text-editor]:not([data-editor-ready="true"])');
  };
  root.addEventListener("rich-text:ready", update);
  update();
}
