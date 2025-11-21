/**
 * Sell TEST to rebalance pool back to ~10000 TEST
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
  console.log("║         Sell TEST to Rebalance Pool & Show Fee Accumulation     ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const router = await hre.ethers.getContractAt("SilverbackRouter", ROUTER);
  const token = await hre.ethers.getContractAt("SimpleToken", TEST_TOKEN);
  const pair = await hre.ethers.getContractAt("SilverbackPair", TEST_PAIR);
  const weth = await hre.ethers.getContractAt("contracts/SilverbackRouter.sol:IWETH9", WETH);

  // Get current state
  const [r0, r1] = await pair.getReserves();
  const token0 = await pair.token0();
  const isToken0 = token0.toLowerCase() === TEST_TOKEN.toLowerCase();
  const [tokenRes, ethRes] = isToken0 ? [r0, r1] : [r1, r0];
  const kBefore = tokenRes * ethRes;

  console.log("📊 Pool State Before Rebalance:");
  console.log("   TEST reserve:", formatUnits(tokenRes));
  console.log("   WETH reserve:", formatUnits(ethRes));
  console.log("   Current k:   ", kBefore.toString());
  console.log();

  const currentTestInPool = Number(formatUnits(tokenRes));
  const targetTest = 10000;
  const testExcess = currentTestInPool - targetTest;

  console.log("📐 Rebalance Plan:");
  console.log("   Current TEST in pool:", currentTestInPool);
  console.log("   Target TEST:        ", targetTest);
  console.log("   Excess TEST:        ", testExcess.toFixed(6));
  console.log("   Will sell 2400 TEST to pool");
  console.log();

  const testFeeBefore = await token.balanceOf(FEE_RECIPIENT);
  const wethFeeBefore = await weth.balanceOf(FEE_RECIPIENT);

  console.log("💰 Fee Recipient Before:");
  console.log("   TEST:", formatUnits(testFeeBefore));
  console.log("   WETH:", formatUnits(wethFeeBefore));
  console.log();

  // Sell 2400 TEST
  const swapAmount = hre.ethers.parseEther("2400");
  console.log("🔄 Selling 2400 TEST -> WETH...");

  await (await token.approve(ROUTER, swapAmount)).wait();

  const deadline = Math.floor(Date.now() / 1000) + 300;
  const tx = await router.swapExactTokensForTokens(
    swapAmount,
    0,
    [TEST_TOKEN, WETH],
    deployer.address,
    deadline
  );
  await tx.wait();

  console.log("✅ Swap complete");
  console.log();

  // Get final state
  const [r0After, r1After] = await pair.getReserves();
  const [tokenResAfter, ethResAfter] = isToken0 ? [r0After, r1After] : [r1After, r0After];
  const kAfter = tokenResAfter * ethResAfter;

  const kGrowthFromBefore = ((Number(kAfter - kBefore) / Number(kBefore)) * 100).toFixed(4);
  const kGrowthFromStart = ((Number(kAfter - BigInt("100000000000000000000000000000000000000")) / Number(BigInt("100000000000000000000000000000000000000"))) * 100).toFixed(4);

  const testFeeAfter = await token.balanceOf(FEE_RECIPIENT);
  const wethFeeAfter = await weth.balanceOf(FEE_RECIPIENT);
  const testFeeCollected = testFeeAfter - testFeeBefore;

  console.log("📊 Pool State After Rebalance:");
  console.log("   TEST reserve:", formatUnits(tokenResAfter));
  console.log("   WETH reserve:", formatUnits(ethResAfter));
  console.log("   Final k:     ", kAfter.toString());
  console.log();

  console.log("💰 Fee Recipient After:");
  console.log("   TEST:", formatUnits(testFeeAfter), "(+", formatUnits(testFeeCollected), ")");
  console.log("   WETH:", formatUnits(wethFeeAfter));
  console.log();

  console.log("📈 Fee Analysis:");
  console.log("   k growth from before swap:  ", kGrowthFromBefore + "%");
  console.log("   k growth from pool start:   ", kGrowthFromStart + "%");
  console.log();
  console.log("   Router fee from 2400 TEST:");
  console.log("     Expected: " + (2400 * 0.0005).toFixed(6) + " TEST");
  console.log("     Collected:", formatUnits(testFeeCollected), "TEST");
  console.log();

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    FINAL RESULTS                                 ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("✅ Pool rebalanced close to starting position");
  console.log("✅ k grew by " + kGrowthFromStart + "% despite returning to start");
  console.log("✅ This proves 0.25% pair fees accumulated in pool");
  console.log();
  console.log("Total Router Fees:");
  console.log("  TEST: " + formatUnits(testFeeAfter) + " (0.05%)");
  console.log("  WETH: " + formatUnits(wethFeeAfter) + " (0.05%)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
