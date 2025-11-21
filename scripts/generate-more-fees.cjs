/**
 * Generate more fees with larger swaps, then trigger protocol fee mint
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const TOKEN = "0x248dDcdf83D5CADC0298529d7439f9Aa94D98141";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║         Generating More Fees + Triggering Protocol Mint         ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const factory = await hre.ethers.getContractAt(
    [
      "function getPair(address, address) external view returns (address)",
      "function feeTo() external view returns (address)"
    ],
    FACTORY_V0
  );

  const pairAddress = await factory.getPair(TOKEN, WETH);
  const feeTo = await factory.feeTo();

  const pair = await hre.ethers.getContractAt(
    [
      "function getReserves() external view returns (uint112, uint112, uint32)",
      "function token0() external view returns (address)",
      "function kLast() external view returns (uint256)",
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address, uint256) external returns (bool)"
    ],
    pairAddress
  );

  const router = await hre.ethers.getContractAt(
    [
      "function swapExactETHForTokens(uint, address[], address, uint) external payable returns (uint[])",
      "function swapExactTokensForETH(uint, uint, address[], address, uint) external returns (uint[])",
      "function removeLiquidityETH(address, uint, uint, uint, address, uint) external returns (uint, uint)"
    ],
    ROUTER_V0
  );

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address, uint256) external returns (bool)"
    ],
    TOKEN
  );

  // Get initial state
  const token0 = await pair.token0();
  const wethIsToken0 = token0.toLowerCase() === WETH.toLowerCase();
  const [r0Initial, r1Initial] = await pair.getReserves();
  const kLastInitial = await pair.kLast();
  const totalSupplyInitial = await pair.totalSupply();
  const protocolLPInitial = await pair.balanceOf(feeTo);

  console.log("📊 INITIAL STATE:");
  console.log("─".repeat(70));
  console.log("  kLast:", kLastInitial.toString().slice(0, 40) + "...");
  console.log("  Total LP supply:", hre.ethers.formatEther(totalSupplyInitial));
  console.log("  Protocol LP:", hre.ethers.formatEther(protocolLPInitial));
  console.log();

  // Approve token
  await token.approve(ROUTER_V0, hre.ethers.parseEther("1000000"));

  // Do 10 larger swaps
  console.log("🔄 Performing 10 round-trip swaps with 0.001 ETH each...");
  console.log("─".repeat(70));

  for (let i = 0; i < 10; i++) {
    process.stdout.write(`  Swap ${i + 1}/10... `);

    // Buy with 0.001 ETH
    const buyTx = await router.swapExactETHForTokens(
      0,
      [WETH, TOKEN],
      deployer.address,
      Math.floor(Date.now() / 1000) + 1200,
      { value: hre.ethers.parseEther("0.001") }
    );
    await buyTx.wait();

    // Sell half back
    const balance = await token.balanceOf(deployer.address);
    const toSell = balance / 2n;

    if (toSell > 0n) {
      try {
        const sellTx = await router.swapExactTokensForETH(
          toSell,
          0,
          [TOKEN, WETH],
          deployer.address,
          Math.floor(Date.now() / 1000) + 1200
        );
        await sellTx.wait();
        console.log("✅");
      } catch (error) {
        console.log("⚠️ (sell failed)");
      }
    }
  }

  // Check k growth
  const [r0AfterSwaps, r1AfterSwaps] = await pair.getReserves();
  const wethAfterSwaps = wethIsToken0 ? r0AfterSwaps : r1AfterSwaps;
  const tokenAfterSwaps = wethIsToken0 ? r1AfterSwaps : r0AfterSwaps;
  const kAfterSwaps = wethAfterSwaps * tokenAfterSwaps;
  const kGrowth = ((Number(kAfterSwaps - kLastInitial) / Number(kLastInitial)) * 100);

  console.log();
  console.log("📈 After swaps:");
  console.log("  k grew by:", kGrowth.toFixed(6), "%");
  console.log();

  // Now trigger protocol fee mint
  console.log("🔄 Triggering Protocol Fee Mint...");
  console.log("─".repeat(70));

  const deployerLP = await pair.balanceOf(deployer.address);
  const lpToRemove = deployerLP / 20n; // 5%

  console.log("  Removing", hre.ethers.formatEther(lpToRemove), "LP tokens");
  console.log();

  await pair.approve(ROUTER_V0, lpToRemove);

  const removeTx = await router.removeLiquidityETH(
    TOKEN,
    lpToRemove,
    0,
    0,
    deployer.address,
    Math.floor(Date.now() / 1000) + 1200
  );

  await removeTx.wait();
  console.log("✅ Liquidity removed!");
  console.log();

  // Check results
  const totalSupplyAfter = await pair.totalSupply();
  const protocolLPAfter = await pair.balanceOf(feeTo);
  const protocolGained = protocolLPAfter - protocolLPInitial;

  // Calculate what the gain SHOULD be (net of the removal)
  const supplyChange = totalSupplyAfter - totalSupplyInitial;
  const removedFromSupply = totalSupplyInitial - totalSupplyAfter;

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    PROTOCOL FEE RESULTS                          ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  console.log("📊 LP Token Changes:");
  console.log("─".repeat(70));
  console.log("  Total supply before:", hre.ethers.formatEther(totalSupplyInitial));
  console.log("  Total supply after: ", hre.ethers.formatEther(totalSupplyAfter));
  console.log("  Supply decreased by:", hre.ethers.formatEther(totalSupplyInitial - totalSupplyAfter));
  console.log();
  console.log("  Protocol LP before:  ", hre.ethers.formatEther(protocolLPInitial));
  console.log("  Protocol LP after:   ", hre.ethers.formatEther(protocolLPAfter));
  console.log("  Protocol change:     ", protocolGained > 0n ? "+" : "", hre.ethers.formatEther(protocolGained));
  console.log();

  console.log("💡 EXPLANATION:");
  console.log("─".repeat(70));

  // The actual minted amount is the difference between what was removed and the total supply change
  const actualMinted = (totalSupplyInitial - totalSupplyAfter) - lpToRemove;

  if (actualMinted > 0n) {
    console.log("  ✅ Protocol fee was minted!");
    console.log();
    console.log("  We removed:", hre.ethers.formatEther(lpToRemove), "LP");
    console.log("  Total supply decreased by:", hre.ethers.formatEther(totalSupplyInitial - totalSupplyAfter));
    console.log("  Difference (protocol mint):", hre.ethers.formatEther(actualMinted));
    console.log();
    console.log("  This", hre.ethers.formatEther(actualMinted), "LP represents the 0.05% protocol fee!");
  } else {
    console.log("  Total supply decreased by exactly the amount we removed.");
    console.log("  This means NO new LP tokens were minted for protocol fees.");
    console.log();
    console.log("  Even with", kGrowth.toFixed(6), "% k growth,");
    console.log("  the protocol fee (1/6th of growth) was too small to mint.");
    console.log();
    console.log("  This pool needs more volume before protocol fees become significant.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
