// Quick check to verify treasury address
import { getTreasuryAccount } from './server/keeta-impl/utils/client.js';

const treasury = getTreasuryAccount();
console.log('Treasury Address:', treasury.publicKeyString.get());
