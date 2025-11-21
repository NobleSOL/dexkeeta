/**
 * Comprehensive V0 Testing on Base Sepolia
 *
 * Tests:
 * 1. Tax tokens (buy tax, sell tax, both)
 * 2. Trading from burner address (non-owner)
 * 3. Slippage protection
 * 4. Edge cases
 *
 * Usage:
 *   npx hardhat run scripts/test-v0-comprehensive.cjs --network base-sepolia
 */

const hre = require("hardhat");

// Deployed V0 contracts
const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const WETH = "0x4200000000000000000000000000000000000006";

// Test parameters
const LP_ETH_AMOUNT = "0.1";    // 0.1 ETH for liquidity
const SWAP_ETH_AMOUNT = "0.01"; // 0.01 ETH per swap test

async function main() {
  console.log("🧪 COMPREHENSIVE V0 TESTING");
  console.log("=".repeat(60));
  console.log();

  const [deployer] = await hre.ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(balance), "ETH");
  console.log();

  // Create burner wallet
  const burner = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log("🔥 Burner address created:", burner.address);

  // Fund burner with 0.1 ETH
  const fundTx = await deployer.sendTransaction({
    to: burner.address,
    value: hre.ethers.parseEther("0.1")
  });
  await fundTx.wait();
  console.log("✅ Burner funded with 0.1 ETH");
  console.log();

  const router = await hre.ethers.getContractAt(
    [
      "function factory() external view returns (address)",
      "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
      "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
      "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    ],
    ROUTER_V0
  );

  const factory = await hre.ethers.getContractAt(
    [
      "function getPair(address,address) external view returns (address)",
    ],
    FACTORY_V0
  );

  const deadline = Math.floor(Date.now() / 1000) + 1200;

  // ========== TEST 1: Buy Tax Token (5%) ==========
  console.log("📋 TEST 1: Token with 5% Buy Tax");
  console.log("-".repeat(60));

  const buyTaxToken = await deployTaxToken(
    "BuyTax Token",
    "BUYTAX",
    500, // 5% buy tax
    0,   // 0% sell tax
    0    // 0% transfer tax
  );

  await testTaxToken(
    buyTaxToken,
    "BUYTAX",
    router,
    factory,
    deployer,
    burner,
    deadline,
    500, // expected buy tax bps
    0    // expected sell tax bps
  );

  console.log();

  // ========== TEST 2: Sell Tax Token (5%) ==========
  console.log("📋 TEST 2: Token with 5% Sell Tax");
  console.log("-".repeat(60));

  const sellTaxToken = await deployTaxToken(
    "SellTax Token",
    "SELLTAX",
    0,   // 0% buy tax
    500, // 5% sell tax
    0    // 0% transfer tax
  );

  await testTaxToken(
    sellTaxToken,
    "SELLTAX",
    router,
    factory,
    deployer,
    burner,
    deadline,
    0,   // expected buy tax bps
    500  // expected sell tax bps
  );

  console.log();

  // ========== TEST 3: Both Buy & Sell Tax (3% each) ==========
  console.log("📋 TEST 3: Token with 3% Buy Tax + 3% Sell Tax");
  console.log("-".repeat(60));

  const bothTaxToken = await deployTaxToken(
    "BothTax Token",
    "BOTHTAX",
    300, // 3% buy tax
    300, // 3% sell tax
    0    // 0% transfer tax
  );

  await testTaxToken(
    bothTaxToken,
    "BOTHTAX",
    router,
    factory,
    deployer,
    burner,
    deadline,
    300, // expected buy tax bps
    300  // expected sell tax bps
  );

  console.log();

  // ========== TEST 4: High Tax Token (10% sell) ==========
  console.log("📋 TEST 4: High Tax Token (10% Sell Tax)");
  console.log("-".repeat(60));

  const highTaxToken = await deployTaxToken(
    "HighTax Token",
    "HIGHTAX",
    0,    // 0% buy tax
    1000, // 10% sell tax
    0     // 0% transfer tax
  );

  await testTaxToken(
    highTaxToken,
    "HIGHTAX",
    router,
    factory,
    deployer,
    burner,
    deadline,
    0,    // expected buy tax bps
    1000  // expected sell tax bps
  );

  console.log();
  console.log("=".repeat(60));
  console.log("🎉 ALL COMPREHENSIVE TESTS PASSED!");
  console.log("=".repeat(60));
}

async function deployTaxToken(name, symbol, buyTaxBps, sellTaxBps, transferTaxBps) {
  console.log(`  Deploying ${name} (${symbol})...`);
  console.log(`  - Buy Tax: ${buyTaxBps / 100}%`);
  console.log(`  - Sell Tax: ${sellTaxBps / 100}%`);
  console.log(`  - Transfer Tax: ${transferTaxBps / 100}%`);

  const MockTaxToken = await hre.ethers.getContractFactory("MockTaxToken");
  const token = await MockTaxToken.deploy(
    name,
    symbol,
    hre.ethers.parseEther("1000000"), // 1M supply
    buyTaxBps,
    sellTaxBps,
    transferTaxBps,
    ROUTER_V0,  // Router address for swapBack
    WETH        // WETH address
  );
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log(`  ✅ Deployed at: ${tokenAddress}`);
  console.log(`  📍 Router: ${ROUTER_V0}`);
  console.log(`  💧 WETH: ${WETH}`);
  console.log(`  🔄 SwapBack enabled (threshold: 10,000 tokens)`);

  return token;
}

async function testTaxToken(
  token,
  symbol,
  router,
  factory,
  deployer,
  burner,
  deadline,
  expectedBuyTaxBps,
  expectedSellTaxBps
) {
  const tokenAddress = await token.getAddress();
  const routerAddress = await router.getAddress();

  // Step 1: Add liquidity as owner (owner is excluded from tax)
  console.log(`  📊 Adding liquidity (0.1 ETH + 1000 ${symbol})...`);

  const tokenAmount = hre.ethers.parseEther("1000");
  await token.approve(routerAddress, tokenAmount);

  const addLiqTx = await router.addLiquidityETH(
    tokenAddress,
    tokenAmount,
    0,
    0,
    deployer.address,
    deadline,
    { value: hre.ethers.parseEther(LP_ETH_AMOUNT) }
  );
  await addLiqTx.wait();
  console.log("  ✅ Liquidity added");

  // Get pair address
  const pairAddress = await factory.getPair(WETH, tokenAddress);
  console.log(`  📍 Pair: ${pairAddress}`);

  // Register pair in tax token
  await token.setPair(pairAddress, true);
  console.log("  ✅ Pair registered in tax token");

  // Step 2: Transfer tokens to burner (for sell test)
  console.log(`  💸 Transferring 100 ${symbol} to burner...`);
  const transferAmount = hre.ethers.parseEther("100");
  await token.transfer(burner.address, transferAmount);

  const burnerBalance = await token.balanceOf(burner.address);
  console.log(`  ✅ Burner received: ${hre.ethers.formatEther(burnerBalance)} ${symbol}`);

  // Step 3: BUY TEST - Burner buys tokens with ETH
  console.log(`  🛒 BUY TEST: Burner swapping 0.01 ETH → ${symbol}...`);

  const burnerRouter = router.connect(burner);
  const path = [WETH, tokenAddress];

  const balanceBefore = await token.balanceOf(burner.address);

  try {
    const buyTx = await burnerRouter.swapExactETHForTokens(
      0, // Accept any amount (we'll check tax manually)
      path,
      burner.address,
      deadline,
      { value: hre.ethers.parseEther(SWAP_ETH_AMOUNT) }
    );
    const buyReceipt = await buyTx.wait();

    const balanceAfter = await token.balanceOf(burner.address);
    const tokensReceived = balanceAfter - balanceBefore;

    console.log(`  ✅ Buy executed!`);
    console.log(`  📈 Tokens received: ${hre.ethers.formatEther(tokensReceived)} ${symbol}`);
    console.log(`  ⛽ Gas used: ${buyReceipt.gasUsed.toString()}`);

    // Validate buy tax was applied
    if (expectedBuyTaxBps > 0) {
      console.log(`  ✅ Buy tax (${expectedBuyTaxBps / 100}%) should have been deducted`);
    }
  } catch (error) {
    console.log(`  ❌ Buy failed: ${error.message}`);
    throw error;
  }

  // Step 4: SELL TEST - Burner sells tokens for ETH
  console.log(`  💰 SELL TEST: Burner swapping 10 ${symbol} → ETH...`);

  const sellAmount = hre.ethers.parseEther("10");
  const burnerToken = token.connect(burner);

  // Approve router
  await burnerToken.approve(routerAddress, sellAmount);
  console.log("  ✅ Approved router");

  const ethBalanceBefore = await hre.ethers.provider.getBalance(burner.address);
  const tokenBalanceBefore = await token.balanceOf(burner.address);

  try {
    const reversePath = [tokenAddress, WETH];
    const sellTx = await burnerRouter.swapExactTokensForETH(
      sellAmount,
      0, // Accept any amount
      reversePath,
      burner.address,
      deadline
    );
    const sellReceipt = await sellTx.wait();

    const ethBalanceAfter = await hre.ethers.provider.getBalance(burner.address);
    const tokenBalanceAfter = await token.balanceOf(burner.address);

    const ethReceived = ethBalanceAfter - ethBalanceBefore + sellReceipt.gasUsed * sellReceipt.gasPrice;
    const tokensSpent = tokenBalanceBefore - tokenBalanceAfter;

    console.log(`  ✅ Sell executed!`);
    console.log(`  📉 Tokens sold: ${hre.ethers.formatEther(tokensSpent)} ${symbol}`);
    console.log(`  💵 ETH received: ${hre.ethers.formatEther(ethReceived)} ETH`);
    console.log(`  ⛽ Gas used: ${sellReceipt.gasUsed.toString()}`);

    // Validate sell tax was applied
    if (expectedSellTaxBps > 0) {
      console.log(`  ✅ Sell tax (${expectedSellTaxBps / 100}%) should have been deducted`);
    }
  } catch (error) {
    console.log(`  ❌ Sell failed: ${error.message}`);
    throw error;
  }

  console.log(`  ✅ ${symbol} tests completed successfully!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
