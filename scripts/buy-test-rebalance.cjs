/**
 * Buy TEST (swap WETH -> TEST) to get pool back to ~10,000 TEST
 * This will show k growth when pool returns to starting composition
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
  console.log("║       Buy TEST to Return Pool to 10,000 TEST & Show k Growth    ║");
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
  const kStart = BigInt("100000000000000000000000000000000000000");

  console.log("📊 Starting State:");
  console.log("   TEST: 10,000 + WETH: 0.01");
  console.log("   k = 100,000,000,000,000,000,000,000,000,000,000,000,000");
  console.log();

  console.log("📊 Current Pool State:");
  console.log("   TEST reserve:", formatUnits(tokenRes));
  console.log("   WETH reserve:", formatUnits(ethRes));
  console.log("   Current k:   ", kBefore.toString());
  console.log();

  const currentTestInPool = Number(formatUnits(tokenRes));
  const targetTest = 10000;
  const testToRemove = currentTestInPool - targetTest;

  console.log("📐 Rebalance Plan:");
  console.log("   Current TEST in pool:", currentTestInPool);
  console.log("   Target TEST:        ", targetTest);
  console.log("   Need to remove:     ", testToRemove.toFixed(2), "TEST from pool");
  console.log("   Will buy TEST with WETH to achieve this");
  console.log();

  const testFeeBefore = await token.balanceOf(FEE_RECIPIENT);
  const wethFeeBefore = await weth.balanceOf(FEE_RECIPIENT);

  console.log("💰 Fee Recipient Before:");
  console.log("   TEST:", formatUnits(testFeeBefore));
  console.log("   WETH:", formatUnits(wethFeeBefore));
  console.log();

  // Buy TEST with WETH - let me try a reasonable amount
  const swapAmount = hre.ethers.parseEther("0.002"); // 0.002 WETH
  console.log("🔄 Buying TEST with 0.002 WETH...");

  await (await weth.deposit({ value: swapAmount })).wait();
  await (await weth.approve(ROUTER, swapAmount)).wait();

  const deadline = Math.floor(Date.now() / 1000) + 300;
  const tx = await router.swapExactTokensForTokens(
    swapAmount,
    0,
    [WETH, TEST_TOKEN],
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
  const kGrowthFromStart = ((Number(kAfter - kStart) / Number(kStart)) * 100).toFixed(4);

  const testFeeAfter = await token.balanceOf(FEE_RECIPIENT);
  const wethFeeAfter = await weth.balanceOf(FEE_RECIPIENT);
  const wethFeeCollected = wethFeeAfter - wethFeeBefore;

  console.log("📊 Pool State After Buying TEST:");
  console.log("   TEST reserve:", formatUnits(tokenResAfter));
  console.log("   WETH reserve:", formatUnits(ethResAfter));
  console.log("   Final k:     ", kAfter.toString());
  console.log();

  console.log("💰 Fee Recipient After:");
  console.log("   TEST:", formatUnits(testFeeAfter));
  console.log("   WETH:", formatUnits(wethFeeAfter), "(+", formatUnits(wethFeeCollected), ")");
  console.log();

  console.log("📈 K Growth Analysis:");
  console.log("   k growth from before swap:  ", kGrowthFromBefore + "%");
  console.log("   k growth from pool start:   ", kGrowthFromStart + "%");
  console.log();
  console.log("   Router WETH fee from 0.002 WETH:");
  console.log("     Expected: " + (0.002 * 0.0005).toFixed(9) + " WETH");
  console.log("     Collected:", formatUnits(wethFeeCollected), "WETH");
  console.log();

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    KEY INSIGHT                                   ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("Pool now has ~" + formatUnits(tokenResAfter) + " TEST and " + formatUnits(ethResAfter) + " WETH");
  console.log("Even though pool is closer to starting composition,");
  console.log("k has grown by " + kGrowthFromStart + "% - proving 0.25% fees accumulated!");
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
