/**
 * Diagnose why swapBack isn't working
 */

const hre = require("hardhat");

const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const WETH = "0x4200000000000000000000000000000000000006";
const PAIR = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";

async function main() {
  console.log("🔍 Diagnosing SwapBack Issue");
  console.log("=".repeat(60));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function allowance(address, address) external view returns (uint256)",
      "function approve(address, uint256) external returns (bool)",
      "function router() external view returns (address)",
      "function isPair(address) external view returns (bool)",
      "function isExcludedFromTax(address) external view returns (bool)",
    ],
    TAX_TOKEN
  );

  const router = await hre.ethers.getContractAt(
    ["function factory() external view returns (address)"],
    ROUTER_V0
  );

  const pair = await hre.ethers.getContractAt(
    [
      "function token0() external view returns (address)",
      "function token1() external view returns (address)",
      "function getReserves() external view returns (uint112, uint112, uint32)",
    ],
    PAIR
  );

  console.log("📊 Contract State:");
  const contractBal = await token.balanceOf(TAX_TOKEN);
  console.log("   Token contract balance:", hre.ethers.formatEther(contractBal), "BUYTAX");

  const routerAddr = await token.router();
  console.log("   Router address in token:", routerAddr);
  console.log("   Expected router:", ROUTER_V0);
  console.log("   Match:", routerAddr.toLowerCase() === ROUTER_V0.toLowerCase() ? "✅" : "❌");

  const allowance = await token.allowance(TAX_TOKEN, ROUTER_V0);
  console.log("   Token allowance to router:", hre.ethers.formatEther(allowance), "BUYTAX");

  const isExcluded = await token.isExcludedFromTax(TAX_TOKEN);
  console.log("   Token contract excluded from tax:", isExcluded ? "✅" : "❌");

  const isPairRegistered = await token.isPair(PAIR);
  console.log("   Pair registered in token:", isPairRegistered ? "✅" : "❌");
  console.log();

  console.log("📊 Pair Reserves:");
  const token0 = await pair.token0();
  const token1 = await pair.token1();
  const [reserve0, reserve1] = await pair.getReserves();

  console.log("   Token0:", token0);
  console.log("   Token1:", token1);
  console.log("   Reserve0:", hre.ethers.formatEther(reserve0));
  console.log("   Reserve1:", hre.ethers.formatEther(reserve1));

  const taxTokenIsToken0 = token0.toLowerCase() === TAX_TOKEN.toLowerCase();
  const taxReserve = taxTokenIsToken0 ? reserve0 : reserve1;
  const wethReserve = taxTokenIsToken0 ? reserve1 : reserve0;

  console.log("   BUYTAX reserve:", hre.ethers.formatEther(taxReserve));
  console.log("   WETH reserve:", hre.ethers.formatEther(wethReserve));
  console.log();

  // Try a test approval
  console.log("🔧 Testing manual approval...");
  const approveTx = await token.approve(ROUTER_V0, hre.ethers.parseEther("1000"));
  await approveTx.wait();
  console.log("✅ Approval successful");

  const newAllowance = await token.allowance(deployer.address, ROUTER_V0);
  console.log("   New allowance (from deployer):", hre.ethers.formatEther(newAllowance), "BUYTAX");
  console.log();

  console.log("💡 Diagnosis:");
  if (contractBal === 0n) {
    console.log("   ❌ Contract has no tokens to swap");
  } else if (taxReserve < contractBal) {
    console.log("   ⚠️  Not enough liquidity in pair to swap contract balance");
    console.log(`      Need: ${hre.ethers.formatEther(contractBal)} BUYTAX`);
    console.log(`      Available: ${hre.ethers.formatEther(taxReserve)} BUYTAX`);
  } else {
    console.log("   ✅ Contract has tokens and pair has liquidity");
    console.log("   ℹ️  SwapBack should work if called correctly");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
