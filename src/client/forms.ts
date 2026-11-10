export function validateForm(root: ParentNode) {
  for (const input of root.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("input, select, textarea")) {
    if (
      !input.disabled &&
      input.getClientRects().length &&
      !input.reportValidity()
    )
      return false;
  }
  return true;
}

export function waitForEditors(root: HTMLElement, button: HTMLButtonElement) {
  const update = () => {
    button.disabled = !!root.querySelector(
      '[data-rich-text-editor]:not([data-editor-ready="true"])',
    );
  };
  root.addEventListener("rich-text:ready", update);
  update();
  return () => root.removeEventListener("rich-text:ready", update);
}
