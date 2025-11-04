import type { PropsWithChildren } from "hono/jsx";

export const Table = ({ children }: PropsWithChildren) => (
    <table class="table-auto w-full mt-4 border-collapse border overflow-x-scroll [&_td]:border [&_td]:p-1 [&_th]:border">
        {children}
    </table>
)

export const TableHead = ({ children }: PropsWithChildren) => (
    <thead>
        <tr class="bg-background">
            {children}
        </tr>
    </thead>
)