export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("@/lib/security/logger");
    logger.info("Application runtime started", {
      nodeVersion: process.version,
    });
  }
}

export async function onRequestError(error, request, context) {
  const { logger } = await import("@/lib/security/logger");
  logger.error("Unhandled request error", {
    error,
    request: {
      method: request.method,
      path: request.path,
    },
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
}

