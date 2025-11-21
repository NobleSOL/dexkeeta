/**
 * Manually trigger swapBack on tax token to see it convert tokens → ETH
 */

const hre = require("hardhat");

const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";

async function main() {
  console.log("🔄 Manually Triggering SwapBack");
  console.log("=".repeat(60));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function owner() external view returns (address)",
      "function taxRecipient() external view returns (address)",
      "function manualSwapBack() external",
    ],
    TAX_TOKEN
  );

  console.log("Token:", TAX_TOKEN);
  const owner = await token.owner();
  console.log("Owner:", owner);
  console.log("Deployer:", deployer.address);
  console.log();

  // Check balances before
  const contractBalBefore = await token.balanceOf(TAX_TOKEN);
  const taxRecipient = await token.taxRecipient();
  const recipientEthBefore = await hre.ethers.provider.getBalance(taxRecipient);

  console.log("📊 BEFORE SwapBack:");
  console.log("   Contract token balance:", hre.ethers.formatEther(contractBalBefore), "BUYTAX");
  console.log("   Tax recipient:", taxRecipient);
  console.log("   Tax recipient ETH:", hre.ethers.formatEther(recipientEthBefore), "ETH");
  console.log();

  // Trigger swapBack
  console.log("⚡ Triggering swapBack...");
  const swapTx = await token.manualSwapBack();
  const swapReceipt = await swapTx.wait();

  console.log("✅ SwapBack executed!");
  console.log("   Gas used:", swapReceipt.gasUsed.toString());
  console.log("   Tx:", swapReceipt.hash);
  console.log();

  // Check balances after
  const contractBalAfter = await token.balanceOf(TAX_TOKEN);
  const recipientEthAfter = await hre.ethers.provider.getBalance(taxRecipient);

  const tokensSold = contractBalBefore - contractBalAfter;
  const ethReceived = recipientEthAfter - recipientEthBefore;

  console.log("📊 AFTER SwapBack:");
  console.log("   Contract token balance:", hre.ethers.formatEther(contractBalAfter), "BUYTAX");
  console.log("   Tax recipient ETH:", hre.ethers.formatEther(recipientEthAfter), "ETH");
  console.log();

  console.log("💰 SwapBack Results:");
  console.log("   Tokens sold:", hre.ethers.formatEther(tokensSold), "BUYTAX");
  console.log("   ETH received:", hre.ethers.formatEther(ethReceived), "ETH");

  if (tokensSold > 0n && ethReceived > 0n) {
    console.log("   ✅ SwapBack successfully converted tokens to ETH!");
  } else if (tokensSold === 0n) {
    console.log("   ℹ️  No tokens to swap (contract balance was 0 or swap failed)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
