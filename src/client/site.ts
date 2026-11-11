type ScriptModule = { default: (element: HTMLElement) => void };

const scripts = import.meta.glob<ScriptModule>(["../components/**/script.ts", "./pages/**/*.ts"]);

// Each script is only downloaded by the pages that render its component.
for (const element of document.querySelectorAll<HTMLElement>("[data-include-script]")) {
  const script = element.dataset.includeScript!;
  const load = scripts[`../${script}/script.ts`] ?? scripts[`./${script}.ts`];
  load().then((module) => module.default(element)).catch((error) => {
    const status = element.querySelector<HTMLElement>("[data-script-status]");
    if (status && element.dataset.scriptErrorMessage) status.textContent = element.dataset.scriptErrorMessage;
    console.error("Could not initialize component:", script, error);
  });
}
