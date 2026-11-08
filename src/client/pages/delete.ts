const button = document.querySelector<HTMLButtonElement>("[data-delete-url]");
if (button) setupDeletion(button);

function setupDeletion(button: HTMLButtonElement) {
  const { deleteUrl, deleteConfirm, deleteSuccess, deleteFailed, deleteRedirect = "/" } = button.dataset;
  if (!deleteUrl || !deleteConfirm || !deleteSuccess || !deleteFailed) return;

  button.addEventListener("click", async () => {
    if (button.disabled || !window.confirm(deleteConfirm)) return;
    button.disabled = true;

    try {
      const response = await fetch(deleteUrl, { method: "DELETE" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      window.alert(deleteSuccess);
      window.location.href = deleteRedirect;
    } catch (error) {
      window.alert(error instanceof Error ? `${deleteFailed}: ${error.message}` : deleteFailed);
    } finally {
      button.disabled = false;
    }
  });
}
