/**
 * Remove a tiny bit of liquidity to trigger protocol fee minting
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const PAIR = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("🔄 Triggering Protocol Fee Mint via Liquidity Removal");
  console.log("=".repeat(70));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const factory = await hre.ethers.getContractAt(
    ["function feeTo() external view returns (address)"],
    FACTORY_V0
  );

  const pair = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address, uint256) external returns (bool)",
      "function kLast() external view returns (uint256)",
      "function getReserves() external view returns (uint112, uint112, uint32)",
    ],
    PAIR
  );

  const router = await hre.ethers.getContractAt(
    [
      "function removeLiquidityETH(address, uint, uint, uint, address, uint) external returns (uint, uint)",
    ],
    ROUTER_V0
  );

  const feeTo = await factory.feeTo();

  console.log("📊 BEFORE Liquidity Removal:");
  console.log("-".repeat(70));

  const protocolLPBefore = await pair.balanceOf(feeTo);
  const deployerLPBefore = await pair.balanceOf(deployer.address);
  const kLastBefore = await pair.kLast();
  const [reserve0Before, reserve1Before] = await pair.getReserves();

  console.log("Protocol LP tokens (feeTo):", hre.ethers.formatEther(protocolLPBefore));
  console.log("Deployer LP tokens:", hre.ethers.formatEther(deployerLPBefore));
  console.log("kLast:", kLastBefore.toString());
  console.log("Current k:", (reserve0Before * reserve1Before).toString());
  console.log("k grew?", (reserve0Before * reserve1Before) > kLastBefore ? "YES ✅" : "NO");
  console.log();

  if (deployerLPBefore === 0n) {
    console.log("❌ You don't have any LP tokens to remove!");
    return;
  }

  // Remove 10% of LP tokens
  const lpToRemove = deployerLPBefore / 10n;
  console.log("🔄 Removing", hre.ethers.formatEther(lpToRemove), "LP tokens (~10% of your position)...");
  console.log();

  // Approve router
  await pair.approve(ROUTER_V0, lpToRemove);

  const deadline = Math.floor(Date.now() / 1000) + 1200;

  const removeTx = await router.removeLiquidityETH(
    TAX_TOKEN,
    lpToRemove,
    0, // accept any amount of tokens
    0, // accept any amount of ETH
    deployer.address,
    deadline
  );

  console.log("⏳ Waiting for transaction...");
  const receipt = await removeTx.wait();
  console.log("✅ Liquidity removed!");
  console.log("   Gas used:", receipt.gasUsed.toString());
  console.log();

  console.log("📊 AFTER Liquidity Removal:");
  console.log("-".repeat(70));

  const protocolLPAfter = await pair.balanceOf(feeTo);
  const deployerLPAfter = await pair.balanceOf(deployer.address);
  const kLastAfter = await pair.kLast();

  console.log("Protocol LP tokens (feeTo):", hre.ethers.formatEther(protocolLPAfter));
  console.log("Deployer LP tokens:", hre.ethers.formatEther(deployerLPAfter));
  console.log("kLast:", kLastAfter.toString());
  console.log();

  const protocolGained = protocolLPAfter - protocolLPBefore;

  console.log("=".repeat(70));
  console.log("💰 PROTOCOL FEE RESULT");
  console.log("=".repeat(70));

  if (protocolGained > 0n) {
    console.log("✅ Protocol received", hre.ethers.formatEther(protocolGained), "LP tokens!");
    console.log();
    console.log("This represents the 0.05% protocol fee from all swaps that happened");
    console.log("since liquidity was last added/removed.");
    console.log();
    console.log("The protocol can now:");
    console.log("1. Hold these LP tokens (earn fees on fees)");
    console.log("2. Remove liquidity to get underlying WETH + BUYTAX");
    console.log("3. Sell tokens for ETH");
  } else {
    console.log("⚠️ No protocol LP tokens minted");
    console.log();
    console.log("Possible reasons:");
    console.log("1. Not enough swaps happened to generate meaningful fees");
    console.log("2. k didn't grow enough (very small volume)");
    console.log("3. This might be the first liquidity event after creating the pair");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
