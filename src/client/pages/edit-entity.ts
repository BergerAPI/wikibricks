import { validateRelationPickers } from "../relation-picker";
import type { EditEntityRequest, EntityFieldValues } from "../../shared/contracts";

const page = document.querySelector<HTMLElement>("[data-edit-url]");
if (page) setupEdit(page);

function setupEdit(page: HTMLElement) {
  const { editUrl, historyUrl, baseVersionId } = page.dataset;
  const save = page.querySelector<HTMLButtonElement>("#save");
  const message = page.querySelector<HTMLInputElement>("#change_message");
  const description = page.querySelector<HTMLElement>("[data-edit-description]");
  if (!editUrl || !historyUrl || !baseVersionId || !save || !message || !description) return;

  const valueOf = (element: HTMLElement) =>
    element instanceof HTMLInputElement || element instanceof HTMLSelectElement
      ? element.value
      : element.innerText;

  // Only changed values are sent, so remember what each field started with
  const fields = Array.from(page.querySelectorAll<HTMLElement>("[data-edit-field]"), (element) => ({
    element,
    initialValue: valueOf(element),
  }));
  const initialDescription = valueOf(description);

  save.addEventListener("click", async () => {
    if (!validateRelationPickers(page)) return;
    save.disabled = true;

    const changes: EntityFieldValues = {};
    for (const { element, initialValue } of fields) {
      if (valueOf(element) !== initialValue) changes[element.dataset.editField!] = valueOf(element);
    }

    const request: EditEntityRequest = {
      fields: changes,
      baseVersionId: Number(baseVersionId),
      changeMessage: message.value,
    };
    if (valueOf(description) !== initialDescription) request.description = valueOf(description);

    try {
      const response = await fetch(editUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error((await response.text()) || `Edit failed (${response.status})`);
      window.location.href = historyUrl;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Edit failed");
    } finally {
      save.disabled = false;
    }
  });
}
