/**
 * Buy BUYTAX tokens with 0.02 ETH
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const PAIR = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("🔵 BUYING BUYTAX TOKENS WITH 0.02 ETH");
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
      "function swapExactETHForTokens(uint, address[], address, uint) external payable returns (uint[])",
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
  console.log("   Your BUYTAX balance:", hre.ethers.formatEther(deployerTokensBefore));
  console.log();

  // Buy with 0.02 ETH
  const ethAmount = hre.ethers.parseEther("0.02");
  console.log("🔄 Buying BUYTAX with", hre.ethers.formatEther(ethAmount), "ETH...");
  console.log();

  const path = [WETH, TAX_TOKEN];
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  const buyTx = await router.swapExactETHForTokens(
    0, // accept any amount of tokens
    path,
    deployer.address,
    deadline,
    { value: ethAmount }
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

  const deployerTokensAfter = await token.balanceOf(deployer.address);
  const tokensReceived = deployerTokensAfter - deployerTokensBefore;

  console.log("   Your BUYTAX balance:", hre.ethers.formatEther(deployerTokensAfter));
  console.log("   Tokens received:", hre.ethers.formatEther(tokensReceived));
  console.log();

  console.log("=".repeat(70));
  console.log("📈 RESERVE CHANGES:");
  console.log("=".repeat(70));

  const wethChange = wethAfter - wethBefore;
  const taxChange = taxAfter - taxBefore;

  console.log("WETH change:", hre.ethers.formatEther(wethChange), "(should be +0.02)");
  console.log("BUYTAX change:", hre.ethers.formatEther(taxChange));
  console.log();

  console.log("New reserve state:");
  console.log("  Started with: 0.1 ETH + 1000 BUYTAX");
  console.log("  Now have:", hre.ethers.formatEther(wethAfter), "ETH +", hre.ethers.formatEther(taxAfter), "BUYTAX");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
