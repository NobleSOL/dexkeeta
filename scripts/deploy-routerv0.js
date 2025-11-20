/**
 * Deploy SilverbackUnifiedRouterV0 to Base Mainnet
 *
 * Usage:
 *   npx hardhat run scripts/deploy-routerv0.js --network base
 *
 * This router has NO router fees (0%) - only pair fees apply (0.3%).
 *
 * IMPORTANT: You must deploy FactoryV0 first and update FACTORY_ADDRESS below!
 */

const hre = require("hardhat");

// ⚠️  UPDATE THIS after deploying FactoryV0
const FACTORY_ADDRESS = "PASTE_FACTORY_V0_ADDRESS_HERE";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base WETH

async function main() {
  if (FACTORY_ADDRESS === "PASTE_FACTORY_V0_ADDRESS_HERE") {
    console.error("❌ ERROR: You must update FACTORY_ADDRESS in this script first!");
    console.error("   Deploy FactoryV0 first, then paste its address at the top of this file.");
    process.exit(1);
  }

  console.log("🚀 Deploying SilverbackUnifiedRouterV0 to Base Mainnet...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying from address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Verify factory exists
  const factoryCode = await hre.ethers.provider.getCode(FACTORY_ADDRESS);
  if (factoryCode === "0x") {
    console.error("❌ ERROR: No contract found at factory address:", FACTORY_ADDRESS);
    console.error("   Make sure you deployed FactoryV0 first and copied the correct address.");
    process.exit(1);
  }
  console.log("✅ Factory found at:", FACTORY_ADDRESS);

  // Deploy RouterV0
  const Router = await hre.ethers.getContractFactory("SilverbackUnifiedRouterV0");

  console.log("\n⏳ Deploying RouterV0...");
  console.log("   Factory:", FACTORY_ADDRESS);
  console.log("   WETH:", WETH_ADDRESS);

  const router = await Router.deploy(FACTORY_ADDRESS, WETH_ADDRESS);
  await router.waitForDeployment();

  const routerAddress = await router.getAddress();
  console.log("✅ SilverbackUnifiedRouterV0 deployed to:", routerAddress);

  // Display configuration
  const factory = await router.factory();
  const weth = await router.WETH();

  console.log("\n📊 Router Configuration:");
  console.log("   Router Address:", routerAddress);
  console.log("   Factory:", factory);
  console.log("   WETH:", weth);
  console.log("   Router Fee: 0% (NO ROUTER FEES)");
  console.log("   Pair Fee: 0.3% (0.05% protocol + 0.25% LP)");

  console.log("\n🔗 Add this to your .env file:");
  console.log(`VITE_SB_ROUTER_V0=${routerAddress}`);

  console.log("\n✅ Deployment complete!");

  // Wait for Basescan to index
  console.log("\n⏳ Waiting 30 seconds for Basescan to index...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Verify on Basescan
  console.log("\n🔍 Verifying on Basescan...");
  try {
    await hre.run("verify:verify", {
      address: routerAddress,
      constructorArguments: [FACTORY_ADDRESS, WETH_ADDRESS],
    });
    console.log("✅ Contract verified on Basescan");
  } catch (error) {
    console.log("⚠️  Verification failed (you can verify manually later):", error.message);
  }

  console.log("\n🎉 All done! Your dual router setup is ready:");
  console.log("   - RouterV0 (0% fee):", routerAddress);
  console.log("   - UnifiedRouter (0.3% fee): 0x4752Ba5DbC23F44d87826276Bf6fD6B1c372AD24");
  console.log("\n⏭️  Next: Update your .env file and integrate the swap card!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
