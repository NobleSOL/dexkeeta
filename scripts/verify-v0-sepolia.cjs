/**
 * Verify V0 contracts on Base Sepolia
 *
 * Usage:
 *   npx hardhat run scripts/verify-v0-sepolia.cjs --network base-sepolia
 */

const hre = require("hardhat");

// Deployed addresses on Base Sepolia
const FACTORY_ADDRESS = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const ROUTER_ADDRESS = "0xb7e572F32402256cd88ae14FfA677a40Bc43e5c6";
const FEE_TO_SETTER = "0x21fdEd74C901129977B8e28C2588595163E1e235";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("🔍 Verifying V0 contracts on Base Sepolia...\n");

  // Verify FactoryV0
  console.log("1️⃣ Verifying SilverbackFactoryV0:", FACTORY_ADDRESS);
  console.log("   Constructor args: [feeToSetter]");
  console.log("   feeToSetter:", FEE_TO_SETTER);

  try {
    await hre.run("verify:verify", {
      address: FACTORY_ADDRESS,
      constructorArguments: [FEE_TO_SETTER],
      contract: "contracts/SilverbackFactoryV0.sol:SilverbackFactoryV0",
    });
    console.log("✅ FactoryV0 verified!\n");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ FactoryV0 already verified!\n");
    } else {
      console.error("❌ FactoryV0 verification failed:", error.message, "\n");
    }
  }

  // Verify RouterV0
  console.log("2️⃣ Verifying SilverbackUnifiedRouterV0:", ROUTER_ADDRESS);
  console.log("   Constructor args: [factory, WETH]");
  console.log("   factory:", FACTORY_ADDRESS);
  console.log("   WETH:", WETH);

  try {
    await hre.run("verify:verify", {
      address: ROUTER_ADDRESS,
      constructorArguments: [FACTORY_ADDRESS, WETH],
      contract: "contracts/SilverbackUnifiedRouterV0.sol:SilverbackUnifiedRouterV0",
    });
    console.log("✅ RouterV0 verified!\n");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ RouterV0 already verified!\n");
    } else {
      console.error("❌ RouterV0 verification failed:", error.message, "\n");
    }
  }

  console.log("🎉 Verification complete!");
  console.log("\n📋 View verified contracts:");
  console.log("   FactoryV0: https://sepolia.basescan.org/address/" + FACTORY_ADDRESS + "#code");
  console.log("   RouterV0: https://sepolia.basescan.org/address/" + ROUTER_ADDRESS + "#code");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
