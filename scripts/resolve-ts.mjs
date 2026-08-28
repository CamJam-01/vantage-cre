/** Retries bare relative specifiers with .ts / .tsx so node:test can
 * follow Next-style extensionless imports from lib/ sources. */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.')) throw error;
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      try {
        return await next(`${specifier}.tsx`, context);
      } catch {
        throw error;
      }
    }
  }
}
