// Node module-resolution loader hook that maps the CLI SDK specifier to the
// committed test stub (test/stubs/copilot-sdk-extension.mjs) when running
// tests outside the CLI runtime. Registered by test/register-sdk-stub.mjs.

const STUB = new URL("./stubs/copilot-sdk-extension.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@github/copilot-sdk/extension") {
    return { url: STUB, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
