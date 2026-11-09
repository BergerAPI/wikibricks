import type { RelationOptionsResponse } from "../shared/contracts";

for (const picker of document.querySelectorAll<HTMLElement>("[data-relation-picker]")) {
  const input = picker.querySelector<HTMLInputElement>("[data-relation-search]")!;
  const value = picker.querySelector<HTMLInputElement>("[data-relation-value]")!;
  const list = picker.querySelector<HTMLDataListElement>("datalist")!;
  const status = picker.querySelector<HTMLElement>("[role=status]")!;
  const hint = status.textContent;
  let timer: ReturnType<typeof setTimeout>;
  let request: AbortController | undefined;

  const syncValue = () => {
    const text = input.value.trim();
    const options = Array.from(list.options);
    const named = options.filter((option) => option.dataset.label?.toLowerCase() === text.toLowerCase());
    const option = options.find((option) => option.value === text) ?? (named.length === 1 ? named[0] : undefined);
    value.value = option?.dataset.id ?? "";
    input.setCustomValidity(text && !option ? input.dataset.invalidMessage! : "");
    return !!option;
  };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    request?.abort();
    if (syncValue() || !input.value.trim()) {
      status.textContent = hint;
      return;
    }

    timer = setTimeout(async () => {
      const current = request = new AbortController();
      const url = new URL(picker.dataset.optionsUrl!, location.origin);
      url.searchParams.set("q", input.value.trim());
      status.textContent = input.dataset.loadingMessage!;
      try {
        const response = await fetch(url, { signal: current.signal });
        if (!response.ok) throw new Error("Lookup failed");
        const result: RelationOptionsResponse = await response.json();
        if (current.signal.aborted) return;
        list.replaceChildren(...result.options.map(({ value, label }) => {
          const option = document.createElement("option");
          option.value = `${label} (#${value})`;
          option.dataset.id = value;
          option.dataset.label = label;
          return option;
        }));
        syncValue();
        status.textContent = !result.options.length ? input.dataset.emptyMessage!
          : result.more ? input.dataset.moreMessage! : hint;
      } catch {
        if (!current.signal.aborted) status.textContent = input.dataset.errorMessage!;
      }
    }, 200);
  });
}

export function validateRelationPickers(root: ParentNode) {
  for (const input of root.querySelectorAll<HTMLInputElement>("[data-relation-search]"))
    if (!input.reportValidity()) return false;
  return true;
}
