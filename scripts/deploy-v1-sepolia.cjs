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

  // Deploy FactoryV1
  console.log("📦 Deploying FactoryV1...");
  const FactoryV1 = await hre.ethers.getContractFactory("SilverbackFactoryV1");
  const factory = await FactoryV1.deploy(deployer.address); // feeToSetter
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("✅ FactoryV1 deployed:", factoryAddress);
  console.log("   feeToSetter:", deployer.address);
  console.log();

  // Wait a moment for contract to be indexed
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Deploy RouterV1
  console.log("📦 Deploying RouterV1...");
  const RouterV1 = await hre.ethers.getContractFactory("SilverbackUnifiedRouterV1");
  const router = await RouterV1.deploy(
    FEE_RECIPIENT,
    FEE_BPS,
    factoryAddress,
    WETH
  );
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("✅ RouterV1 deployed:", routerAddress);
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
  console.log("FactoryV1:", factoryAddress);
  console.log("RouterV1: ", routerAddress);
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
