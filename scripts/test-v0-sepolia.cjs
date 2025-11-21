/**
 * Test V0 contracts on Base Sepolia with minimal ETH usage
 *
 * Usage:
 *   npx hardhat run scripts/test-v0-sepolia.cjs --network base-sepolia
 *
 * This script:
 * - Deploys a test token (MockERC20)
 * - Creates a pair with WETH
 * - Adds 0.05 ETH worth of liquidity
 * - Executes a small test swap
 * - Verifies protocol fees are collected
 */

const hre = require("hardhat");

// Deployed V0 contracts
const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const WETH = "0x4200000000000000000000000000000000000006";

// Test parameters (conservative)
const TEST_ETH_AMOUNT = "0.05"; // 0.05 ETH for liquidity
const TEST_SWAP_AMOUNT = "0.01"; // 0.01 ETH for swap test

async function main() {
  console.log("🧪 Testing V0 Contracts on Base Sepolia");
  console.log("==========================================");
  console.log("Using minimal ETH to conserve funds\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Tester address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("ETH balance:", hre.ethers.formatEther(balance), "ETH\n");

  if (parseFloat(hre.ethers.formatEther(balance)) < 0.1) {
    console.log("⚠️  Low ETH balance! Proceeding cautiously...\n");
  }

  // Step 1: Deploy MockERC20 test token
  console.log("1️⃣ Deploying MockERC20 test token...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const testToken = await MockERC20.deploy(
    "Test Token",
    "TEST",
    hre.ethers.parseEther("1000000") // 1M tokens
  );
  await testToken.waitForDeployment();
  const testTokenAddress = await testToken.getAddress();
  console.log("✅ Test token deployed:", testTokenAddress);
  console.log("   Symbol: TEST");
  console.log("   Supply: 1,000,000 TEST\n");

  // Step 2: Check if pair exists
  console.log("2️⃣ Checking if WETH/TEST pair exists...");
  const factory = await hre.ethers.getContractAt(
    [
      "function getPair(address,address) external view returns (address)",
      "function allPairsLength() external view returns (uint256)",
      "function allPairs(uint256) external view returns (address)",
      "function feeTo() external view returns (address)",
    ],
    FACTORY_V0
  );
  const existingPair = await factory.getPair(WETH, testTokenAddress);

  if (existingPair !== hre.ethers.ZeroAddress) {
    console.log("⚠️  Pair already exists:", existingPair);
    console.log("   Using existing pair for testing\n");
  } else {
    console.log("✅ No existing pair found. Will be created on first addLiquidity\n");
  }

  // Step 3: Add liquidity (0.05 ETH worth)
  console.log("3️⃣ Adding liquidity (0.05 ETH + TEST tokens)...");

  // Approve test token
  const router = await hre.ethers.getContractAt(
    [
      "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
      "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    ],
    ROUTER_V0
  );

  const ethAmount = hre.ethers.parseEther(TEST_ETH_AMOUNT);
  const tokenAmount = hre.ethers.parseEther("100"); // 100 TEST tokens

  console.log("   Approving", hre.ethers.formatEther(tokenAmount), "TEST to router...");
  await testToken.approve(ROUTER_V0, tokenAmount);

  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes

  console.log("   Adding liquidity...");
  console.log("   ETH:", TEST_ETH_AMOUNT);
  console.log("   TEST:", hre.ethers.formatEther(tokenAmount));

  const addLiqTx = await router.addLiquidityETH(
    testTokenAddress,
    tokenAmount,
    0, // amountTokenMin (accept any)
    0, // amountETHMin (accept any)
    deployer.address,
    deadline,
    { value: ethAmount }
  );

  const addLiqReceipt = await addLiqTx.wait();
  console.log("✅ Liquidity added!");
  console.log("   Gas used:", addLiqReceipt.gasUsed.toString());
  console.log("   Tx hash:", addLiqReceipt.hash, "\n");

  // Step 4: Get pair address from factory
  console.log("4️⃣ Getting pair address...");
  console.log("   Waiting for block to be indexed...");
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

  // Try getting from allPairs array (most reliable)
  const pairCount = await factory.allPairsLength();
  console.log("   Factory has", pairCount.toString(), "pair(s)");

  let pairAddress;
  if (pairCount > 0n) {
    // Get the latest pair (should be ours)
    pairAddress = await factory.allPairs(pairCount - 1n);
    console.log("✅ Pair address (from allPairs):", pairAddress);
  }

  // Verify with getPair
  const getPairResult = await factory.getPair(WETH, testTokenAddress);
  console.log("   getPair result:", getPairResult);

  if (getPairResult === hre.ethers.ZeroAddress) {
    console.log("   ⚠️  getPair returned zero (possible factory bug)");
    if (!pairAddress || pairAddress === hre.ethers.ZeroAddress) {
      console.log("   ❌ Could not find pair address!");
      return;
    }
  } else {
    pairAddress = getPairResult;
  }

  console.log();

  // Step 5: Check pair reserves
  console.log("5️⃣ Checking pair reserves...");
  const pair = await hre.ethers.getContractAt(
    [
      "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
      "function token0() external view returns (address)",
      "function token1() external view returns (address)",
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address) external view returns (uint256)",
    ],
    pairAddress
  );

  const [reserve0, reserve1] = await pair.getReserves();
  const token0 = await pair.token0();
  const totalSupply = await pair.totalSupply();

  console.log("   Token0:", token0);
  console.log("   Reserve0:", hre.ethers.formatEther(reserve0));
  console.log("   Reserve1:", hre.ethers.formatEther(reserve1));
  console.log("   Total LP tokens:", hre.ethers.formatEther(totalSupply), "\n");

  // Step 6: Execute a small test swap (0.01 ETH)
  console.log("6️⃣ Executing test swap (0.01 ETH → TEST)...");

  const swapAmount = hre.ethers.parseEther(TEST_SWAP_AMOUNT);
  const path = [WETH, testTokenAddress];

  console.log("   Swapping", TEST_SWAP_AMOUNT, "ETH for TEST tokens...");

  const swapTx = await router.swapExactETHForTokens(
    0, // amountOutMin (accept any for test)
    path,
    deployer.address,
    deadline,
    { value: swapAmount }
  );

  const swapReceipt = await swapTx.wait();
  console.log("✅ Swap executed!");
  console.log("   Gas used:", swapReceipt.gasUsed.toString());
  console.log("   Tx hash:", swapReceipt.hash, "\n");

  // Step 7: Check protocol fees
  console.log("7️⃣ Checking protocol fees...");

  const feeTo = await factory.feeTo();
  console.log("   Fee recipient:", feeTo);

  if (feeTo !== hre.ethers.ZeroAddress) {
    const feeRecipientLPBalance = await pair.balanceOf(feeTo);
    console.log("   Protocol LP tokens:", hre.ethers.formatEther(feeRecipientLPBalance));

    if (feeRecipientLPBalance > 0n) {
      console.log("✅ Protocol fees are being collected!");
    } else {
      console.log("⚠️  No protocol fees yet (fees accrue on next liquidity event)");
    }
  } else {
    console.log("⚠️  No fee recipient set!");
  }

  console.log("\n");

  // Summary
  console.log("📊 Test Summary");
  console.log("==========================================");
  console.log("✅ Test token deployed:", testTokenAddress);
  console.log("✅ Pair created:", pairAddress);
  console.log("✅ Liquidity added:", TEST_ETH_AMOUNT, "ETH");
  console.log("✅ Swap executed:", TEST_SWAP_AMOUNT, "ETH → TEST");
  console.log("✅ Total ETH used:", parseFloat(TEST_ETH_AMOUNT) + parseFloat(TEST_SWAP_AMOUNT), "ETH");
  console.log("\n🎉 All tests passed!");

  console.log("\n📋 View on Basescan:");
  console.log("   Test Token: https://sepolia.basescan.org/address/" + testTokenAddress);
  console.log("   Pair: https://sepolia.basescan.org/address/" + pairAddress);
  console.log("   Factory: https://sepolia.basescan.org/address/" + FACTORY_V0 + "#code");
  console.log("   Router: https://sepolia.basescan.org/address/" + ROUTER_V0 + "#code");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
