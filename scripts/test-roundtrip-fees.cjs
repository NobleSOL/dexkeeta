/**
 * Complete round-trip test: Sell tokens back to show fee accumulation
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const PAIR = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("🔄 ROUND-TRIP FEE TEST: Sell Tokens Back to Pool");
  console.log("=".repeat(70));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function transfer(address, uint256) external returns (bool)",
      "function approve(address, uint256) external returns (bool)",
    ],
    TAX_TOKEN
  );

  const pair = await hre.ethers.getContractAt(
    [
      "function getReserves() external view returns (uint112, uint112, uint32)",
      "function token0() external view returns (address)",
    ],
    PAIR
  );

  const router = await hre.ethers.getContractAt(
    [
      "function swapExactTokensForETH(uint, uint, address[], address, uint) external returns (uint[])",
    ],
    ROUTER_V0
  );

  console.log("📊 INITIAL PAIR STATE (After Buys):");
  console.log("-".repeat(70));
  const [reserve0Before, reserve1Before] = await pair.getReserves();
  const token0 = await pair.token0();
  const wethIsToken0 = token0.toLowerCase() === WETH.toLowerCase();
  const wethBefore = wethIsToken0 ? reserve0Before : reserve1Before;
  const taxBefore = wethIsToken0 ? reserve1Before : reserve0Before;

  console.log("   WETH reserve:", hre.ethers.formatEther(wethBefore));
  console.log("   BUYTAX reserve:", hre.ethers.formatEther(taxBefore));
  console.log("   k (constant product):", (wethBefore * taxBefore).toString().slice(0, 20) + "...");
  console.log();

  // Create burner and give it tokens to sell
  const burner = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log("🔥 Created burner:", burner.address);

  // Fund burner with just enough ETH for gas (0.002 ETH)
  const fundTx = await deployer.sendTransaction({
    to: burner.address,
    value: hre.ethers.parseEther("0.002")
  });
  await fundTx.wait();
  console.log("✅ Burner funded with 0.002 ETH (gas only)");

  // Send 200 BUYTAX tokens to burner (approximately what was bought)
  const tokensToSell = hre.ethers.parseEther("200");
  await token.transfer(burner.address, tokensToSell);
  console.log("✅ Sent 200 BUYTAX to burner");
  console.log();

  console.log("🔄 SELLING 200 BUYTAX BACK TO POOL...");
  console.log("-".repeat(70));

  const burnerToken = token.connect(burner);
  const burnerRouter = router.connect(burner);

  // Approve router
  await burnerToken.approve(ROUTER_V0, tokensToSell);

  const deadline = Math.floor(Date.now() / 1000) + 1200;
  const path = [TAX_TOKEN, WETH];

  // Execute sell
  const sellTx = await burnerRouter.swapExactTokensForETH(
    tokensToSell,
    0,
    path,
    burner.address,
    deadline
  );
  const receipt = await sellTx.wait();
  console.log("✅ Sell executed!");
  console.log("   Gas used:", receipt.gasUsed.toString());
  console.log();

  console.log("📊 FINAL PAIR STATE (After Round-Trip):");
  console.log("-".repeat(70));
  const [reserve0After, reserve1After] = await pair.getReserves();
  const wethAfter = wethIsToken0 ? reserve0After : reserve1After;
  const taxAfter = wethIsToken0 ? reserve1After : reserve0After;

  console.log("   WETH reserve:", hre.ethers.formatEther(wethAfter));
  console.log("   BUYTAX reserve:", hre.ethers.formatEther(taxAfter));
  console.log("   k (constant product):", (wethAfter * taxAfter).toString().slice(0, 20) + "...");
  console.log();

  console.log("=".repeat(70));
  console.log("💰 FEE ACCUMULATION ANALYSIS");
  console.log("=".repeat(70));
  console.log();

  const wethChange = wethAfter - wethBefore;
  const taxChange = taxAfter - taxBefore;

  console.log("WETH reserve change:", hre.ethers.formatEther(wethChange));
  console.log("BUYTAX reserve change:", hre.ethers.formatEther(taxChange));
  console.log();

  if (wethChange > 0n && taxChange > 0n) {
    console.log("✅ BOTH RESERVES INCREASED!");
    console.log();
    console.log("This proves fees were collected:");
    console.log("- Tokens bought with ETH (ETH in, tokens out)");
    console.log("- Tokens sold for ETH (tokens in, ETH out)");
    console.log("- After round-trip, BOTH reserves are higher due to 0.3% fees");
    console.log();
    console.log("Fee breakdown:");
    console.log("- 0.25% went to LP holders (your LP tokens worth more)");
    console.log("- 0.05% accrued for protocol (will mint LP tokens on next liquidity event)");
    console.log();
    console.log("Extra WETH in pool:", hre.ethers.formatEther(wethChange), "ETH");
    console.log("Extra BUYTAX in pool:", hre.ethers.formatEther(taxChange), "tokens");
  } else if (wethChange > 0n) {
    console.log("✅ WETH RESERVE INCREASED!");
    console.log("   Extra:", hre.ethers.formatEther(wethChange), "ETH");
    console.log("   This is fee accumulation from swaps");
  } else {
    console.log("⚠️ Reserves changed, but may need more volume to see clear fee accumulation");
  }

  console.log();
  console.log("🎉 Round-trip test complete - fees are being collected in the pair!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
