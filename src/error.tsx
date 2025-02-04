import type { StatusCode } from "hono/utils/http-status";
import type { User } from "./database";
import { Layout } from "./layout";
import type { DefaultContext } from "./utils";

const ErrorPage = ({ context }: { context: DefaultContext }) => {
    const statusCode = context.res.status || 500;
    const title = statusCode === 404 ? "Page Not Found" : "Something Went Wrong";
    const message = statusCode === 404
        ? "The page you're looking for doesn't exist."
        : "We encountered an unexpected error. Please try again later. An administrator has been notified.";

    return <Layout user={context.get("user")}>
        <main>
            <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Error:{title}</h1>
            <p class="pb-2">{message}</p>
            <a href="/">Return to Home</a>
        </main>
    </Layout>
}

export const handleError = (err: Error, c: DefaultContext) => {
    // TODO: Log error to a service like Sentry
    c.status(c.res.status as StatusCode);

    return c.html(
        <ErrorPage context={c} />
    );
};

export const handleNotFound = async (c: DefaultContext, next: any) => {
    if (c.res.status.toString().startsWith("2") || c.res.status.toString().startsWith("3"))
        return await next();

    c.status(c.res.status as StatusCode);

    return c.html(
        <ErrorPage context={c} />
    );
};