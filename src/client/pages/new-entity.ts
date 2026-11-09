import { validateForm } from "../forms";
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

  async function post<T>(url: string, body: BodyInit, headers?: HeadersInit): Promise<T> {
    const response = await fetch(url, { method: "POST", body, headers });
    if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
    return response.json();
  }

  async function uploadImage(file: File) {
    const body = new FormData();
    body.append("file", file);
    const { id } = await post<UploadImageResponse>(uploadUrl!, body);
    return id;
  }

  submitButton.addEventListener("click", async () => {
    if (!validateForm(page)) return;
    submitButton.disabled = fileInput.disabled = typeSelect.disabled = true;
    errorBox.textContent = "";

    try {
      const file = fileInput.files?.[0];
      if (file && imageId === null) imageId = await uploadImage(file);

      const { id, entity_id } = await post<CreateEntityResponse>(
        createUrl,
        JSON.stringify(collectRequest()),
        { "Content-Type": "application/json" },
      );
      window.location.href = `/entities/${entity_id}?version=${id}`;
    } catch (error) {
      errorBox.textContent = error instanceof Error ? error.message : "Network error. Please try again.";
    } finally {
      submitButton.disabled = fileInput.disabled = typeSelect.disabled = false;
    }
  });
}
