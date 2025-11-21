/**
 * Check deployer address and balance on Base Sepolia
 */

const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🔍 Checking deployer wallet...\n");

  // Check if PRIVATE_KEY is set
  if (!process.env.PRIVATE_KEY) {
    console.log("❌ PRIVATE_KEY not found in .env file");
    console.log("   Add this line to your .env file:");
    console.log("   PRIVATE_KEY=your_private_key_here");
    process.exit(1);
  }

  console.log("✅ PRIVATE_KEY found in .env\n");

  try {
    const [deployer] = await hre.ethers.getSigners();
    const address = deployer.address;
    const balance = await hre.ethers.provider.getBalance(address);
    const balanceEth = hre.ethers.formatEther(balance);

    console.log("📊 Deployer Information:");
    console.log("   Address:", address);
    console.log("   Balance:", balanceEth, "ETH");
    console.log("   Network:", hre.network.name);
    console.log("   Chain ID:", hre.network.config.chainId);

    if (parseFloat(balanceEth) === 0) {
      console.log("\n❌ No ETH balance!");
      console.log("   You need testnet ETH to deploy contracts.");
      console.log("   Get free Base Sepolia ETH from:");
      console.log("   - https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
      console.log("   - Or bridge from Ethereum Sepolia");
    } else if (parseFloat(balanceEth) < 0.01) {
      console.log("\n⚠️  Low balance! You may not have enough for deployment.");
      console.log("   Recommended: At least 0.01 ETH");
    } else {
      console.log("\n✅ Balance looks good! Ready to deploy.");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
