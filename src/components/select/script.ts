import TomSelect from "tom-select/base";
import dropdownInput from "tom-select/plugins/dropdown_input/plugin.js";
import type { TomLoadCallback } from "tom-select/dist/esm/types/index.js";
import type { SelectOptionsResponse } from "../../shared/contracts";
import "./style.css";

TomSelect.define("dropdown_input", dropdownInput);
// Opens upwards when there is more room above, e.g. over a phone keyboard.
TomSelect.define("wiki_position", function () {
  this.hook("after", "positionDropdown", () => {
    if (!this.isOpen) return;
    const rect = this.control.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const below = top + (viewport?.height ?? innerHeight) - rect.bottom;
    const above = rect.top - top;
    const upwards = below < 300 && above > below;
    // The list gets the room that the search box and the status line leave, between two and five options.
    const room = (upwards ? above : below) - 96;
    this.dropdown.classList.toggle("drop-up", upwards);
    this.dropdown_content.style.maxHeight = `${Math.max(88, Math.min(240, room))}px`;
  });
});

const note = (text: string) => {
  const node = document.createElement("div");
  node.className = "wiki-select-status";
  node.textContent = text;
  return node;
};

export default function mount(element: HTMLElement) {
  const native = element.querySelector("select")!;
  const url = element.dataset.optionsUrl;
  const messages = element.dataset;
  const fieldName = native.ariaLabel ?? native.labels[0]?.textContent?.trim();
  const status = note("");
  status.setAttribute("role", "status");
  let request: AbortController | undefined;

  const control = new TomSelect(native, {
    plugins: ["dropdown_input", "wiki_position"],
    // The server has already matched looked-up options.
    searchField: url ? [] : ["text"],
    allowEmptyOption: true,
    create: false,
    highlight: false,
    maxOptions: null,
    loadThrottle: 200,
    shouldLoad: () => true,
    render: {
      no_results: () => note(messages.emptyMessage!),
      loading: () => note(messages.loadingMessage!),
    },
    onDropdownOpen(this: TomSelect) { if (url) this.load(this.control_input.value); },
    load: url ? async function (this: TomSelect, query: string, done: TomLoadCallback) {
      // Every search replaces the options, so a repeated one has to load again.
      delete this.loadedSearches[query];
      request?.abort();
      const current = request = new AbortController();
      const endpoint = new URL(url, location.origin);
      endpoint.searchParams.set("q", query);
      status.textContent = "";
      try {
        const response = await fetch(endpoint, { signal: current.signal });
        if (!response.ok) throw new Error("Lookup failed");
        const result: SelectOptionsResponse = await response.json();
        this.clearOptions((option) => option.value === "" || this.items.includes(option.value));
        this.clearOptionGroups();
        const groups = [...new Set(result.options.flatMap((option) => option.group ? [option.group] : []))];
        done(
          result.options.map((option) => ({ value: option.value, text: option.label, optgroup: option.group })),
          groups.map((label) => ({ value: label, label })),
        );
        // Enter picks the first match instead of the empty option above it.
        const first = this.dropdown_content.querySelector<HTMLElement>('[data-selectable]:not([data-value=""])');
        if (query && first) this.setActiveOption(first);
        status.textContent = result.more ? messages.moreMessage! : !result.options.length ? messages.emptyMessage! : "";
        this.positionDropdown();
      } catch {
        // A newer search aborted this one and reports its own result.
        if (current === request) status.textContent = messages.errorMessage!;
        done([], []);
      }
    } : undefined,
  });
  control.wrapper.classList.add("wiki-select");
  native.setAttribute("aria-hidden", "true");
  control.dropdown.append(status);
  control.control_input.placeholder = messages.searchLabel!;
  // Screen readers hear which field is searched, like "Brand: Search by name…".
  if (native.ariaLabel) control.control.ariaLabel = native.ariaLabel;
  control.control_input.ariaLabel = [fieldName, messages.searchLabel].filter(Boolean).join(": ");

  // Let Tom Select's click handler manage focus; native focus would toggle it twice.
  control.control.addEventListener("mousedown", (event) => event.preventDefault());
  window.visualViewport?.addEventListener("resize", () => control.positionDropdown(), { passive: true });
}
