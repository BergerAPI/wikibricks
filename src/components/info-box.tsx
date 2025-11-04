import type { PropsWithChildren } from "hono/jsx";

export const InfoBox = ({ title, children }: PropsWithChildren & { title: string }) => (
    <div class="sm:float-right sm:clear-both sm:ml-2 sm:w-64 w-full bg-background border mb-2 p-1">
        <table class="m-auto border-spacing-0.5 leading-6">
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
)

export const InfoBoxImage = ({ src, alt }: { src: string, alt: string }) => (
    <tr>
        <td colspan={2}>
            <img
                class="px-1"
                src={src}
                width="800"
                height="800"
                loading="lazy"
                decoding="async"
                alt={alt}
            />
        </td>
    </tr>
);

export const InfoBoxRow = ({ label, children }: { label: string } & PropsWithChildren) => (
    <tr class="h-6">
        <th scope="row" class="text-left">
            {label}
        </th>
        <td class="text-left">
            {children}
        </td>
    </tr>
)