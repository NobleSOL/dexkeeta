const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Your address:", deployer.address);
  console.log();

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function totalSupply() external view returns (uint256)"
    ],
    "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC"
  );

  const balance = await token.balanceOf(deployer.address);
  const totalSupply = await token.totalSupply();

  console.log("Your BUYTAX balance:", hre.ethers.formatEther(balance));
  console.log("Total supply:", hre.ethers.formatEther(totalSupply));

  const diff = balance - hre.ethers.parseEther("1000000");
  console.log();
  console.log("Difference from initial 1M:", hre.ethers.formatEther(diff));

  if (diff > 0n) {
    console.log("  → You have MORE than 1M tokens (", hre.ethers.formatEther(diff), "extra)");
  } else if (diff < 0n) {
    console.log("  → You have LESS than 1M tokens (", hre.ethers.formatEther(-diff), "missing)");
  } else {
    console.log("  → You have exactly 1M tokens");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
