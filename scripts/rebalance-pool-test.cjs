/**
 * Sell 2498.75 TEST to rebalance pool back to starting state
 * This proves fees accumulate even when pool composition returns to original
 */

const hre = require("hardhat");

const ROUTER = "0xBbf8a944697Db3BDb299824942635bdD10B440fE";
const FEE_RECIPIENT = "0x9E753c5C0051277C2a9600FCDF14e28Eafd7A7db";
const TEST_TOKEN = "0x83a57e6302Ea62d97a18244931A940045793A4c2";
const TEST_PAIR = "0xE9D5C8d3e141385449bf1fCC07e260D037C05Ec3";
const WETH = "0x4200000000000000000000000000000000000006";

function formatUnits(value, decimals = 18) {
  const divisor = BigInt(10) ** BigInt(decimals);
  return (Number(value) / Number(divisor)).toFixed(6);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║           Rebalancing Pool to Show Fee Accumulation             ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  const [deployer] = await hre.ethers.getSigners();
  console.log("Tester:", deployer.address);
  console.log();

  // Connect to contracts
  const router = await hre.ethers.getContractAt("SilverbackRouter", ROUTER);
  const token = await hre.ethers.getContractAt("SimpleToken", TEST_TOKEN);
  const pair = await hre.ethers.getContractAt("SilverbackPair", TEST_PAIR);
  const weth = await hre.ethers.getContractAt("contracts/SilverbackRouter.sol:IWETH9", WETH);

  // Get initial state (after 5 round-trip swaps)
  const [r0Before, r1Before] = await pair.getReserves();
  const token0 = await pair.token0();
  const isToken0 = token0.toLowerCase() === TEST_TOKEN.toLowerCase();
  const [tokenResBefore, ethResBefore] = isToken0 ? [r0Before, r1Before] : [r1Before, r0Before];
  const kBefore = tokenResBefore * ethResBefore;

  console.log("📊 State Before Rebalance Swap:");
  console.log("   TEST reserve:", formatUnits(tokenResBefore));
  console.log("   WETH reserve:", formatUnits(ethResBefore));
  console.log("   k =", kBefore.toString());
  console.log();

  // Get fee recipient balances before
  const testFeeBefore = await token.balanceOf(FEE_RECIPIENT);
  const wethFeeBefore = await weth.balanceOf(FEE_RECIPIENT);

  console.log("💰 Fee Recipient Before Rebalance:");
  console.log("   TEST:", formatUnits(testFeeBefore));
  console.log("   WETH:", formatUnits(wethFeeBefore));
  console.log();

  // Execute the rebalancing swap: 2498.75 TEST -> WETH
  const swapAmount = hre.ethers.parseEther("2498.75");
  console.log("🔄 Swapping 2498.75 TEST -> WETH to rebalance pool...");

  await (await token.approve(ROUTER, swapAmount)).wait();

  const deadline = Math.floor(Date.now() / 1000) + 300;
  await (await router.swapExactTokensForTokens(
    swapAmount,
    0,
    [TEST_TOKEN, WETH],
    deployer.address,
    deadline
  )).wait();

  console.log("✅ Rebalance swap complete");
  console.log();

  // Get final state
  const [r0After, r1After] = await pair.getReserves();
  const [tokenResAfter, ethResAfter] = isToken0 ? [r0After, r1After] : [r1After, r0After];
  const kAfter = tokenResAfter * ethResAfter;

  // Calculate changes
  const kGrowth = ((Number(kAfter - kBefore) / Number(kBefore)) * 100).toFixed(4);
  const kGrowthFromStart = ((Number(kAfter - BigInt("100000000000000000000000000000000000000")) / Number(BigInt("100000000000000000000000000000000000000"))) * 100).toFixed(4);

  console.log("📊 State After Rebalance:");
  console.log("   TEST reserve:", formatUnits(tokenResAfter));
  console.log("   WETH reserve:", formatUnits(ethResAfter));
  console.log("   k =", kAfter.toString());
  console.log();

  // Get fee recipient balances after
  const testFeeAfter = await token.balanceOf(FEE_RECIPIENT);
  const wethFeeAfter = await weth.balanceOf(FEE_RECIPIENT);
  const testFeeCollected = testFeeAfter - testFeeBefore;
  const wethFeeTotal = wethFeeAfter;

  console.log("💰 Fee Recipient After Rebalance:");
  console.log("   TEST:", formatUnits(testFeeAfter), "(+", formatUnits(testFeeCollected), "from this swap)");
  console.log("   WETH:", formatUnits(wethFeeTotal));
  console.log();

  console.log("📈 Analysis:");
  console.log("   k growth from before rebalance:", kGrowth + "%");
  console.log("   k growth from pool creation:   ", kGrowthFromStart + "%");
  console.log();
  console.log("   Expected router fee from 2498.75 TEST: " + (2498.75 * 0.0005).toFixed(6) + " TEST");
  console.log("   Actual router fee collected:           " + formatUnits(testFeeCollected) + " TEST");
  console.log();

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    KEY INSIGHT                                   ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("Even though pool reserves are back near starting position,");
  console.log("k has grown by " + kGrowthFromStart + "% - proving 0.25% fees were collected!");
  console.log();
  console.log("Total router fees collected:");
  console.log("  TEST: " + formatUnits(testFeeAfter) + " (0.05% of all TEST swaps)");
  console.log("  WETH: " + formatUnits(wethFeeTotal) + " (0.05% of all WETH swaps)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
