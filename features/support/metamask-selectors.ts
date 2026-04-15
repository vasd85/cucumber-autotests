/**
 * Central catalogue of MetaMask-version-coupled selectors. A MetaMask
 * upgrade that shifts DOM or URLs is fixed in this one file.
 *
 * The extension ID is runtime-resolved because Dappwright installs MetaMask
 * unpacked — Chrome assigns a random ID per install. `initMetaMaskExtensionId`
 * is called once from `browser-session.initSession()` with the ID read off
 * the wallet page URL; URL builders below consume it.
 */

let resolvedExtensionId: string | null = null;

export function initMetaMaskExtensionId(extensionId: string): void {
  // Chrome extension IDs are 32-character strings of lowercase letters a-p.
  if (!/^[a-p]{32}$/.test(extensionId)) {
    throw new Error(`Invalid MetaMask extension ID: "${extensionId}"`);
  }
  resolvedExtensionId = extensionId;
}

export function getMetaMaskExtensionId(): string {
  if (!resolvedExtensionId) {
    throw new Error(
      'MetaMask extension ID not initialised. Call initMetaMaskExtensionId() from BeforeAll first.',
    );
  }
  return resolvedExtensionId;
}

export function getMetaMaskHomeUrl(hashPath = ''): string {
  const id = getMetaMaskExtensionId();
  const suffix = hashPath ? `#${hashPath}` : '#/';
  return `chrome-extension://${id}/home.html${suffix}`;
}

/** Popup URL path fragments — ID-agnostic, so plain constants. */
export const MetaMaskPopupUrls = {
  connectPopupFragment: '/notification.html#/connect/',
  signaturePopupFragment: '/notification.html#/confirm-transaction/',
} as const;

export const MetaMaskTestIds = {
  unlockPasswordInput: 'unlock-password',
  unlockSubmit: 'unlock-submit',
  connectedOriginRow: (origin: string) => `connected-sites-row-${origin}`,
  disconnectButton: 'disconnect-site-button',
  disconnectConfirmButton: 'disconnect-all-modal-confirm-button',
} as const;

/**
 * Data-testids MetaMask uses on the Confirm / Cancel buttons across popup
 * versions. `confirm-footer-*` is the current MV3 flow; `confirm-btn` /
 * `cancel-btn` are the legacy names Dappwright 2.9.2 hardcodes. Chain both
 * with `.or()` so either version resolves.
 */
export const MetaMaskPopupButtonTestIds = {
  confirmPrimary: 'confirm-footer-button',
  confirmLegacy: 'confirm-btn',
  cancelPrimary: 'confirm-footer-cancel-button',
  cancelLegacy: 'cancel-btn',
} as const;
