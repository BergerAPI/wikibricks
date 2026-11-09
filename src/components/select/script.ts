import TomSelect from "tom-select/base";
import dropdownInput from "tom-select/plugins/dropdown_input/plugin.js";
import type { TomLoadCallback } from "tom-select/dist/esm/types/index.js";
import type { SelectOptionsResponse } from "../../shared/contracts";
import "./style.css";

TomSelect.define("dropdown_input", dropdownInput);
TomSelect.define("wiki_position", function () {
  this.hook("after", "positionDropdown", () => {
    if (!this.isOpen) return;
    const rect = this.control.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const below = top + (viewport?.height ?? innerHeight) - rect.bottom;
    const above = rect.top - top;
    const upwards = below < 300 && above > below;
    this.dropdown.classList.toggle("drop-up", upwards);
    this.dropdown_content.style.maxHeight = `${Math.max(88, Math.min(240, (upwards ? above : below) - 96))}px`;
  });
});

export default function mount(element: HTMLElement) {
  const native = element.querySelector("select");
  if (!native) return;
  const initialValues = Array.from(native.selectedOptions, (option) => option.value);
  const originalAriaHidden = native.getAttribute("aria-hidden");
  const labels = Array.from(native.labels ?? [], (label) => ({ label, htmlFor: label.htmlFor }));
  const url = element.dataset.optionsUrl;
  const messages = element.dataset;
  const status = document.createElement("div");
  status.className = "wiki-select-status";
  status.setAttribute("role", "status");
  let request: AbortController | undefined;
  let resetTimer: ReturnType<typeof setTimeout>;
  let disposed = false;

  const control = new TomSelect(native, {
    plugins: ["dropdown_input", "wiki_position"],
    searchField: url ? [] : ["text"],
    allowEmptyOption: true,
    create: false,
    highlight: false,
    maxOptions: null,
    loadThrottle: 200,
    shouldLoad: () => true,
    render: {
      no_results: () => {
        const node = document.createElement("div");
        node.textContent = messages.emptyMessage!;
        return node;
      },
      loading: () => {
        const node = document.createElement("div");
        node.textContent = messages.loadingMessage!;
        return node;
      },
    },
    onDropdownOpen(this: TomSelect) { if (url) this.load(this.control_input.value); },
    load: url ? async function (this: TomSelect, query: string, done: TomLoadCallback) {
      if (disposed) return;
      request?.abort();
      const current = request = new AbortController();
      const endpoint = new URL(url, location.origin);
      endpoint.searchParams.set("q", query);
      status.textContent = "";
      try {
        const response = await fetch(endpoint, { signal: current.signal });
        if (!response.ok) throw new Error("Lookup failed");
        const result: SelectOptionsResponse = await response.json();
        if (disposed) return;
        if (current.signal.aborted) {
          done([], []);
          return;
        }
        this.clearOptions((option) => option.value === "" || this.items.includes(option.value));
        done(result.options.map((option) => ({ value: option.value, text: option.label })), []);
        status.textContent = result.more ? messages.moreMessage! : !result.options.length ? messages.emptyMessage! : "";
        this.positionDropdown();
      } catch {
        if (disposed) return;
        delete this.loadedSearches[query];
        if (!current.signal.aborted) status.textContent = messages.errorMessage!;
        done([], []);
      }
    } : undefined,
  });
  control.wrapper.classList.add("wiki-select");
  native.setAttribute("aria-hidden", "true");
  control.dropdown.append(status);
  control.control_input.placeholder = messages.searchLabel!;
  const label = control.control.getAttribute("aria-labelledby");
  if (native.getAttribute("aria-label")) control.control.setAttribute("aria-label", native.getAttribute("aria-label")!);
  const name = native.getAttribute("aria-label") ?? (label ? document.getElementById(label)?.textContent?.trim() : "");
  control.control_input.setAttribute("aria-label", [name, messages.searchLabel].filter(Boolean).join(": "));

  const sync = () => {
    control.sync();
    if (native.validity.valid) {
      status.textContent = "";
      control.wrapper.classList.remove("validation-error");
    }
  };
  const disabled = () => {
    if (native.disabled === control.isDisabled) return;
    native.disabled ? control.disable() : control.enable();
  };
  const reset = (event: Event) => {
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      if (event.defaultPrevented) return;
      control.setValue(initialValues, true);
      control.wrapper.classList.remove("validation-error");
      status.textContent = "";
    }, 0);
  };
  const invalid = (event: Event) => {
    event.preventDefault();
    control.wrapper.classList.add("validation-error");
    control.focus();
    status.textContent = native.validationMessage;
  };
  const position = () => control.positionDropdown();
  const form = native.form;
  native.addEventListener("change", sync);
  native.addEventListener("invalid", invalid);
  form?.addEventListener("reset", reset);
  const observer = new MutationObserver(disabled);
  observer.observe(native, { attributes: true, attributeFilter: ["disabled"] });
  window.visualViewport?.addEventListener("resize", position, { passive: true });

  return () => {
    disposed = true;
    request?.abort();
    clearTimeout(resetTimer);
    observer.disconnect();
    native.removeEventListener("change", sync);
    native.removeEventListener("invalid", invalid);
    form?.removeEventListener("reset", reset);
    window.visualViewport?.removeEventListener("resize", position);
    const selected = Array.from(native.selectedOptions, (option) => ({ value: option.value, label: option.label }));
    control.destroy();
    labels.forEach(({ label, htmlFor }) => { label.htmlFor = htmlFor; });
    if (originalAriaHidden === null) native.removeAttribute("aria-hidden");
    else native.setAttribute("aria-hidden", originalAriaHidden);
    for (const option of selected) if (!Array.from(native.options).some((it) => it.value === option.value)) native.add(new Option(option.label, option.value));
    for (const option of native.options) option.selected = selected.some((it) => it.value === option.value);
  };
}
