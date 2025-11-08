#!/usr/bin/env node

/**
 * Update LP STORAGE account metadata with shares
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const NETWORK = 'test';
const POOL_ADDRESS = 'keeta_atzfyx6ocqbxup5djw75nikn5nvafhsj3kkl7g7ohlm6hbgzspxip4bahp34u';
const LP_STORAGE_ADDRESS = 'keeta_atye23zpb3j4vvil63b2frp25gm3gw4zdzwcrh7oeqz67k3aigycsuuyjpzz2';
const USER_ADDRESS = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi';
const SHARES = 9988086851926n;

// Helper to create seed from hex
function seedFromHexEnv(envVar) {
  const seedHex = process.env[envVar];
  if (!seedHex) {
    throw new Error(`Missing ${envVar} in .env`);
  }
  return Buffer.from(seedHex.trim(), 'hex');
}

// Create ops client
function getOpsClient() {
  const opsSeed = seedFromHexEnv('OPS_SEED');
  const opsAccount = KeetaNet.lib.Account.fromSeed(opsSeed, 0);
  const client = KeetaNet.UserClient.fromNetwork(NETWORK, opsAccount);
  return { client, account: opsAccount };
}

// Main function
async function main() {
  console.log('🔄 Updating LP STORAGE Account Metadata\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { client, account } = getOpsClient();

  console.log(`📡 Connected to Keeta ${NETWORK} network`);
  console.log(`👤 Ops account: ${account.publicKeyString.get()}\n`);
  console.log(`📍 Pool: ${POOL_ADDRESS}`);
  console.log(`📍 LP STORAGE: ${LP_STORAGE_ADDRESS}`);
  console.log(`👤 Owner: ${USER_ADDRESS}`);
  console.log(`📊 Shares: ${SHARES}\n`);

  // Build transaction to update metadata
  const builder = client.initBuilder();
  const lpAccount = KeetaNet.lib.Account.fromPublicKeyString(LP_STORAGE_ADDRESS);

  // Create metadata object with shares and pool info
  const metadataObj = {
    pool: POOL_ADDRESS,
    owner: USER_ADDRESS,
    shares: SHARES.toString(),
    updatedAt: Date.now()
  };
  const metadataBase64 = Buffer.from(JSON.stringify(metadataObj)).toString('base64');

  console.log('📝 Updating metadata...');
  console.log(`   Metadata: ${JSON.stringify(metadataObj, null, 2)}\n`);

  // First get existing account info to preserve name and description
  const accountsInfo = await client.client.getAccountsInfo([LP_STORAGE_ADDRESS]);
  const existingInfo = accountsInfo[LP_STORAGE_ADDRESS]?.info;

  // Update storage account info with new metadata (preserve existing name/description)
  builder.setInfo(
    {
      name: existingInfo?.name || 'SBLP',
      description: existingInfo?.description || 'Silverback LP',
      metadata: metadataBase64,
      defaultPermission: new KeetaNet.lib.Permissions([
        'ACCESS',
        'STORAGE_CAN_HOLD',
      ]),
    },
    { account: lpAccount }
  );

  await client.publishBuilder(builder);

  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`✅ Updated LP metadata on-chain!`);
  console.log(`   Shares: ${SHARES}`);
  console.log(`\n🔗 View on Explorer:`);
  console.log(`   https://explorer.test.keeta.com/account/${LP_STORAGE_ADDRESS}\n`);
}

main().catch(console.error);
