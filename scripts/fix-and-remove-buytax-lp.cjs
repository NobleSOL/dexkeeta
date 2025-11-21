/**
 * Fix BUYTAX pair by excluding it from taxes, then remove liquidity
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const PAIR = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";

async function main() {
  console.log("🔧 FIXING BUYTAX PAIR - Excluding from Taxes");
  console.log("=".repeat(70));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const token = await hre.ethers.getContractAt(
    [
      "function setTaxExclusion(address, bool) external",
      "function isExcludedFromTax(address) external view returns (bool)",
      "function owner() external view returns (address)"
    ],
    TAX_TOKEN
  );

  const pair = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address, uint256) external returns (bool)",
      "function getReserves() external view returns (uint112, uint112, uint32)",
      "function token0() external view returns (address)"
    ],
    PAIR
  );

  const router = await hre.ethers.getContractAt(
    [
      "function removeLiquidityETH(address, uint, uint, uint, address, uint) external returns (uint, uint)",
    ],
    ROUTER_V0
  );

  console.log("📋 Current Status:");
  const owner = await token.owner();
  const isExcluded = await token.isExcludedFromTax(PAIR);
  const lpBalance = await pair.balanceOf(deployer.address);

  console.log("   Token owner:", owner);
  console.log("   Your address:", deployer.address);
  console.log("   Pair excluded from tax:", isExcluded);
  console.log("   Your LP balance:", hre.ethers.formatEther(lpBalance));
  console.log();

  if (!isExcluded) {
    console.log("🔧 Excluding pair from taxes...");
    const excludeTx = await token.setTaxExclusion(PAIR, true);
    await excludeTx.wait();
    console.log("   ✅ Pair excluded!");
    console.log();
  } else {
    console.log("   ✅ Pair already excluded from taxes");
    console.log();
  }

  if (lpBalance > 0n) {
    console.log("📊 BEFORE REMOVAL:");
    console.log("-".repeat(70));
    const [r0Before, r1Before] = await pair.getReserves();
    const token0 = await pair.token0();
    const wethIsToken0 = token0.toLowerCase() === "0x4200000000000000000000000000000000000006".toLowerCase();
    const wethBefore = wethIsToken0 ? r0Before : r1Before;
    const taxBefore = wethIsToken0 ? r1Before : r0Before;

    console.log("   WETH reserve:", hre.ethers.formatEther(wethBefore));
    console.log("   BUYTAX reserve:", hre.ethers.formatEther(taxBefore));
    console.log();

    const ethBefore = await hre.ethers.provider.getBalance(deployer.address);
    console.log("   Your ETH balance:", hre.ethers.formatEther(ethBefore));
    console.log();

    console.log("🔄 Removing all liquidity...");

    // Approve router
    await pair.approve(ROUTER_V0, lpBalance);

    const deadline = Math.floor(Date.now() / 1000) + 1200;

    const removeTx = await router.removeLiquidityETH(
      TAX_TOKEN,
      lpBalance,
      0, // accept any amount of tokens
      0, // accept any amount of ETH
      deployer.address,
      deadline
    );

    console.log("   ⏳ Waiting for transaction...");
    const receipt = await removeTx.wait();
    console.log("   ✅ Liquidity removed!");
    console.log("   Gas used:", receipt.gasUsed.toString());
    console.log();

    console.log("📊 AFTER REMOVAL:");
    console.log("-".repeat(70));
    const [r0After, r1After] = await pair.getReserves();
    const wethAfter = wethIsToken0 ? r0After : r1After;
    const taxAfter = wethIsToken0 ? r1After : r0After;

    console.log("   WETH reserve:", hre.ethers.formatEther(wethAfter));
    console.log("   BUYTAX reserve:", hre.ethers.formatEther(taxAfter));
    console.log();

    const ethAfter = await hre.ethers.provider.getBalance(deployer.address);
    const ethReceived = ethAfter - ethBefore + (receipt.gasUsed * receipt.gasPrice);
    console.log("   Your ETH balance:", hre.ethers.formatEther(ethAfter));
    console.log("   ETH received (before gas):", hre.ethers.formatEther(ethReceived));
    console.log();

    console.log("🎉 Successfully removed liquidity from BUYTAX pair!");
  } else {
    console.log("   ⚠️ No LP tokens to remove");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
