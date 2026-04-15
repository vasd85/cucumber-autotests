/**
 * Central catalogue of MetaMask extension selectors this project depends
 * on. Any selector that is coupled to a MetaMask version (data-testids,
 * URL patterns, role+name pairs inside a popup) lives here and only here.
 * A MetaMask upgrade that shifts DOM is fixed in one file.
 *
 * Dappwright's own popup handling (`approve()`, `sign()`, `reject()`)
 * already encapsulates the Connect / Signature popup selectors for the
 * happy path — those are NOT duplicated here. The entries below cover:
 *  - unlock screen (pre-flight if the wallet is locked),
 *  - the Sites / permissions screen (UI-fallback path of the reconciler),
 *  - popup-URL patterns (so we can identify and reach the Connect popup
 *    directly when Dappwright's helper is not applicable, e.g. rejecting
 *    via explicit Cancel click).
 *
 * The MetaMask extension ID is **runtime-resolved**. Dappwright installs
 * the extension as an *unpacked* build, so its Chrome-assigned ID differs
 * from the Web Store ID (`nkbihfbeogaeaoehlefnkodbefgpgknn`) and differs
 * per install. `initMetaMaskExtensionId()` is called once from
 * `browser-session.initSession()` with the ID read off the wallet's own
 * home page URL; all other modules go through `getMetaMaskExtensionId()`
 * or `getMetaMaskHomeUrl()` so nothing hardcodes the wrong value.
 */

let resolvedExtensionId: string | null = null;

/**
 * Records the Chrome-assigned extension ID for the Dappwright-installed
 * MetaMask. Call exactly once in `BeforeAll` after `bootstrap()` resolves.
 */
export function initMetaMaskExtensionId(extensionId: string): void {
  if (!/^[a-p]{32}$/.test(extensionId)) {
    // Chrome extension IDs are 32-character strings of lowercase letters a-p
    // (see https://developer.chrome.com/docs/extensions/mv3/manifest/). Fail
    // loud here so a malformed ID does not silently propagate into URL
    // builders later.
    throw new Error(`Invalid MetaMask extension ID: "${extensionId}"`);
  }
  resolvedExtensionId = extensionId;
}

export function getMetaMaskExtensionId(): string {
  if (!resolvedExtensionId) {
    throw new Error(
      'MetaMask extension ID not initialised. Call initMetaMaskExtensionId() from BeforeAll before accessing selectors.',
    );
  }
  return resolvedExtensionId;
}

/**
 * Builds an absolute URL inside the MetaMask home page, e.g.
 * `getMetaMaskHomeUrl('permissions')` →
 * `chrome-extension://<id>/home.html#permissions`.
 */
export function getMetaMaskHomeUrl(hashPath = ''): string {
  const id = getMetaMaskExtensionId();
  const suffix = hashPath ? `#${hashPath}` : '#/';
  return `chrome-extension://${id}/home.html${suffix}`;
}

/**
 * Builds the `chrome-extension://<id>` origin prefix — used to match
 * service-worker URLs owned by MetaMask.
 */
export function getMetaMaskOriginPrefix(): string {
  return `chrome-extension://${getMetaMaskExtensionId()}`;
}

/**
 * URL path fragments used to recognise MetaMask popup tabs. These are
 * ID-agnostic (only the path+hash matter), so they stay as a static
 * constant instead of going through the runtime resolver.
 */
export const MetaMaskPopupUrls = {
  /** Fragment matched against a popup tab URL to recognise the Connect popup. */
  connectPopupFragment: '/notification.html#/connect/',
  /** Fragment matched against a popup tab URL to recognise the signature-request popup. */
  signaturePopupFragment: '/notification.html#/confirm-transaction/',
} as const;

export const MetaMaskTestIds = {
  unlockPasswordInput: 'unlock-password',
  unlockSubmit: 'unlock-submit',
  /** Row on the `Sites` screen listing the currently-connected origin. */
  connectedOriginRow: (origin: string) => `connected-sites-row-${origin}`,
  /** "Disconnect" action on a permissions row. */
  disconnectButton: 'disconnect-site-button',
  /** Confirm "Disconnect" in the modal. */
  disconnectConfirmButton: 'disconnect-all-modal-confirm-button',
} as const;

/**
 * Data-testids MetaMask uses on the Confirm / Cancel buttons across
 * popup versions. `confirm-footer-button` / `confirm-footer-cancel-button`
 * are the newer MV3 flow; `confirm-btn` / `cancel-btn` are the legacy
 * names Dappwright 2.9.2 hardcodes. Locators that click these try each
 * testid in turn via Playwright's `.or()`.
 */
export const MetaMaskPopupButtonTestIds = {
  confirmPrimary: 'confirm-footer-button',
  confirmLegacy: 'confirm-btn',
  cancelPrimary: 'confirm-footer-cancel-button',
  cancelLegacy: 'cancel-btn',
} as const;
