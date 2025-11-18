// Send LP tokens from pool account to user
import { getOpsClient, accountFromAddress } from './server/keeta-impl/utils/client.js';

const POOL_ADDRESS = 'keeta_atcf53xel35fz3j5ohtoxcqsn6iv43sdczkvxcl7zhgfgjqtraxkcbe64y4rg';
const LP_TOKEN_ADDRESS = 'keeta_apjds5jlnxr6azgxb7y4k5pqyi3hkahwkhkzxasvrv4v7kxxce4avnnck3hns';
const USER_ADDRESS = 'keeta_aabft2xc4mr6ueu2bpvt2mdkfoqlhr37egkvw3vss55lyxtc44m2jynbd4zdxzy';
const AMOUNT = 999999999000n;

console.log('\n📤 Sending LP tokens from pool to user...\n');
console.log(`From: ${POOL_ADDRESS}`);
console.log(`To: ${USER_ADDRESS}`);
console.log(`Token: ${LP_TOKEN_ADDRESS}`);
console.log(`Amount: ${AMOUNT}\n`);

try {
  const opsClient = await getOpsClient();
  const poolAccount = accountFromAddress(POOL_ADDRESS);
  const lpTokenAccount = accountFromAddress(LP_TOKEN_ADDRESS);
  const userAccount = accountFromAddress(USER_ADDRESS);

  const builder = opsClient.initBuilder();

  // Send LP tokens from pool to user (using OPS to send on behalf of pool)
  builder.send(
    userAccount,
    AMOUNT,
    lpTokenAccount,
    undefined,
    { account: poolAccount }
  );

  await opsClient.publishBuilder(builder);

  console.log('✅ Transaction published!\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
