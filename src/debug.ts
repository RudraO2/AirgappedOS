/** Dev-only handles for driving the workstation from DevTools or a test script. */
import { useBrowser } from "./os/kernel/browser";
import { launch } from "./os/kernel/launch";
import { useShell } from "./os/kernel/shell";
import { useOS } from "./os/kernel/store";
import { useFaraday } from "./faraday/store";
import { runTurn } from "./faraday/turn";

if (import.meta.env.DEV) {
	(window as unknown as Record<string, unknown>).__ws = { useOS, useShell, useBrowser, useFaraday, launch, runTurn };
}
