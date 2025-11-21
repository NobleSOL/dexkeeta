/**
 * Buy exactly 474.877328584927726793 BUYTAX tokens from the pair
 * Using swapETHForExactTokens to get the exact amount
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const PAIR = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("🔵 BUYING EXACTLY 474.877328584927726793 BUYTAX TOKENS");
  console.log("=".repeat(70));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  const token = await hre.ethers.getContractAt(
    ["function balanceOf(address) external view returns (uint256)"],
    TAX_TOKEN
  );

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
      "function getAmountsIn(uint, address[]) external view returns (uint[])"
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

  const deployerTokensBefore = await token.balanceOf(deployer.address);
  const deployerEthBefore = await hre.ethers.provider.getBalance(deployer.address);
  console.log("   Your ETH balance:", hre.ethers.formatEther(deployerEthBefore));
  console.log("   Your BUYTAX balance:", hre.ethers.formatEther(deployerTokensBefore));
  console.log();

  // Target: exactly 474.877328584927726793 tokens
  const targetAmount = hre.ethers.parseEther("474.877328584927726793");
  console.log("🎯 Target amount:", hre.ethers.formatEther(targetAmount), "BUYTAX");
  console.log();

  // Calculate how much ETH is needed
  const path = [WETH, TAX_TOKEN];

  try {
    const amountsIn = await router.getAmountsIn(targetAmount, path);
    const ethNeeded = amountsIn[0];

    console.log("💰 ETH needed (estimated):", hre.ethers.formatEther(ethNeeded));
    console.log();

    // Add 10% buffer for slippage and fees
    const ethToSend = (ethNeeded * 11n) / 10n;
    console.log("💸 Sending ETH (with 10% buffer):", hre.ethers.formatEther(ethToSend));
    console.log();

    if (ethToSend > deployerEthBefore) {
      console.log("❌ Insufficient ETH!");
      console.log("   Need:", hre.ethers.formatEther(ethToSend));
      console.log("   Have:", hre.ethers.formatEther(deployerEthBefore));
      return;
    }

    console.log("🔄 Executing swap...");
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    const buyTx = await router.swapETHForExactTokens(
      targetAmount,
      path,
      deployer.address,
      deadline,
      { value: ethToSend }
    );

    console.log("   ⏳ Waiting for transaction...");
    const receipt = await buyTx.wait();
    console.log("   ✅ Buy completed!");
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

    const deployerTokensAfter = await token.balanceOf(deployer.address);
    const deployerEthAfter = await hre.ethers.provider.getBalance(deployer.address);
    const tokensReceived = deployerTokensAfter - deployerTokensBefore;
    const ethSpent = deployerEthBefore - deployerEthAfter;

    console.log("   Your ETH balance:", hre.ethers.formatEther(deployerEthAfter));
    console.log("   Your BUYTAX balance:", hre.ethers.formatEther(deployerTokensAfter));
    console.log();
    console.log("   ETH spent (including gas):", hre.ethers.formatEther(ethSpent));
    console.log("   Tokens received:", hre.ethers.formatEther(tokensReceived));
    console.log();

    const difference = tokensReceived - targetAmount;
    console.log("=".repeat(70));
    console.log("🎯 ACCURACY CHECK:");
    console.log("=".repeat(70));
    console.log("Target:  ", hre.ethers.formatEther(targetAmount), "BUYTAX");
    console.log("Received:", hre.ethers.formatEther(tokensReceived), "BUYTAX");
    console.log("Difference:", hre.ethers.formatEther(difference), "BUYTAX");
    console.log();

    if (Math.abs(Number(difference)) < Number(hre.ethers.parseEther("0.001"))) {
      console.log("✅ Successfully bought the exact amount (within 0.001 tolerance)!");
    } else {
      console.log("⚠️ Note: Buy tax may have affected the exact amount received");
      console.log("   With 5% buy tax, you get 95% of what's pulled from the pool");
    }

    console.log();
    console.log("📈 RESERVE CHANGES:");
    console.log("=".repeat(70));
    const wethChange = wethAfter - wethBefore;
    const taxChange = taxAfter - taxBefore;

    console.log("WETH change:", hre.ethers.formatEther(wethChange), "(should be positive)");
    console.log("BUYTAX change:", hre.ethers.formatEther(taxChange), "(should be negative)");

  } catch (error) {
    console.error("❌ Failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
