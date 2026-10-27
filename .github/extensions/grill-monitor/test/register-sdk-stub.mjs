// Registers the SDK stub loader for tests:
//   node --import ./test/register-sdk-stub.mjs --test test/extension.test.mjs
import { register } from "node:module";

register("./sdk-stub-loader.mjs", import.meta.url);
