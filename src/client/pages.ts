import type {
  CreateEntityRequest,
  CreateEntityResponse,
  EditEntityRequest,
  EntityFieldValues,
  ReviewVersionRequest,
  UploadImageResponse,
} from "../shared/contracts";
import { localUrl, request, sendJson } from "./http";

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Shows the browser's message for the first invalid visible control. Hidden ones belong to another tab.
 */
const validateForm = (root: ParentNode) =>
  Array.from(root.querySelectorAll<FormControl>("input, select, textarea"))
    .every((control) => !control.getClientRects().length || control.reportValidity());

/**
 * Wires up a form whose buttons send it with a script: the buttons wait for the rich-text editors,
 * are disabled while sending, failures show in the error box, and leaving with unsaved input asks first.
 */
function setUpForm(page: HTMLElement, buttons: HTMLButtonElement[], send: (button: HTMLButtonElement) => Promise<string | undefined>) {
  const errorBox = page.querySelector<HTMLElement>("#error")!;
  let dirty = false;
  let sending = false;
  page.addEventListener("input", () => (dirty = true));
  addEventListener("beforeunload", (event) => dirty && event.preventDefault());

  const editorsLoading = () => !!page.querySelector('[data-rich-text-editor]:not([data-editor-ready="true"])');
  const updateButtons = () => buttons.forEach((button) => {
    button.disabled = sending || editorsLoading() || button.hasAttribute("data-locked");
  });
  page.addEventListener("rich-text:ready", updateButtons);
  updateButtons();

  for (const button of buttons) {
    button.addEventListener("click", async () => {
      if (sending || !validateForm(page)) return;
      sending = true;
      updateButtons();
      errorBox.textContent = "";
      try {
        const next = await send(button);
        if (next) {
          dirty = false;
          location.href = localUrl(next);
          return;
        }
      } catch (error) {
        errorBox.textContent = (error as Error).message;
        errorBox.scrollIntoView({ block: "center" });
      }
      sending = false;
      updateButtons();
    });
  }
}

function deletion(root: HTMLElement) {
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-delete-url]")) {
    const { deleteUrl, deleteConfirm, deleteSuccess, deleteFailed, deleteRedirect = "/" } = button.dataset;

    button.addEventListener("click", async () => {
      if (!window.confirm(deleteConfirm!)) return;
      button.disabled = true;
      try {
        await request(deleteUrl!, { method: "DELETE" });
        window.alert(deleteSuccess);
        location.href = localUrl(deleteRedirect);
      } catch (error) {
        window.alert(`${deleteFailed}: ${(error as Error).message}`);
        button.disabled = false;
      }
    });
  }
}

function editEntity(root: HTMLElement) {
  const page = root.querySelector<HTMLElement>("[data-edit-url]")!;
  const { editUrl, historyUrl, baseVersionId } = page.dataset;
  const message = page.querySelector<HTMLInputElement>("#change_message")!;
  const description = page.querySelector<HTMLInputElement>('[name="description"]')!;

  // Only changed values are sent, so remember what each field started with
  const controls = [...page.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-edit-field]"), description];
  const initial = new Map(controls.map((control) => [control, control.value]));

  setUpForm(page, [page.querySelector("#save")!], async () => {
    const fields: EntityFieldValues = {};
    for (const [control, value] of initial) {
      if (control !== description && control.value !== value) fields[control.dataset.editField!] = control.value;
    }
    const body: EditEntityRequest = { fields, baseVersionId: Number(baseVersionId), changeMessage: message.value };
    if (description.value !== initial.get(description)) body.description = description.value;

    await sendJson(editUrl!, body);
    return historyUrl;
  });
}

function newEntity(root: HTMLElement) {
  const page = root.querySelector<HTMLElement>("[data-create-url]")!;
  const { createUrl, uploadUrl } = page.dataset;
  const fileInput = page.querySelector<HTMLInputElement>("#image_file")!;
  const typeSelect = page.querySelector<HTMLSelectElement>("#entity_type")!;
  const valueOf = (name: string) => page.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? "";

  typeSelect.addEventListener("change", () => {
    for (const panel of page.querySelectorAll(".tab-content")) {
      panel.classList.toggle("hidden", panel.id !== `tab-${typeSelect.value}`);
    }
  });

  let uploaded: { file: File; id: number } | undefined;
  fileInput.addEventListener("change", () => { uploaded = undefined; });

  setUpForm(page, [page.querySelector("#submit_button")!], async () => {
    const file = fileInput.files?.[0];
    const entityType = typeSelect.value;

    // Every input in the tab of the selected type is one of its fields
    const fields: EntityFieldValues = {};
    for (const input of page.querySelectorAll<FormControl>(`#tab-${entityType} [name]`)) {
      fields[input.name] = input.value;
    }
    const body: CreateEntityRequest = {
      entity_type: entityType,
      name: valueOf("name"),
      description: valueOf("description"),
      image_id: null,
      fields,
    };
    if (file) {
      if (uploaded?.file === file) {
        body.image_id = uploaded.id;
      } else {
        const upload = new FormData();
        upload.append("file", file);
        const { id } = await (await request(uploadUrl!, { method: "POST", body: upload })).json() as UploadImageResponse;
        body.image_id = id;
        if (fileInput.files?.[0] === file) uploaded = { file, id };
      }
    }
    const { id, entity_id } = await (await sendJson(createUrl!, body)).json() as CreateEntityResponse;
    return `/entities/${entity_id}?version=${id}`;
  });
}

function reviewEntity(root: HTMLElement) {
  const page = root.querySelector<HTMLElement>("[data-review-url]")!;
  const { reviewUrl, rejectReason } = page.dataset;
  const message = page.querySelector<HTMLInputElement>("#review_message")!;
  message.addEventListener("input", () => message.setCustomValidity(""));

  setUpForm(page, [page.querySelector("#approve")!, page.querySelector("#reject")!], async (button) => {
    const type: ReviewVersionRequest["type"] = button.id === "approve" ? "approved" : "rejected";
    // The author of a rejected change should learn what to do differently
    message.setCustomValidity(type === "rejected" && !message.value.trim() ? rejectReason! : "");
    if (!message.reportValidity()) return;

    await sendJson(reviewUrl!, { type, reviewMessage: message.value } satisfies ReviewVersionRequest, "PATCH");
    // Back to the queue, where the next change waits
    return "/changes";
  });
}

/**
 * What each page sets up, by the name the server gives it
 */
export const pages: Record<string, (root: HTMLElement) => void> = {
  delete: deletion,
  "edit-entity": editEntity,
  "new-entity": newEntity,
  "review-entity": reviewEntity,
};
