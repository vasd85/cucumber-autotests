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
 */
export const METAMASK_EXTENSION_ID = 'nkbihfbeogaeaoehlefnkodbefgpgknn';

export const MetaMaskUrls = {
  home: `chrome-extension://${METAMASK_EXTENSION_ID}/home.html#/`,
  unlock: `chrome-extension://${METAMASK_EXTENSION_ID}/home.html#unlock`,
  permissions: `chrome-extension://${METAMASK_EXTENSION_ID}/home.html#permissions`,
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
 * Role+name locators used inside the Connect popup when the test drives
 * the popup directly (e.g. rejection path). Dappwright's `approve()` /
 * `reject()` also use these conceptually — keeping them here means the
 * test-writer uses the same strings when falling back to manual popup
 * control.
 */
export const MetaMaskConnectPopup = {
  cancelButtonName: 'Cancel',
  connectButtonName: 'Connect',
} as const;

/**
 * Role+name fallback for the signature-request popup. MetaMask's newer
 * popup layout lost the `confirm-btn` testid Dappwright 2.9.2 hardcodes
 * in `approve()` / `sign()`; role+name is a stable alternative.
 */
export const MetaMaskSignaturePopup = {
  cancelButtonName: 'Cancel',
  signButtonName: 'Confirm',
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
