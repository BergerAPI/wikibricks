import { entityEditFields, type EditEntityRequest } from "../../shared/contracts";

const page = document.querySelector<HTMLElement>("[data-edit-url]");
if (page) setupEdit(page);

function setupEdit(page: HTMLElement) {
  const { editUrl, historyUrl, baseVersionId } = page.dataset;
  const versionId = Number(baseVersionId);
  const save = page.querySelector<HTMLButtonElement>("#save");
  const message = page.querySelector<HTMLInputElement>("#change_message");
  if (!editUrl || !historyUrl || !Number.isSafeInteger(versionId) || versionId < 1 || !save || !message) return;

  const valueOf = (field: HTMLElement) =>
    "value" in field && typeof field.value === "string" ? field.value : field.innerText;
  const fields = entityEditFields.flatMap(name => {
    const field = page.querySelector<HTMLElement>(`[data-edit-field="${name}"]`);
    return field ? [{ name, field, initialValue: valueOf(field) }] : [];
  });

  save.addEventListener("click", async () => {
    if (save.disabled) return;
    save.disabled = true;

    const request: EditEntityRequest = { baseVersionId: versionId, changeMessage: message.value };
    for (const { name, field, initialValue } of fields) {
      const value = valueOf(field);
      if (value !== initialValue) request[name] = value;
    }

    try {
      const response = await fetch(editUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (response.status === 409) throw new Error(await response.text());
      if (!response.ok) throw new Error(`Edit failed (${response.status})`);
      window.location.href = historyUrl;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Edit failed");
    } finally {
      save.disabled = false;
    }
  });
}
