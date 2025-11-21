const hre = require("hardhat");

async function main() {
  const pair = await hre.ethers.getContractAt(
    [
      "function token0() external view returns (address)",
      "function token1() external view returns (address)",
      "function getReserves() external view returns (uint112, uint112, uint32)",
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address) external view returns (uint256)",
    ],
    "0x025259a879fc21e4ed5bd81b9988c81754471b81"
  );

  const [deployer] = await hre.ethers.getSigners();

  console.log("🔍 ACTUAL PAIR STATE RIGHT NOW");
  console.log("=".repeat(60));
  console.log();

  const token0 = await pair.token0();
  const token1 = await pair.token1();
  console.log("Token0:", token0);
  console.log("Token1:", token1);
  console.log();

  const [r0, r1, timestamp] = await pair.getReserves();
  console.log("Reserve0:", hre.ethers.formatEther(r0));
  console.log("Reserve1:", hre.ethers.formatEther(r1));
  console.log("Last update:", new Date(Number(timestamp) * 1000).toISOString());
  console.log();

  const supply = await pair.totalSupply();
  console.log("Total LP supply:", hre.ethers.formatEther(supply));

  const deployerLP = await pair.balanceOf(deployer.address);
  console.log("Your LP tokens:", hre.ethers.formatEther(deployerLP));
  console.log();

  // Show what happened
  console.log("WETH is token0? ", token0.toLowerCase() === "0x4200000000000000000000000000000000000006".toLowerCase());

  if (token0.toLowerCase() === "0x4200000000000000000000000000000000000006".toLowerCase()) {
    console.log();
    console.log("Interpreted:");
    console.log("  WETH reserve:", hre.ethers.formatEther(r0));
    console.log("  BUYTAX reserve:", hre.ethers.formatEther(r1));
  } else {
    console.log();
    console.log("Interpreted:");
    console.log("  BUYTAX reserve:", hre.ethers.formatEther(r0));
    console.log("  WETH reserve:", hre.ethers.formatEther(r1));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
