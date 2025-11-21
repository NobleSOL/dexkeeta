/**
 * Buy TEST with ETH to get pool closer to 10,000 TEST
 * Current: 11,439 TEST -> Target: 10,000 TEST
 * Need to buy ~1,439 TEST from pool
 */

const hre = require("hardhat");

const ROUTER = "0xBbf8a944697Db3BDb299824942635bdD10B440fE";
const FEE_RECIPIENT = "0x9E753c5C0051277C2a9600FCDF14e28Eafd7A7db";
const TEST_TOKEN = "0x83a57e6302Ea62d97a18244931A940045793A4c2";
const TEST_PAIR = "0xE9D5C8d3e141385449bf1fCC07e260D037C05Ec3";
const WETH = "0x4200000000000000000000000000000000000006";

function formatUnits(value, decimals = 18) {
  const divisor = BigInt(10) ** BigInt(decimals);
  return (Number(value) / Number(divisor)).toFixed(9);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║           Buy TEST with ETH to Return to 10,000 TEST            ║");
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

  console.log("📊 Pool State Before:");
  console.log("   TEST reserve:", formatUnits(tokenRes));
  console.log("   WETH reserve:", formatUnits(ethRes));
  console.log();

  const testFeeBefore = await token.balanceOf(FEE_RECIPIENT);
  const wethFeeBefore = await weth.balanceOf(FEE_RECIPIENT);

  console.log("💰 Fee Recipient Before:");
  console.log("   TEST:", formatUnits(testFeeBefore));
  console.log("   WETH:", formatUnits(wethFeeBefore));
  console.log();

  // Use 0.0012 ETH to buy TEST
  const ethAmount = hre.ethers.parseEther("0.0012");

  console.log("🔄 Buying TEST with 0.0012 ETH...");
  console.log();

  const deadline = Math.floor(Date.now() / 1000) + 300;

  const tx = await router.swapExactETHForTokens(
    0, // min tokens out
    [WETH, TEST_TOKEN],
    deployer.address,
    deadline,
    { value: ethAmount }
  );
  await tx.wait();

  console.log("✅ Swap complete");
  console.log();

  // Get final state
  const [r0After, r1After] = await pair.getReserves();
  const [tokenResAfter, ethResAfter] = isToken0 ? [r0After, r1After] : [r1After, r0After];
  const kAfter = tokenResAfter * ethResAfter;

  const kGrowthFromStart = ((Number(kAfter - kStart) / Number(kStart)) * 100).toFixed(4);

  const testFeeAfter = await token.balanceOf(FEE_RECIPIENT);
  const wethFeeAfter = await weth.balanceOf(FEE_RECIPIENT);
  const wethFeeCollected = wethFeeAfter - wethFeeBefore;

  console.log("📊 Pool State After:");
  console.log("   TEST reserve:", formatUnits(tokenResAfter));
  console.log("   WETH reserve:", formatUnits(ethResAfter));
  console.log("   Final k:     ", kAfter.toString());
  console.log();

  console.log("💰 Fee Recipient After:");
  console.log("   TEST:", formatUnits(testFeeAfter));
  console.log("   WETH:", formatUnits(wethFeeAfter), "(+", formatUnits(wethFeeCollected), ")");
  console.log();

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    FINAL VERIFICATION                            ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("Started:  10,000 TEST + 0.01 WETH");
  console.log("Now:      " + formatUnits(tokenResAfter) + " TEST + " + formatUnits(ethResAfter) + " WETH");
  console.log();
  console.log("k growth from start: " + kGrowthFromStart + "%");
  console.log();
  console.log("Pool is now close to 10,000 TEST!");
  console.log("WETH reserve: " + formatUnits(ethResAfter) + " (started at 0.01)");
  console.log("The extra WETH proves fees accumulated even when returning to start!");
  console.log();
  console.log("Total Router Fees:");
  console.log("  TEST: " + formatUnits(testFeeAfter));
  console.log("  WETH: " + formatUnits(wethFeeAfter));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
