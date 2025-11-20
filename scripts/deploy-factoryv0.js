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
  console.log("🚀 Deploying SilverbackFactoryV0 to Base Mainnet...");

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

  // Display configuration
  const feeTo = await factory.feeTo();
  const feeToSetter = await factory.feeToSetter();

  console.log("\n📊 Factory Configuration:");
  console.log("   Factory Address:", factoryAddress);
  console.log("   Fee Recipient (feeTo):", feeTo);
  console.log("   Fee Setter:", feeToSetter);

  console.log("\n🔗 Add this to your .env file:");
  console.log(`VITE_SB_FACTORY_V0=${factoryAddress}`);

  console.log("\n⏭️  Next step: Deploy RouterV0");
  console.log("   npx hardhat run scripts/deploy-routerv0.js --network base");

  console.log("\n✅ Deployment complete!");

  // Wait for Basescan to index
  console.log("\n⏳ Waiting 30 seconds for Basescan to index...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Verify on Basescan
  console.log("\n🔍 Verifying on Basescan...");
  try {
    await hre.run("verify:verify", {
      address: factoryAddress,
      constructorArguments: [deployer.address],
    });
    console.log("✅ Contract verified on Basescan");
  } catch (error) {
    console.log("⚠️  Verification failed (you can verify manually later):", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
