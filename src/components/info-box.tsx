import type { PropsWithChildren } from "hono/jsx";

export const InfoBox = ({ title, children }: PropsWithChildren<{ title: string }>) => (
  <div class="md:float-right md:clear-both md:ml-4 md:w-64 w-full shrink-0 bg-background border mb-4 p-2">
    <table class="w-full table-fixed border-spacing-0.5 leading-6">
      <colgroup>
        <col class="w-2/5" />
        <col />
      </colgroup>
      <tbody>
        <tr>
          <th colspan={2} class="infobox-above">
            {title}
          </th>
        </tr>
        {children}
      </tbody>
    </table>
  </div>
);

export const InfoBoxImage = ({ src, srcset, alt, class: className = "" }: { src: string; srcset?: string; alt: string; class?: string }) => (
  <tr>
    <td colspan={2}>
      <img
        class={`mx-auto w-full h-auto px-1 ${className}`}
        src={src}
        srcset={srcset}
        width="800"
        height="800"
        loading="lazy"
        decoding="async"
        alt={alt}
      />
    </td>
  </tr>
);

export const InfoBoxRow = ({ label, children }: PropsWithChildren<{ label: string }>) => (
  <tr>
    <th scope="row" class="py-1 pr-2 text-left align-top hyphens-auto">
      {label}
    </th>
    <td class="py-1 text-left align-top">{children}</td>
  </tr>
);
