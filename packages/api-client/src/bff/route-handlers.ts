import type { BffConfig } from './config';
import { handleBffRequest } from './proxy';

export interface BffRouteContext {
  params: Promise<{ path: string[] }>;
}

export type BffRouteHandler = (request: Request, context: BffRouteContext) => Promise<Response>;

export interface BffRouteHandlers {
  GET: BffRouteHandler;
  HEAD: BffRouteHandler;
  POST: BffRouteHandler;
  PUT: BffRouteHandler;
  PATCH: BffRouteHandler;
  DELETE: BffRouteHandler;
}

export function createBffRouteHandlers(resolveConfig: () => BffConfig, fetchFn?: typeof fetch): BffRouteHandlers {
  let config: BffConfig | undefined;
  const handle: BffRouteHandler = async (request, context) => {
    config ??= resolveConfig();
    const { path } = await context.params;
    return handleBffRequest(request, path, { config, fetchFn });
  };
  return { GET: handle, HEAD: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle };
}
