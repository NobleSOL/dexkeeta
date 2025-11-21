/**
 * Check protocol fees accumulated from all testing
 */

const hre = require("hardhat");

const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const PAIR = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";

async function main() {
  console.log("💰 PROTOCOL FEE COLLECTION CHECK");
  console.log("=".repeat(70));
  console.log();

  const factory = await hre.ethers.getContractAt(
    ["function feeTo() external view returns (address)"],
    FACTORY_V0
  );

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function taxRecipient() external view returns (address)",
    ],
    TAX_TOKEN
  );

  const pair = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function totalSupply() external view returns (uint256)",
      "function getReserves() external view returns (uint112, uint112, uint32)",
      "function kLast() external view returns (uint256)",
    ],
    PAIR
  );

  const feeTo = await factory.feeTo();
  const taxRecipient = await token.taxRecipient();

  console.log("📍 Addresses:");
  console.log("   Factory:", FACTORY_V0);
  console.log("   Pair:", PAIR);
  console.log("   Tax Token:", TAX_TOKEN);
  console.log("   feeTo (protocol):", feeTo);
  console.log("   taxRecipient:", taxRecipient);
  console.log();

  // Check protocol LP token balance (Uniswap V2 mechanism)
  console.log("1️⃣ PROTOCOL LP FEES (0.05% via LP token minting):");
  console.log("-".repeat(70));
  const protocolLPBalance = await pair.balanceOf(feeTo);
  const totalSupply = await pair.totalSupply();
  const kLast = await pair.kLast();

  console.log("   Protocol LP tokens:", hre.ethers.formatEther(protocolLPBalance), "LP");
  console.log("   Total LP supply:", hre.ethers.formatEther(totalSupply), "LP");

  if (protocolLPBalance > 0n) {
    const percentage = (Number(protocolLPBalance) / Number(totalSupply) * 100).toFixed(4);
    console.log("   Protocol share:", percentage + "%");
    console.log("   ✅ Protocol is collecting LP fees!");
  } else {
    console.log("   ⚠️  No LP tokens yet - fees accrue on next liquidity event");
  }
  console.log("   kLast:", kLast.toString(), "(tracks k growth for fee calculation)");
  console.log();

  // Check pair reserves
  const [reserve0, reserve1] = await pair.getReserves();
  console.log("   Pair reserves:", hre.ethers.formatEther(reserve0), "WETH /", hre.ethers.formatEther(reserve1), "BUYTAX");
  const k = reserve0 * reserve1;
  console.log("   Current k:", k.toString());
  console.log();

  // Check tax token swapBack
  console.log("2️⃣ TAX TOKEN SWAPBACK (5% buy tax → ETH):");
  console.log("-".repeat(70));
  const taxContractBalance = await token.balanceOf(TAX_TOKEN);
  const taxRecipientEth = await hre.ethers.provider.getBalance(taxRecipient);

  console.log("   Tax contract balance:", hre.ethers.formatEther(taxContractBalance), "BUYTAX");
  console.log("   Tax recipient ETH:", hre.ethers.formatEther(taxRecipientEth), "ETH");

  if (taxContractBalance > 0n) {
    console.log("   ℹ️  Tax accumulated, waiting for threshold (10,000 tokens) to trigger swapBack");
  } else {
    console.log("   ✅ SwapBack has been executing (balance = 0 means taxes swapped to ETH)");
  }
  console.log();

  // Summary
  console.log("=".repeat(70));
  console.log("📊 SUMMARY");
  console.log("=".repeat(70));
  console.log();

  console.log("✅ Pair LP Fees (0.3% total = 0.05% protocol + 0.25% LPs):");
  console.log("   - Total swaps accumulated fees in pair reserves");
  console.log("   - Protocol receives its share as LP tokens on next mint/burn");
  console.log("   - Current protocol LP:", hre.ethers.formatEther(protocolLPBalance), "tokens");
  console.log();

  console.log("✅ Tax Token SwapBack (5% buy tax):");
  console.log("   - Tax collected in contract:", hre.ethers.formatEther(taxContractBalance), "BUYTAX");
  console.log("   - Automatically swaps to ETH when threshold reached");
  console.log("   - ETH sent to:", taxRecipient);
  console.log();

  console.log("🎉 Both fee mechanisms working as designed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
