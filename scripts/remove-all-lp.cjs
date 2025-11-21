/**
 * Remove liquidity from all test token pairs
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("🔄 REMOVING LIQUIDITY FROM ALL TEST PAIRS");
  console.log("=".repeat(70));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const factory = await hre.ethers.getContractAt(
    [
      "function allPairsLength() external view returns (uint256)",
      "function allPairs(uint256) external view returns (address)",
      "function feeTo() external view returns (address)"
    ],
    FACTORY_V0
  );

  const router = await hre.ethers.getContractAt(
    [
      "function removeLiquidityETH(address, uint, uint, uint, address, uint) external returns (uint, uint)",
    ],
    ROUTER_V0
  );

  const feeTo = await factory.feeTo();
  console.log("Protocol fee recipient:", feeTo);
  console.log();

  const pairCount = await factory.allPairsLength();
  console.log("Total pairs created:", pairCount.toString());
  console.log();

  let totalEthRecovered = 0n;

  for (let i = 0; i < pairCount; i++) {
    const pairAddress = await factory.allPairs(i);

    const pair = await hre.ethers.getContractAt(
      [
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function balanceOf(address) external view returns (uint256)",
        "function approve(address, uint256) external returns (bool)",
        "function getReserves() external view returns (uint112, uint112, uint32)",
        "function kLast() external view returns (uint256)"
      ],
      pairAddress
    );

    const token0 = await pair.token0();
    const token1 = await pair.token1();
    const [r0, r1] = await pair.getReserves();
    const kLast = await pair.kLast();
    const currentK = r0 * r1;

    // Determine which is the tax token
    const taxToken = token0.toLowerCase() === WETH.toLowerCase() ? token1 : token0;
    const wethReserve = token0.toLowerCase() === WETH.toLowerCase() ? r0 : r1;
    const tokenReserve = token0.toLowerCase() === WETH.toLowerCase() ? r1 : r0;

    const taxTokenContract = await hre.ethers.getContractAt(
      ["function symbol() external view returns (string memory)"],
      taxToken
    );
    const symbol = await taxTokenContract.symbol();

    console.log(`📦 Pair ${i + 1}: ${symbol}`);
    console.log(`   Address: ${pairAddress}`);
    console.log(`   Reserves: ${hre.ethers.formatEther(wethReserve)} ETH + ${hre.ethers.formatEther(tokenReserve)} ${symbol}`);
    console.log(`   kLast: ${kLast.toString().slice(0, 20)}...`);
    console.log(`   current k: ${currentK.toString().slice(0, 20)}...`);
    console.log(`   k grew: ${currentK > kLast ? "YES ✅" : "NO"}`);

    const lpBalance = await pair.balanceOf(deployer.address);
    const protocolLP = await pair.balanceOf(feeTo);

    console.log(`   Your LP tokens: ${hre.ethers.formatEther(lpBalance)}`);
    console.log(`   Protocol LP tokens: ${hre.ethers.formatEther(protocolLP)}`);

    if (lpBalance > 0n) {
      console.log(`   🔄 Removing all liquidity...`);

      const ethBefore = await hre.ethers.provider.getBalance(deployer.address);

      // Approve router
      await pair.approve(ROUTER_V0, lpBalance);

      const deadline = Math.floor(Date.now() / 1000) + 1200;

      try {
        const removeTx = await router.removeLiquidityETH(
          taxToken,
          lpBalance,
          0, // accept any amount of tokens
          0, // accept any amount of ETH
          deployer.address,
          deadline
        );

        const receipt = await removeTx.wait();

        const ethAfter = await hre.ethers.provider.getBalance(deployer.address);
        const ethReceived = ethAfter - ethBefore + (receipt.gasUsed * receipt.gasPrice);
        totalEthRecovered += ethReceived;

        console.log(`   ✅ Removed! Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`   💰 ETH received (before gas): ${hre.ethers.formatEther(ethReceived)}`);

        // Check protocol LP after removal
        const protocolLPAfter = await pair.balanceOf(feeTo);
        if (protocolLPAfter > protocolLP) {
          const gained = protocolLPAfter - protocolLP;
          console.log(`   🎉 Protocol gained ${hre.ethers.formatEther(gained)} LP tokens!`);
        }
      } catch (error) {
        console.log(`   ❌ Failed to remove: ${error.message}`);
      }
    } else {
      console.log(`   ⏭️  No LP tokens to remove`);
    }

    console.log();
  }

  console.log("=".repeat(70));
  console.log("💰 TOTAL ETH RECOVERED (before gas):", hre.ethers.formatEther(totalEthRecovered));

  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Your final ETH balance:", hre.ethers.formatEther(finalBalance));
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
