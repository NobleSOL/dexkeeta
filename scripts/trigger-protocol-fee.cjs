/**
 * Trigger protocol fee minting by removing liquidity
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const TOKEN = "0x248dDcdf83D5CADC0298529d7439f9Aa94D98141";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║              Triggering Protocol Fee Mint (0.05%)                ║");
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

  console.log("Pair:", pairAddress);
  console.log("Protocol fee recipient (feeTo):", feeTo);
  console.log();

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
      "function removeLiquidityETH(address, uint, uint, uint, address, uint) external returns (uint, uint)"
    ],
    ROUTER_V0
  );

  // Check state before
  const [r0Before, r1Before] = await pair.getReserves();
  const token0 = await pair.token0();
  const wethIsToken0 = token0.toLowerCase() === WETH.toLowerCase();
  const wethBefore = wethIsToken0 ? r0Before : r1Before;
  const tokenBefore = wethIsToken0 ? r1Before : r0Before;
  const kBefore = wethBefore * tokenBefore;
  const kLast = await pair.kLast();
  const totalSupply = await pair.totalSupply();
  const protocolLPBefore = await pair.balanceOf(feeTo);
  const deployerLPBefore = await pair.balanceOf(deployer.address);

  console.log("📊 BEFORE TRIGGERING:");
  console.log("─".repeat(70));
  console.log("Reserves:");
  console.log("  WETH:   ", hre.ethers.formatEther(wethBefore));
  console.log("  CLEAN:  ", hre.ethers.formatEther(tokenBefore));
  console.log();
  console.log("k tracking:");
  console.log("  Current k:", kBefore.toString().slice(0, 40) + "...");
  console.log("  kLast:   ", kLast.toString().slice(0, 40) + "...");
  console.log("  k grew:  ", kBefore > kLast ? "YES ✅" : "NO");
  console.log("  Growth:  ", ((Number(kBefore - kLast) / Number(kLast)) * 100).toFixed(6), "%");
  console.log();
  console.log("LP tokens:");
  console.log("  Total supply:    ", hre.ethers.formatEther(totalSupply));
  console.log("  Protocol (feeTo):", hre.ethers.formatEther(protocolLPBefore));
  console.log("  Your balance:    ", hre.ethers.formatEther(deployerLPBefore));
  console.log();

  if (kBefore <= kLast) {
    console.log("⚠️ k has not grown since last liquidity event");
    console.log("   No protocol fees to mint");
    return;
  }

  if (deployerLPBefore === 0n) {
    console.log("❌ You don't have any LP tokens to remove");
    return;
  }

  // Remove 5% of LP to trigger fee mint
  const lpToRemove = deployerLPBefore / 20n; // 5%
  console.log("🔄 Removing", hre.ethers.formatEther(lpToRemove), "LP tokens (5% of your position)");
  console.log("   This will trigger the protocol fee mint...");
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

  console.log("⏳ Waiting for transaction...");
  const receipt = await removeTx.wait();
  console.log("✅ Transaction complete!");
  console.log("   Gas used:", receipt.gasUsed.toString());
  console.log();

  // Check state after
  const protocolLPAfter = await pair.balanceOf(feeTo);
  const deployerLPAfter = await pair.balanceOf(deployer.address);
  const totalSupplyAfter = await pair.totalSupply();
  const kLastAfter = await pair.kLast();

  const protocolGained = protocolLPAfter - protocolLPBefore;
  const deployerLost = deployerLPBefore - deployerLPAfter;

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    PROTOCOL FEE RESULTS                          ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  console.log("📊 AFTER TRIGGERING:");
  console.log("─".repeat(70));
  console.log("LP tokens:");
  console.log("  Total supply:    ", hre.ethers.formatEther(totalSupplyAfter));
  console.log("  Protocol (feeTo):", hre.ethers.formatEther(protocolLPAfter));
  console.log("  Your balance:    ", hre.ethers.formatEther(deployerLPAfter));
  console.log();
  console.log("  kLast updated:   ", kLastAfter.toString().slice(0, 40) + "...");
  console.log();

  console.log("💰 CHANGES:");
  console.log("─".repeat(70));
  console.log("  Protocol gained: ", hre.ethers.formatEther(protocolGained), "LP tokens");
  console.log("  You removed:     ", hre.ethers.formatEther(deployerLost), "LP tokens");
  console.log();

  if (protocolGained > 0n) {
    const protocolSharePercent = (Number(protocolLPAfter) / Number(totalSupplyAfter)) * 100;

    console.log("✅ PROTOCOL FEE MINTED!");
    console.log();
    console.log("  The protocol (feeTo address) received", hre.ethers.formatEther(protocolGained), "LP tokens.");
    console.log("  This represents the 0.05% protocol fee from all swaps since last mint.");
    console.log();
    console.log("  Protocol now owns", protocolSharePercent.toFixed(6), "% of the pool");
    console.log();
    console.log("  The protocol can:");
    console.log("    1. Hold these LP tokens and earn fees automatically");
    console.log("    2. Remove liquidity to get underlying WETH + CLEAN");
    console.log("    3. Sell the tokens for ETH");
    console.log();
    console.log("🎉 V0 contracts are collecting 0.05% protocol fees correctly!");
  } else {
    console.log("⚠️ No protocol LP tokens minted");
    console.log();
    console.log("  Possible reasons:");
    console.log("    1. k growth was too small (very low volume)");
    console.log("    2. Rounding caused the mint amount to be 0");
    console.log();
    console.log("  Try doing more swaps to generate more fees.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
