const hre = require("hardhat");

const NEW_ROUTER = "0x342d3879EbE201Db0966B595650c6614390857fa";
const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("🔍 Verifying NEW RouterV0 on Base Sepolia...\n");

  console.log("Router Address:", NEW_ROUTER);
  console.log("Factory:", FACTORY_V0);
  console.log("WETH:", WETH);
  console.log();

  try {
    await hre.run("verify:verify", {
      address: NEW_ROUTER,
      constructorArguments: [FACTORY_V0, WETH],
      contract: "contracts/SilverbackUnifiedRouterV0.sol:SilverbackUnifiedRouterV0"
    });
    console.log("✅ RouterV0 verified!");
  } catch (error) {
    if (error.message.includes("already verified")) {
      console.log("✅ RouterV0 already verified!");
    } else {
      console.error("❌ Verification failed:", error.message);
    }
  }

  console.log("\n📋 View on Basescan:");
  console.log(`https://sepolia.basescan.org/address/${NEW_ROUTER}#code`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
