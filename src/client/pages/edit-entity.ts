import { validateForm, waitForEditors } from "../forms";
import { sendJson } from "../http";
import type { EditEntityRequest, EntityFieldValues } from "../../shared/contracts";

export default function initialize(root: HTMLElement) {
  const page = root.querySelector<HTMLElement>("[data-edit-url]");
  if (!page) return;
  const { editUrl, historyUrl, baseVersionId } = page.dataset;
  const save = page.querySelector<HTMLButtonElement>("#save");
  const message = page.querySelector<HTMLInputElement>("#change_message");
  const description = page.querySelector<HTMLInputElement>('[name="description"]');
  if (!editUrl || !historyUrl || !baseVersionId || !save || !message || !description) return;

  // Only changed values are sent, so remember what each field started with
  const fields = Array.from(page.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-edit-field]"), (element) => ({
    element,
    initialValue: element.value,
  }));
  const initialDescription = description.value;
  const stopWaiting = waitForEditors(page, save);

  save.addEventListener("click", async () => {
    if (!validateForm(page)) return;
    save.disabled = true;

    const changes: EntityFieldValues = {};
    for (const { element, initialValue } of fields) {
      if (element.value !== initialValue) changes[element.dataset.editField!] = element.value;
    }

    const request: EditEntityRequest = {
      fields: changes,
      baseVersionId: Number(baseVersionId),
      changeMessage: message.value,
    };
    if (description.value !== initialDescription) request.description = description.value;

    try {
      await sendJson(editUrl, request);
      window.location.href = historyUrl;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Edit failed");
    } finally {
      save.disabled = false;
    }
  });

  return stopWaiting;
}
