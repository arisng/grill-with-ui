// Test-only stub of the @github/copilot-sdk/extension module (committed).
// Lets us import extension.mjs outside the CLI runtime so the monitor loop and
// tool wiring can be exercised in automated tests. Not used at runtime — the
// real CLI injects its own SDK.
//
// Loaded via test/register-sdk-stub.mjs (Node module.register hook).

export function joinSession(config) {
  const rec = { config, sends: [], logs: [], idleHandlers: [] };
  const session = {
    log: async (message, options) => {
      rec.logs.push({ message, options });
    },
    send: async (payload) => {
      rec.sends.push(payload);
      return `msg-${rec.sends.length}`;
    },
    on: (a, b) => {
      const type = typeof a === "function" ? "*" : a;
      const handler = typeof a === "function" ? a : b;
      if (type === "session.idle") rec.idleHandlers.push(handler);
      return () => {};
    },
  };
  rec.session = session;
  globalThis.__grillMonitorTest = rec;
  return session;
}
