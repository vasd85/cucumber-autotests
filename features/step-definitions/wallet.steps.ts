import { When } from '@cucumber/cucumber';

import type { CustomWorld } from '../support/world.ts';

When(
  'the user approves the connection request in MetaMask',
  async function (this: CustomWorld): Promise<void> {
    await this.metaMask.approveConnection();
  },
);

When(
  'the user signs the login message in MetaMask',
  async function (this: CustomWorld): Promise<void> {
    await this.metaMask.signMessage();
  },
);

When(
  'the user rejects the connection request in MetaMask',
  async function (this: CustomWorld): Promise<void> {
    await this.metaMask.rejectConnection();
  },
);
