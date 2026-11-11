import { validateForm, waitForEditors } from "../forms";
import { request, sendJson } from "../http";
import type {
  CreateEntityRequest,
  CreateEntityResponse,
  EntityFieldValues,
  UploadImageResponse,
} from "../../shared/contracts";

export default function initialize(root: HTMLElement) {
  const page = root.querySelector<HTMLElement>("[data-create-url]");
  if (!page) return;
  const { createUrl, uploadUrl } = page.dataset;
  const fileInput = page.querySelector<HTMLInputElement>("#image_file");
  const submitButton = page.querySelector<HTMLButtonElement>("#submit_button");
  const typeSelect = page.querySelector<HTMLSelectElement>("#entity_type");
  const errorBox = page.querySelector<HTMLElement>("#error");
  if (!createUrl || !uploadUrl || !fileInput || !submitButton || !typeSelect || !errorBox) return;
  waitForEditors(page, submitButton);

  // Keeps an uploaded image across retries, until a different file is picked
  let imageId: number | null = null;
  fileInput.addEventListener("change", () => (imageId = null));

  typeSelect.addEventListener("change", () => {
    for (const panel of page.querySelectorAll(".tab-content")) {
      panel.classList.toggle("hidden", panel.id !== `tab-${typeSelect.value}`);
    }
  });

  const valueOf = (name: string) =>
    page.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value ?? "";

  const collectRequest = (): CreateEntityRequest => {
    const entityType = typeSelect.value;

    // Every input in the tab of the selected type is one of its fields
    const fields: EntityFieldValues = {};
    for (const input of page.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      `#tab-${entityType} [name]`,
    )) {
      fields[input.name] = input.value;
    }

    return {
      entity_type: entityType,
      name: valueOf("name"),
      description: valueOf("description"),
      image_id: imageId,
      fields,
    };
  };

  async function uploadImage(file: File) {
    const body = new FormData();
    body.append("file", file);
    const response = await request(uploadUrl!, { method: "POST", body });
    const { id } = await response.json() as UploadImageResponse;
    return id;
  }

  submitButton.addEventListener("click", async () => {
    if (!validateForm(page)) return;
    submitButton.disabled = fileInput.disabled = typeSelect.disabled = true;
    errorBox.textContent = "";

    try {
      const file = fileInput.files?.[0];
      if (file && imageId === null) imageId = await uploadImage(file);

      const response = await sendJson(createUrl, collectRequest());
      const { id, entity_id } = await response.json() as CreateEntityResponse;
      window.location.href = `/entities/${entity_id}?version=${id}`;
    } catch (error) {
      errorBox.textContent = (error as Error).message;
    } finally {
      submitButton.disabled = fileInput.disabled = typeSelect.disabled = false;
    }
  });
}
