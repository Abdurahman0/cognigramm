type UnauthorizedHandler = (context?: { status: number; path?: string }) => void;

let handler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (next: UnauthorizedHandler | null): void => {
  handler = next;
};

export const notifyUnauthorized = (context?: { status: number; path?: string }): void => {
  handler?.(context);
};
