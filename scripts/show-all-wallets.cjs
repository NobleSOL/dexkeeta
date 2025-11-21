/**
 * Show all wallet addresses and what they hold
 */

const hre = require("hardhat");

const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const PAIR = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";

async function main() {
  console.log("👛 ALL WALLETS & BALANCES");
  console.log("=".repeat(70));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const factory = await hre.ethers.getContractAt(
    ["function feeTo() external view returns (address)"],
    FACTORY_V0
  );

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function owner() external view returns (address)",
      "function taxRecipient() external view returns (address)",
    ],
    TAX_TOKEN
  );

  const pair = await hre.ethers.getContractAt(
    ["function balanceOf(address) external view returns (uint256)"],
    PAIR
  );

  const feeTo = await factory.feeTo();
  const taxRecipient = await token.taxRecipient();
  const tokenOwner = await token.owner();

  console.log("1️⃣ DEPLOYER ADDRESS:");
  console.log("   Address:", deployer.address);
  const deployerEth = await hre.ethers.provider.getBalance(deployer.address);
  const deployerTaxTokens = await token.balanceOf(deployer.address);
  const deployerLP = await pair.balanceOf(deployer.address);

  console.log("   ETH:", hre.ethers.formatEther(deployerEth));
  console.log("   BUYTAX tokens:", hre.ethers.formatEther(deployerTaxTokens));
  console.log("   LP tokens:", hre.ethers.formatEther(deployerLP));
  console.log();

  console.log("2️⃣ PROTOCOL FEE RECIPIENT (feeTo):");
  console.log("   Address:", feeTo);
  const feeToLP = await pair.balanceOf(feeTo);
  console.log("   LP tokens:", hre.ethers.formatEther(feeToLP));
  console.log("   ℹ️  Is this the deployer?", feeTo.toLowerCase() === deployer.address.toLowerCase() ? "YES ✅" : "NO");
  console.log();

  console.log("3️⃣ TAX TOKEN OWNER:");
  console.log("   Address:", tokenOwner);
  console.log("   ℹ️  Is this the deployer?", tokenOwner.toLowerCase() === deployer.address.toLowerCase() ? "YES ✅" : "NO");
  console.log();

  console.log("4️⃣ TAX RECIPIENT (receives ETH from swapBack):");
  console.log("   Address:", taxRecipient);
  const taxRecipientEth = await hre.ethers.provider.getBalance(taxRecipient);
  console.log("   ETH:", hre.ethers.formatEther(taxRecipientEth));
  console.log("   ℹ️  Is this the deployer?", taxRecipient.toLowerCase() === deployer.address.toLowerCase() ? "YES ✅" : "NO");
  console.log();

  console.log("5️⃣ TAX TOKEN CONTRACT:");
  console.log("   Address:", TAX_TOKEN);
  const contractEth = await hre.ethers.provider.getBalance(TAX_TOKEN);
  const contractTokens = await token.balanceOf(TAX_TOKEN);
  console.log("   ETH:", hre.ethers.formatEther(contractEth));
  console.log("   BUYTAX tokens:", hre.ethers.formatEther(contractTokens));
  console.log();

  console.log("6️⃣ PAIR CONTRACT:");
  console.log("   Address:", PAIR);
  const pairEth = await hre.ethers.provider.getBalance(PAIR);
  const pairTokens = await token.balanceOf(PAIR);
  const pairTotalLP = await pair.balanceOf(PAIR);
  console.log("   ETH:", hre.ethers.formatEther(pairEth));
  console.log("   BUYTAX tokens:", hre.ethers.formatEther(pairTokens));
  console.log("   LP tokens (dead/locked):", hre.ethers.formatEther(pairTotalLP));
  console.log();

  console.log("=".repeat(70));
  console.log("💡 EXPLANATION");
  console.log("=".repeat(70));
  console.log();

  if (feeTo.toLowerCase() === deployer.address.toLowerCase() &&
      taxRecipient.toLowerCase() === deployer.address.toLowerCase() &&
      tokenOwner.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("✅ ALL ROLES POINT TO THE SAME ADDRESS (deployer):");
    console.log("   - Protocol fee recipient (feeTo): gets LP tokens from pair fees");
    console.log("   - Tax recipient: gets ETH from swapBack");
    console.log("   - Token owner: controls tax token settings");
    console.log();
    console.log("📊 Your balance breakdown:");
    console.log("   - ETH:", hre.ethers.formatEther(deployerEth), "(spent on gas + received from swapBack)");
    console.log("   - LP tokens:", hre.ethers.formatEther(feeToLP), "(protocol fees)");
    console.log("   - BUYTAX tokens:", hre.ethers.formatEther(deployerTaxTokens), "(initial mint - what you added to LP)");
  }

  console.log();
  console.log("🔥 BURNER WALLETS:");
  console.log("   - These were temporary wallets created during testing");
  console.log("   - They were funded with small amounts of ETH (~0.05-0.1 each)");
  console.log("   - Used to test non-owner trading scenarios");
  console.log("   - Any remaining balances are negligible (just gas leftovers)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
