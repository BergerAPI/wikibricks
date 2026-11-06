import type {
  CreateEntityRequest,
  CreateEntityResponse,
  UploadImageResponse,
} from "../../shared/contracts";

const page = document.querySelector<HTMLElement>("[data-create-url]");
if (page) setupCreation(page);

function setupCreation(page: HTMLElement) {
  const { createUrl, uploadUrl } = page.dataset;
  const fileInput = page.querySelector<HTMLInputElement>("#image_file");
  const submitButton = page.querySelector<HTMLButtonElement>("#submit_button");
  const typeSelect = page.querySelector<HTMLSelectElement>("#entity_type");
  const errorBox = page.querySelector<HTMLElement>("#error");
  if (!createUrl || !uploadUrl || !fileInput || !submitButton || !typeSelect || !errorBox) return;

  let imageId: number | null = null;
  fileInput.addEventListener("change", () => { imageId = null; });
  typeSelect.addEventListener("change", () => {
    for (const panel of page.querySelectorAll(".tab-content")) {
      panel.classList.toggle("hidden", panel.id !== `tab-${typeSelect.value}`);
    }
  });

  const field = (name: keyof CreateEntityRequest) =>
    page.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value ?? "";

  function collectRequest(entityType: string): CreateEntityRequest {
    const common = { name: field("name"), description: field("description"), image_id: imageId };
    switch (entityType) {
      case "set":
        return {
          ...common, entity_type: "set",
          pieces: field("pieces"), issued: field("issued"), size: field("size"),
          theme: field("theme"), brand_id: field("brand_id"),
        };
      case "brand":
        return { ...common, entity_type: "brand", country: field("country"), website: field("website") };
      case "wiki":
        return { ...common, entity_type: "wiki" };
      default:
        throw new Error("Invalid entity type.");
    }
  }

  async function uploadImage(file: File, url: string): Promise<number> {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(url, { method: "POST", body });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);

    const result: Partial<UploadImageResponse> | null = await response.json();
    if (typeof result?.id !== "number" || !Number.isSafeInteger(result.id) || result.id < 1) {
      throw new Error("Invalid upload response.");
    }
    return result.id;
  }

  submitButton.addEventListener("click", async () => {
    if (submitButton.disabled) return;
    submitButton.disabled = true;
    fileInput.disabled = true;
    typeSelect.disabled = true;
    errorBox.textContent = "";

    try {
      const file = fileInput.files?.[0];
      if (file && imageId === null) imageId = await uploadImage(file, uploadUrl);

      const response = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectRequest(typeSelect.value)),
      });
      if (!response.ok) throw new Error(`There was an error (${response.status})`);

      const result: Partial<CreateEntityResponse> | null = await response.json();
      if (
        typeof result?.id !== "number" || !Number.isSafeInteger(result.id) || result.id < 1 ||
        typeof result.entity_id !== "number" || !Number.isSafeInteger(result.entity_id) || result.entity_id < 1
      ) {
        throw new Error("Unexpected response from server.");
      }
      window.location.href = `/entities/${result.entity_id}?version=${result.id}`;
    } catch (error) {
      errorBox.textContent = error instanceof Error ? error.message : "Network error. Please try again.";
    } finally {
      submitButton.disabled = false;
      fileInput.disabled = false;
      typeSelect.disabled = false;
    }
  });
}
