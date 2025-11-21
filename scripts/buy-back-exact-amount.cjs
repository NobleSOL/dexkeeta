/**
 * Buy back exactly 474.877328584927726793 BUYTAX tokens
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const PAIR = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("🔵 BUYING BACK 474.877328584927726793 BUYTAX TOKENS");
  console.log("=".repeat(70));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const pair = await hre.ethers.getContractAt(
    [
      "function getReserves() external view returns (uint112, uint112, uint32)",
      "function token0() external view returns (address)",
    ],
    PAIR
  );

  const router = await hre.ethers.getContractAt(
    [
      "function swapETHForExactTokens(uint, address[], address, uint) external payable returns (uint[])",
    ],
    ROUTER_V0
  );

  console.log("📊 BEFORE BUY:");
  console.log("-".repeat(70));
  const [r0Before, r1Before] = await pair.getReserves();
  const token0 = await pair.token0();
  const wethIsToken0 = token0.toLowerCase() === WETH.toLowerCase();
  const wethBefore = wethIsToken0 ? r0Before : r1Before;
  const taxBefore = wethIsToken0 ? r1Before : r0Before;

  console.log("   WETH reserve:", hre.ethers.formatEther(wethBefore));
  console.log("   BUYTAX reserve:", hre.ethers.formatEther(taxBefore));
  console.log();

  const deployerEthBefore = await hre.ethers.provider.getBalance(deployer.address);
  console.log("   Your ETH balance:", hre.ethers.formatEther(deployerEthBefore));
  console.log();

  // Buy exactly 474.877328584927726793 tokens
  const tokensToBuy = hre.ethers.parseEther("474.877328584927726793");
  console.log("🔄 Buying", hre.ethers.formatEther(tokensToBuy), "BUYTAX tokens...");
  console.log();

  const path = [WETH, TAX_TOKEN];
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  // Send extra ETH to cover slippage and fees (0.03 ETH should be enough)
  const buyTx = await router.swapETHForExactTokens(
    tokensToBuy,
    path,
    deployer.address,
    deadline,
    { value: hre.ethers.parseEther("0.03") }
  );

  console.log("⏳ Waiting for transaction...");
  const receipt = await buyTx.wait();
  console.log("✅ Buy completed!");
  console.log("   Gas used:", receipt.gasUsed.toString());
  console.log();

  console.log("📊 AFTER BUY:");
  console.log("-".repeat(70));
  const [r0After, r1After] = await pair.getReserves();
  const wethAfter = wethIsToken0 ? r0After : r1After;
  const taxAfter = wethIsToken0 ? r1After : r0After;

  console.log("   WETH reserve:", hre.ethers.formatEther(wethAfter));
  console.log("   BUYTAX reserve:", hre.ethers.formatEther(taxAfter));
  console.log();

  const deployerEthAfter = await hre.ethers.provider.getBalance(deployer.address);
  const ethSpent = deployerEthBefore - deployerEthAfter;
  console.log("   Your ETH balance:", hre.ethers.formatEther(deployerEthAfter));
  console.log("   ETH spent (including gas):", hre.ethers.formatEther(ethSpent));
  console.log();

  console.log("=".repeat(70));
  console.log("📈 RESERVE CHANGES:");
  console.log("=".repeat(70));

  const wethChange = wethAfter - wethBefore;
  const taxChange = taxAfter - taxBefore;

  console.log("WETH change:", hre.ethers.formatEther(wethChange));
  console.log("BUYTAX change:", hre.ethers.formatEther(taxChange));
  console.log();

  console.log("Target was to reduce BUYTAX by:", hre.ethers.formatEther(tokensToBuy));
  console.log("Actual reduction:", hre.ethers.formatEther(-taxChange));
  console.log();

  if (Math.abs(Number(taxChange) + Number(tokensToBuy)) < Number(hre.ethers.parseEther("1"))) {
    console.log("✅ Successfully bought back the target amount!");
  } else {
    console.log("⚠️ Note: Buy tax may have affected the exact amount received");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
