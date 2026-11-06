const base = new URL("https://wikibricks.invalid");

export function parseLocalUrl(target: string | undefined): URL | undefined {
  if (!target?.startsWith("/") || target.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(target)) {
    return;
  }

  const url = new URL(target, base);
  if (url.origin !== base.origin || url.pathname.startsWith("//")) return;
  return url;
}
