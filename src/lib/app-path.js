export const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (
    !APP_BASE_PATH ||
    normalizedPath === APP_BASE_PATH ||
    normalizedPath.startsWith(`${APP_BASE_PATH}/`) ||
    normalizedPath.startsWith(`${APP_BASE_PATH}?`)
  ) {
    return normalizedPath;
  }

  return `${APP_BASE_PATH}${normalizedPath}`;
}

export function withoutBasePath(path = "/") {
  if (!APP_BASE_PATH) return path;
  if (path === APP_BASE_PATH) return "/";
  if (path.startsWith(`${APP_BASE_PATH}/`)) {
    return path.slice(APP_BASE_PATH.length) || "/";
  }
  return path;
}
