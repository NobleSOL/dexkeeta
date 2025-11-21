/**
 * Deploy SilverbackFactoryV0 to Base Mainnet
 *
 * Usage:
 *   npx hardhat run scripts/deploy-factoryv0.js --network base
 *
 * This factory deploys PairV0 contracts with protocol fee collection.
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying SilverbackFactoryV0 to Base Sepolia...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying from address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy FactoryV0
  const Factory = await hre.ethers.getContractFactory("SilverbackFactoryV0");

  console.log("\n⏳ Deploying FactoryV0 with feeToSetter:", deployer.address);
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ SilverbackFactoryV0 deployed to:", factoryAddress);

  console.log("\n📊 Factory Configuration:");
  console.log("   Factory Address:", factoryAddress);
  console.log("   Fee Recipient (feeTo):", deployer.address);
  console.log("   Fee Setter:", deployer.address);

  console.log("\n🔗 Add this to your .env file:");
  console.log(`VITE_SB_FACTORY_V0=${factoryAddress}`);

  console.log("\n⏭️  Next step: Deploy RouterV0");
  console.log("   npx hardhat run scripts/deploy-routerv0.js --network base");

  console.log("\n✅ Deployment complete!");

  console.log("\n📋 Manual Verification:");
  console.log("   Go to: https://sepolia.basescan.org/address/" + factoryAddress + "#code");
  console.log("   Contract: SilverbackFactoryV0");
  console.log("   Constructor argument (address):", deployer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
