import type { PropsWithChildren } from "hono/jsx";

export const Table = ({ children }: PropsWithChildren) => (
  <div class="mt-4 max-w-full overflow-x-auto">
    <table class="table-auto w-full border-collapse border text-sm sm:text-base [&_td]:border [&_td]:px-2 [&_td]:py-3 [&_td]:align-top [&_th]:min-w-20 [&_th]:whitespace-nowrap [&_th]:border [&_th]:p-2">
      {children}
    </table>
  </div>
);

export const TableHead = ({ children }: PropsWithChildren) => (
  <thead>
    <tr class="bg-background">{children}</tr>
  </thead>
);
