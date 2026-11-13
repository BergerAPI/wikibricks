import { dateFormats, type DateFormat } from "../shared/contracts";
import { pages } from "./pages";

type ScriptModule = { default: (element: HTMLElement) => void };

const components = import.meta.glob<ScriptModule>("../components/**/script.ts");

// Dates arrive in UTC and are shown in the device's time zone and format
for (const time of document.querySelectorAll<HTMLTimeElement>("time[data-format]")) {
  const format = dateFormats[time.dataset.format as DateFormat];
  if (format) time.textContent = new Intl.DateTimeFormat(undefined, format).format(new Date(time.dateTime));
}

// Pages with forms are set up right away, they are small enough to come with every page
pages[document.body.dataset.page ?? ""]?.(document.body);

// Large components like the editor are only downloaded by the pages that render them
for (const element of document.querySelectorAll<HTMLElement>("[data-include-script]")) {
  const script = element.dataset.includeScript!;
  components[`../${script}/script.ts`]().then((module) => module.default(element)).catch((error) => {
    const status = element.querySelector<HTMLElement>("[data-script-status]");
    if (status && element.dataset.scriptErrorMessage) status.textContent = element.dataset.scriptErrorMessage;
    console.error("Could not initialize component:", script, error);
  });
}
