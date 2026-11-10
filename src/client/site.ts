type Cleanup = () => void;
type ScriptModule = { default: (element: HTMLElement) => void | Cleanup | Promise<void | Cleanup> };
type Instance = { script: string; cleanup?: Cleanup };

const scripts = import.meta.glob<ScriptModule>(["../components/**/script.ts", "./pages/**/*.ts"]);
const mounted = new WeakMap<HTMLElement, Instance>();

async function include(element: HTMLElement) {
  const script = element.dataset.includeScript?.trim();
  const previous = mounted.get(element);
  if (previous?.script === script) return;
  previous?.cleanup?.();
  mounted.delete(element);
  if (!script) return;
  const load = scripts[`../${script}/script.ts`] ?? scripts[`./${script}.ts`];
  if (!load) {
    console.error("Unknown component script:", script);
    return;
  }
  const instance: Instance = { script };
  mounted.set(element, instance);
  try {
    const module = await load();
    if (!element.isConnected || mounted.get(element) !== instance) return;
    const cleanup = await module.default(element);
    if (!element.isConnected || mounted.get(element) !== instance) {
      cleanup?.();
      return;
    }
    instance.cleanup = cleanup || undefined;
  } catch (error) {
    if (mounted.get(element) === instance) mounted.delete(element);
    const status = element.querySelector<HTMLElement>("[data-script-status]");
    if (status && element.dataset.scriptErrorMessage) status.textContent = element.dataset.scriptErrorMessage;
    console.error("Could not initialize component:", script, error);
  }
}

function components(node: Element) {
  return [
    ...(node.matches("[data-include-script]") ? [node as HTMLElement] : []),
    ...node.querySelectorAll<HTMLElement>("[data-include-script]"),
  ];
}

components(document.documentElement).forEach((element) => void include(element));
new MutationObserver((changes) => {
  for (const change of changes) {
    if (change.type === "attributes") void include(change.target as HTMLElement);
    for (const node of change.removedNodes) {
      if (!(node instanceof Element) || node.isConnected) continue;
      for (const element of components(node)) {
        mounted.get(element)?.cleanup?.();
        mounted.delete(element);
      }
    }
    for (const node of change.addedNodes) {
      if (node instanceof Element) components(node).forEach((element) => void include(element));
    }
  }
}).observe(document.documentElement, {
  childList: true, subtree: true, attributes: true, attributeFilter: ["data-include-script"],
});
