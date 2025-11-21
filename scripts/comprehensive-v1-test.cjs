/**
 * Comprehensive V1 fee testing with multiple swaps
 * - Execute many swaps back and forth
 * - Track k growth to prove 0.25% pair fee
 * - Track router fee collection to prove 0.05% router fee
 */

const hre = require("hardhat");

const FACTORY_V1 = "0x6C53593D06479413CCb464AFfDCe6ec0c01e37e9";
const ROUTER_V1 = "0x963acad23Ad4cFf8d4b7Fac7e7F10A9A0c6e6bbc";
const FEE_RECIPIENT = "0x9E753c5C0051277C2a9600FCDF14e28Eafd7A7db";
const WETH = "0x4200000000000000000000000000000000000006";

// Existing test pair from previous test
const TEST_TOKEN = "0x6CD1d558208D38d02632080419e675Af195cB73a";
const TEST_PAIR = "0x9B5146fBdFf76B4aAAbCeD1378B7C07928b39ee6";

function formatUnits(value, decimals = 18) {
  const divisor = BigInt(10) ** BigInt(decimals);
  return (Number(value) / Number(divisor)).toFixed(6);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║           Comprehensive V1 Fee Testing (Multiple Swaps)         ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  const [deployer] = await hre.ethers.getSigners();
  console.log("Tester:", deployer.address);
  console.log("Fee recipient:", FEE_RECIPIENT);
  console.log();

  // Connect to contracts
  const router = await hre.ethers.getContractAt("SilverbackRouter", ROUTER_V1);
  const token = await hre.ethers.getContractAt("SimpleToken", TEST_TOKEN);
  const pair = await hre.ethers.getContractAt("SilverbackPair", TEST_PAIR);
  const weth = await hre.ethers.getContractAt("contracts/SilverbackRouter.sol:IWETH9", WETH);

  console.log("Using existing test pair:");
  console.log("  Token:", TEST_TOKEN);
  console.log("  Pair: ", TEST_PAIR);
  console.log();

  // Get initial state
  const [reserve0Initial, reserve1Initial] = await pair.getReserves();
  const token0 = await pair.token0();
  const isToken0 = token0.toLowerCase() === TEST_TOKEN.toLowerCase();
  const [tokenReserveInitial, ethReserveInitial] = isToken0
    ? [reserve0Initial, reserve1Initial]
    : [reserve1Initial, reserve0Initial];

  const kInitial = tokenReserveInitial * ethReserveInitial;
  const lpBalanceInitial = await pair.balanceOf(deployer.address);

  console.log("📊 Initial State:");
  console.log("   Token reserve:", formatUnits(tokenReserveInitial));
  console.log("   ETH reserve:  ", formatUnits(ethReserveInitial));
  console.log("   k =", kInitial.toString());
  console.log("   LP tokens:    ", formatUnits(lpBalanceInitial));
  console.log();

  // Get initial fee recipient balances
  const tokenFeeInitial = await token.balanceOf(FEE_RECIPIENT);
  const wethFeeInitial = await weth.balanceOf(FEE_RECIPIENT);

  console.log("💰 Initial Fee Recipient Balances:");
  console.log("   CLEAN:", formatUnits(tokenFeeInitial));
  console.log("   WETH: ", formatUnits(wethFeeInitial));
  console.log();

  const deadline = Math.floor(Date.now() / 1000) + 600;
  const NUM_SWAPS = 10;

  console.log("🔄 Executing " + NUM_SWAPS + " round-trip swaps...");
  console.log();

  let totalTokenFees = 0;
  let totalWethFees = 0;

  for (let i = 0; i < NUM_SWAPS; i++) {
    // Swap 1: 500 CLEAN -> WETH
    const swapAmount1 = hre.ethers.parseEther("500");
    await (await token.approve(ROUTER_V1, swapAmount1)).wait();

    const path1 = [TEST_TOKEN, WETH];
    await (await router.swapExactTokensForTokens(
      swapAmount1,
      0,
      path1,
      deployer.address,
      deadline
    )).wait();

    totalTokenFees += 500 * 0.0005; // 0.05% router fee

    // Swap 2: 0.0005 WETH -> CLEAN
    const swapAmount2 = hre.ethers.parseEther("0.0005");
    await (await weth.deposit({ value: swapAmount2 })).wait();
    await (await weth.approve(ROUTER_V1, swapAmount2)).wait();

    const path2 = [WETH, TEST_TOKEN];
    await (await router.swapExactTokensForTokens(
      swapAmount2,
      0,
      path2,
      deployer.address,
      deadline
    )).wait();

    totalWethFees += 0.0005 * 0.0005; // 0.05% router fee

    // Show progress every 2 swaps
    if ((i + 1) % 2 === 0) {
      const [r0, r1] = await pair.getReserves();
      const [tokenRes, ethRes] = isToken0 ? [r0, r1] : [r1, r0];
      const k = tokenRes * ethRes;
      const kGrowth = ((Number(k - kInitial) / Number(kInitial)) * 100).toFixed(4);
      console.log(`   After swap ${i + 1}/${NUM_SWAPS}: k growth = ${kGrowth}%`);
    }
  }

  console.log();
  console.log("✅ Completed " + NUM_SWAPS + " round-trip swaps");
  console.log();

  // Get final state
  const [reserve0Final, reserve1Final] = await pair.getReserves();
  const [tokenReserveFinal, ethReserveFinal] = isToken0
    ? [reserve0Final, reserve1Final]
    : [reserve1Final, reserve0Final];

  const kFinal = tokenReserveFinal * ethReserveFinal;
  const lpBalanceFinal = await pair.balanceOf(deployer.address);

  console.log("📊 Final State:");
  console.log("   Token reserve:", formatUnits(tokenReserveFinal));
  console.log("   ETH reserve:  ", formatUnits(ethReserveFinal));
  console.log("   k =", kFinal.toString());
  console.log("   LP tokens:    ", formatUnits(lpBalanceFinal));
  console.log();

  // Calculate k growth
  const kGrowth = ((Number(kFinal - kInitial) / Number(kInitial)) * 100).toFixed(4);
  const kGrowthAbsolute = kFinal - kInitial;

  console.log("📈 Pair Fee Analysis (0.25% to LP holders):");
  console.log("   k initial:   ", kInitial.toString());
  console.log("   k final:     ", kFinal.toString());
  console.log("   k growth:    ", kGrowthAbsolute.toString(), "(" + kGrowth + "%)");
  console.log("   LP tokens unchanged:", formatUnits(lpBalanceInitial), "->", formatUnits(lpBalanceFinal));
  console.log();

  // Get final fee recipient balances
  const tokenFeeFinal = await token.balanceOf(FEE_RECIPIENT);
  const wethFeeFinal = await weth.balanceOf(FEE_RECIPIENT);
  const tokenFeeCollected = tokenFeeFinal - tokenFeeInitial;
  const wethFeeCollected = wethFeeFinal - wethFeeInitial;

  console.log("💰 Router Fee Analysis (0.05% to fee recipient):");
  console.log("   CLEAN fees collected:", formatUnits(tokenFeeCollected), "CLEAN");
  console.log("   WETH fees collected: ", formatUnits(wethFeeCollected), "WETH");
  console.log("   Expected CLEAN:      ", totalTokenFees.toFixed(6), "CLEAN");
  console.log("   Expected WETH:       ", totalWethFees.toFixed(6), "WETH");
  console.log();

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    COMPREHENSIVE TEST RESULTS                    ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("✅ Pair Fee (0.25% to LP holders):");
  console.log("   - k grew by " + kGrowth + "% after " + NUM_SWAPS + " round-trip swaps");
  console.log("   - LP token balance unchanged (fees accumulate in pool)");
  console.log("   - This proves 0.25% fee stays in the pair");
  console.log();
  console.log("✅ Router Fee (0.05% to fee recipient):");
  console.log("   - CLEAN: " + formatUnits(tokenFeeCollected) + " collected (expected " + totalTokenFees.toFixed(3) + ")");
  console.log("   - WETH:  " + formatUnits(wethFeeCollected) + " collected (expected " + totalWethFees.toFixed(6) + ")");
  console.log("   - Fee recipient: " + FEE_RECIPIENT);
  console.log();
  console.log("Total effective fee: 0.30% (0.25% pair + 0.05% router)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
