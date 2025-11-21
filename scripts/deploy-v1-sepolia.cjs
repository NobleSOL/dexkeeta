/**
 * Deploy V1 contracts to Base Sepolia
 * - Pair: 0.25% fee
 * - Router: 0.05% fee (to specific recipient)
 */

const hre = require("hardhat");

const WETH = "0x4200000000000000000000000000000000000006";
const FEE_RECIPIENT = "0x9E753c5C0051277C2a9600FCDF14e28Eafd7A7db";
const FEE_BPS = 5; // 0.05%

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║            Deploying V1 Contracts to Base Sepolia               ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Fee recipient:", FEE_RECIPIENT);
  console.log("Router feeBps:", FEE_BPS, "(0.05%)");
  console.log();

  // Deploy Factory
  console.log("📦 Deploying Factory...");
  const Factory = await hre.ethers.getContractFactory("SilverbackFactory");
  const factory = await Factory.deploy(deployer.address); // feeToSetter
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("✅ Factory deployed:", factoryAddress);
  console.log("   feeToSetter:", deployer.address);
  console.log();

  // Wait a moment for contract to be indexed
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Deploy Router
  console.log("📦 Deploying Router...");
  const Router = await hre.ethers.getContractFactory("SilverbackRouter");
  const router = await Router.deploy(
    FEE_RECIPIENT,
    FEE_BPS,
    factoryAddress,
    WETH
  );
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("✅ Router deployed:", routerAddress);
  console.log("   feeRecipient:", FEE_RECIPIENT);
  console.log("   feeBps:", FEE_BPS);
  console.log("   factory:", factoryAddress);
  console.log("   WETH:", WETH);
  console.log();

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    DEPLOYMENT COMPLETE                           ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  console.log("📋 Contract Addresses:");
  console.log("─".repeat(70));
  console.log("Factory:", factoryAddress);
  console.log("Router: ", routerAddress);
  console.log();

  console.log("💡 Fee Structure:");
  console.log("─".repeat(70));
  console.log("Pair fee:   0.25% (goes to LP holders)");
  console.log("Router fee: 0.05% (goes to", FEE_RECIPIENT + ")");
  console.log("Total:      0.30%");
  console.log();

  console.log("Next steps:");
  console.log("1. Verify contracts on Basescan");
  console.log("2. Test with small liquidity pool");
  console.log("3. Verify fee collection to", FEE_RECIPIENT);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
