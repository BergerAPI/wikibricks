import { request } from "../http";

export default function initialize(root: HTMLElement) {
  for (const button of root.querySelectorAll<HTMLButtonElement>(
    "[data-delete-url]",
  ))
    setupDeletion(button);
}

function setupDeletion(button: HTMLButtonElement) {
  const {
    deleteUrl,
    deleteConfirm,
    deleteSuccess,
    deleteFailed,
    deleteRedirect = "/",
  } = button.dataset;
  if (!deleteUrl || !deleteConfirm || !deleteSuccess || !deleteFailed) return;

  button.addEventListener("click", async () => {
    if (button.disabled || !window.confirm(deleteConfirm)) return;
    button.disabled = true;

    try {
      await request(deleteUrl, { method: "DELETE" });
      window.alert(deleteSuccess);
      window.location.href = deleteRedirect;
    } catch (error) {
      window.alert(
        error instanceof Error
          ? `${deleteFailed}: ${error.message}`
          : deleteFailed,
      );
    } finally {
      button.disabled = false;
    }
  });
}
