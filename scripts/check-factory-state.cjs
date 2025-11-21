const hre = require("hardhat");

const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";

async function main() {
  const factory = await hre.ethers.getContractAt(
    [
      "function allPairsLength() external view returns (uint256)",
      "function allPairs(uint256) external view returns (address)",
      "function getPair(address,address) external view returns (address)",
      "function feeTo() external view returns (address)",
    ],
    FACTORY_V0
  );

  console.log("Factory:", FACTORY_V0);
  console.log();

  const pairCount = await factory.allPairsLength();
  console.log("Total pairs:", pairCount.toString());
  console.log();

  if (pairCount > 0n) {
    console.log("Pairs:");
    for (let i = 0; i < pairCount; i++) {
      const pairAddr = await factory.allPairs(i);
      console.log(`  [${i}]:`, pairAddr);

      // Get pair details
      const pair = await hre.ethers.getContractAt(
        [
          "function token0() external view returns (address)",
          "function token1() external view returns (address)",
          "function getReserves() external view returns (uint112, uint112, uint32)",
        ],
        pairAddr
      );

      const token0 = await pair.token0();
      const token1 = await pair.token1();
      const [reserve0, reserve1] = await pair.getReserves();

      console.log(`      Token0: ${token0}`);
      console.log(`      Token1: ${token1}`);
      console.log(`      Reserve0: ${hre.ethers.formatEther(reserve0)}`);
      console.log(`      Reserve1: ${hre.ethers.formatEther(reserve1)}`);

      // Check if getPair works for these tokens
      const retrievedPair = await factory.getPair(token0, token1);
      console.log(`      getPair result: ${retrievedPair}`);
      console.log(`      Match: ${retrievedPair.toLowerCase() === pairAddr.toLowerCase() ? '✅' : '❌'}`);
      console.log();
    }
  }

  const feeTo = await factory.feeTo();
  console.log("Fee recipient:", feeTo);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
