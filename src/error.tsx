import { Layout } from "./layout";
import type { DefaultContext } from "./utils";

export const handleError = (err: Error, c: DefaultContext) => {
    // TODO: Log error to a service like Sentry

    const statusCode = c.res.status || 500;
    const title = statusCode === 404 ? "Page Not Found" : "Something Went Wrong";
    const message = statusCode === 404
        ? "The page you're looking for doesn't exist."
        : "We encountered an unexpected error. Please try again later. An administrator has been notified.";

    return c.html(
        <Layout user={c.get("user")}>
            <main>
                <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Error:{title}</h1>
                <p class="pb-2">{message}</p>
                <a href="/">Return to Home</a>
            </main>
        </Layout>
    );
};