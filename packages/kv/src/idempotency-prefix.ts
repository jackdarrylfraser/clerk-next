export interface CreateIdempotencyPrefixOptions {
  namespace: string;
  scope: string;
  event: string;
  separator: string;
}

export function createIdempotencyPrefix({
  namespace = "",
  scope,
  event,
  separator,
}: CreateIdempotencyPrefixOptions): string {
  if (!separator) {
    throw new Error("An idempotency prefix separator is required");
  }
  const components = [scope, event].filter(
    (component): component is string => component !== undefined,
  );
  if (components.some((component) => !component.trim())) {
    throw new Error("Idempotency prefix attributes must not be empty");
  }
  if (namespace && !namespace.trim()) {
    throw new Error("An idempotency prefix namespace must not be empty");
  }

  const prefix = components.join(separator);
  return namespace ? `${namespace}/${prefix}` : prefix;
}
