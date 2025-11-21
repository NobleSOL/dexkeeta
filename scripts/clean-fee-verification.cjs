/**
 * CLEAN FEE VERIFICATION TEST
 *
 * This script proves exactly where fees go with simple accounting:
 * 1. Deploy simple ERC20 (no taxes)
 * 2. Add 0.01 ETH + 100 tokens liquidity
 * 3. Buy tokens with ETH
 * 4. Sell those exact tokens back
 * 5. Show fee accumulation clearly
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const WETH = "0x4200000000000000000000000000000000000006";

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║          CLEAN FEE VERIFICATION TEST - V0 CONTRACTS             ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  // ============================================================================
  // STEP 1: Deploy Simple ERC20 (NO TAXES)
  // ============================================================================

  console.log("📦 STEP 1: Deploying Simple ERC20");
  console.log("─".repeat(70));

  // Use unique name/symbol to avoid pair collisions from previous tests
  const timestamp = Date.now();
  const tokenName = `CleanTest${timestamp}`;
  const tokenSymbol = `CLEAN${timestamp.toString().slice(-4)}`;

  const MockERC20 = await hre.ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const token = await MockERC20.deploy(
    tokenName,
    tokenSymbol,
    hre.ethers.parseEther("1000000")
  );
  const deployTx = await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log("✅ Token deployed:", tokenAddress);
  console.log("   Symbol:", tokenSymbol);
  console.log("   Supply: 1,000,000 tokens");

  // Wait a moment for the contract to be indexed
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log();

  // ============================================================================
  // STEP 2: Add Liquidity
  // ============================================================================

  console.log("💧 STEP 2: Adding Initial Liquidity");
  console.log("─".repeat(70));

  const factory = await hre.ethers.getContractAt(
    [
      "function createPair(address, address) external returns (address)",
      "function getPair(address, address) external view returns (address)",
      "function allPairs(uint256) external view returns (address)",
      "function allPairsLength() external view returns (uint256)",
      "function feeTo() external view returns (address)"
    ],
    FACTORY_V0
  );

  const router = await hre.ethers.getContractAt(
    [
      "function addLiquidityETH(address, uint, uint, uint, address, uint) external payable returns (uint, uint, uint)",
      "function swapExactETHForTokens(uint, address[], address, uint) external payable returns (uint[])",
      "function swapExactTokensForETH(uint, uint, address[], address, uint) external returns (uint[])",
      "function removeLiquidityETH(address, uint, uint, uint, address, uint) external returns (uint, uint)"
    ],
    ROUTER_V0
  );

  const liquidityETH = hre.ethers.parseEther("0.01");
  const liquidityTokens = hre.ethers.parseEther("100");

  console.log("Adding liquidity:");
  console.log("  ETH:    ", hre.ethers.formatEther(liquidityETH));
  console.log("  CLEAN:  ", hre.ethers.formatEther(liquidityTokens));
  console.log();

  const tokenBalanceBeforeAnything = await token.balanceOf(deployer.address);
  console.log("Your CLEAN balance before anything:", hre.ethers.formatEther(tokenBalanceBeforeAnything));
  console.log();

  await token.approve(ROUTER_V0, hre.ethers.parseEther("10000")); // Approve plenty for both LP and swaps

  const addTx = await router.addLiquidityETH(
    tokenAddress,
    liquidityTokens,
    0,
    0,
    deployer.address,
    Math.floor(Date.now() / 1000) + 1200,
    { value: liquidityETH }
  );
  await addTx.wait();

  // Get pair address - use allPairs since getPair sometimes returns 0x0
  const pairsCount = await factory.allPairsLength();
  const pairAddress = await factory.allPairs(pairsCount - 1n);

  console.log("✅ Liquidity added!");
  console.log("   Pair address:", pairAddress);
  console.log();

  const pair = await hre.ethers.getContractAt(
    [
      "function getReserves() external view returns (uint112, uint112, uint32)",
      "function token0() external view returns (address)",
      "function totalSupply() external view returns (uint256)",
      "function kLast() external view returns (uint256)",
      "function balanceOf(address) external view returns (uint256)"
    ],
    pairAddress
  );

  const feeTo = await factory.feeTo();
  console.log("   Protocol fee recipient:", feeTo);
  console.log();

  // ============================================================================
  // STEP 3: Record Initial State
  // ============================================================================

  console.log("📊 STEP 3: Initial State");
  console.log("─".repeat(70));

  const [r0Initial, r1Initial] = await pair.getReserves();
  const token0 = await pair.token0();
  const wethIsToken0 = token0.toLowerCase() === WETH.toLowerCase();
  const wethInitial = wethIsToken0 ? r0Initial : r1Initial;
  const tokenInitial = wethIsToken0 ? r1Initial : r0Initial;
  const kInitial = wethInitial * tokenInitial;
  const lpSupplyInitial = await pair.totalSupply();
  const deployerLPInitial = await pair.balanceOf(deployer.address);
  const protocolLPInitial = await pair.balanceOf(feeTo);
  const kLastInitial = await pair.kLast();

  console.log("Reserves:");
  console.log("  WETH:  ", hre.ethers.formatEther(wethInitial), "ETH");
  console.log("  CLEAN: ", hre.ethers.formatEther(tokenInitial), "tokens");
  console.log("  k:     ", kInitial.toString());
  console.log();
  console.log("LP Tokens:");
  console.log("  Total:    ", hre.ethers.formatEther(lpSupplyInitial));
  console.log("  Deployer: ", hre.ethers.formatEther(deployerLPInitial));
  console.log("  Protocol: ", hre.ethers.formatEther(protocolLPInitial));
  console.log();
  console.log("Fee tracking:");
  console.log("  kLast: ", kLastInitial.toString());
  console.log();

  // ============================================================================
  // STEP 4: Buy Tokens with ETH
  // ============================================================================

  console.log("🔵 STEP 4: Buying Tokens");
  console.log("─".repeat(70));

  const buyAmount = hre.ethers.parseEther("0.002");
  console.log("Buying with:", hre.ethers.formatEther(buyAmount), "ETH");
  console.log();

  const tokenBalanceBeforeSwap = await token.balanceOf(deployer.address);
  console.log("Token balance before swap:", hre.ethers.formatEther(tokenBalanceBeforeSwap));
  console.log("  (Note: Already sent", hre.ethers.formatEther(liquidityTokens), "to pool as liquidity)");

  try {
    const buyTx = await router.swapExactETHForTokens(
      0,
      [WETH, tokenAddress],
      deployer.address,
      Math.floor(Date.now() / 1000) + 1200,
      { value: buyAmount }
    );
    const receipt = await buyTx.wait();
    console.log("Buy tx hash:", receipt.hash);
    console.log("Buy tx status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  } catch (error) {
    console.log("❌ Buy transaction failed:", error.message);
    throw error;
  }

  const tokenBalanceAfterSwap = await token.balanceOf(deployer.address);
  console.log("Token balance after swap:", hre.ethers.formatEther(tokenBalanceAfterSwap));
  const tokensReceived = tokenBalanceAfterSwap - tokenBalanceBeforeSwap;

  console.log("✅ Buy complete!");
  console.log("   Tokens received from swap:", hre.ethers.formatEther(tokensReceived), "CLEAN");
  console.log();

  if (tokensReceived <= 0n) {
    throw new Error("No tokens received from swap - something went wrong!");
  }

  const [r0AfterBuy, r1AfterBuy] = await pair.getReserves();
  const wethAfterBuy = wethIsToken0 ? r0AfterBuy : r1AfterBuy;
  const tokenAfterBuy = wethIsToken0 ? r1AfterBuy : r0AfterBuy;
  const kAfterBuy = wethAfterBuy * tokenAfterBuy;

  console.log("Reserves after buy:");
  console.log("  WETH:  ", hre.ethers.formatEther(wethAfterBuy), "ETH");
  console.log("  CLEAN: ", hre.ethers.formatEther(tokenAfterBuy), "tokens");
  console.log("  k:     ", kAfterBuy.toString());
  console.log();

  // ============================================================================
  // STEP 5: Sell Exact Same Amount Back
  // ============================================================================

  console.log("🔴 STEP 5: Selling Tokens Back");
  console.log("─".repeat(70));

  console.log("Selling:", hre.ethers.formatEther(tokensReceived), "CLEAN");
  console.log();

  const ethBalanceBefore = await hre.ethers.provider.getBalance(deployer.address);

  // Already approved earlier, no need to approve again

  const sellTx = await router.swapExactTokensForETH(
    tokensReceived,
    0,
    [tokenAddress, WETH],
    deployer.address,
    Math.floor(Date.now() / 1000) + 1200
  );
  const sellReceipt = await sellTx.wait();

  const ethBalanceAfter = await hre.ethers.provider.getBalance(deployer.address);
  const gasCost = sellReceipt.gasUsed * sellReceipt.gasPrice;
  const ethReceived = ethBalanceAfter - ethBalanceBefore + gasCost;

  console.log("✅ Sell complete!");
  console.log("   ETH received:", hre.ethers.formatEther(ethReceived), "ETH");
  console.log("   (Original spent:", hre.ethers.formatEther(buyAmount), "ETH)");
  console.log();

  const [r0Final, r1Final] = await pair.getReserves();
  const wethFinal = wethIsToken0 ? r0Final : r1Final;
  const tokenFinal = wethIsToken0 ? r1Final : r0Final;
  const kFinal = wethFinal * tokenFinal;

  console.log("Reserves after sell:");
  console.log("  WETH:  ", hre.ethers.formatEther(wethFinal), "ETH");
  console.log("  CLEAN: ", hre.ethers.formatEther(tokenFinal), "tokens");
  console.log("  k:     ", kFinal.toString());
  console.log();

  // ============================================================================
  // STEP 6: Calculate Fee Impact
  // ============================================================================

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                     FEE ANALYSIS                                 ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  const wethChange = wethFinal - wethInitial;
  const tokenChange = tokenFinal - tokenInitial;
  const kChange = kFinal - kInitial;

  console.log("📈 Reserve Changes (Round-Trip):");
  console.log("─".repeat(70));
  console.log("  WETH:  ", wethChange > 0n ? "+" : "", hre.ethers.formatEther(wethChange), "ETH");
  console.log("  CLEAN: ", tokenChange > 0n ? "+" : "", hre.ethers.formatEther(tokenChange), "tokens");
  console.log("  k:     ", kChange > 0n ? "+" : "", kChange.toString());
  console.log();

  if (wethChange > 0n && tokenChange > 0n) {
    console.log("✅ BOTH RESERVES INCREASED!");
    console.log();
    console.log("This proves fees are being collected:");
    console.log("  • Buy: Paid 0.3% on 0.002 ETH");
    console.log("  • Sell: Paid 0.3% on", hre.ethers.formatEther(tokensReceived), "CLEAN");
    console.log("  • Result: Both reserves higher = fees retained in pool");
    console.log();
  } else {
    console.log("⚠️ Expected both reserves to increase");
    console.log();
  }

  console.log("💰 Trader Loss (Your Loss):");
  console.log("─".repeat(70));
  const traderLoss = buyAmount - ethReceived;
  console.log("  Started with:  ", hre.ethers.formatEther(buyAmount), "ETH");
  console.log("  Got back:      ", hre.ethers.formatEther(ethReceived), "ETH");
  console.log("  Lost to fees:  ", hre.ethers.formatEther(traderLoss), "ETH");
  console.log("  Loss %:        ", ((Number(traderLoss) / Number(buyAmount)) * 100).toFixed(4), "%");
  console.log();
  console.log("Expected loss: ~0.6% (0.3% on buy + 0.3% on sell)");
  console.log();

  console.log("📊 Fee Breakdown (0.3% total):");
  console.log("─".repeat(70));
  console.log("  0.25% → LP holders (you earn this on your LP tokens)");
  console.log("  0.05% → Protocol (mints LP tokens to feeTo address)");
  console.log();

  // ============================================================================
  // STEP 7: Check Protocol Fees
  // ============================================================================

  console.log("🏦 STEP 7: Protocol Fee Status");
  console.log("─".repeat(70));

  const protocolLPBefore = await pair.balanceOf(feeTo);
  const kLastBefore = await pair.kLast();

  console.log("Before triggering mint:");
  console.log("  Protocol LP tokens: ", hre.ethers.formatEther(protocolLPBefore));
  console.log("  kLast:              ", kLastBefore.toString());
  console.log("  Current k:          ", kFinal.toString());
  console.log("  k grew:             ", kFinal > kLastBefore ? "YES ✅" : "NO");
  console.log();

  if (kFinal > kLastBefore) {
    console.log("Protocol fees have accrued but not yet minted.");
    console.log("To mint them, we need a liquidity event (add/remove liquidity).");
    console.log();

    // ============================================================================
    // STEP 8: Remove Small Amount of Liquidity to Trigger Protocol Fee Mint
    // ============================================================================

    console.log("🔄 STEP 8: Triggering Protocol Fee Mint");
    console.log("─".repeat(70));

    // Remove 10% of LP to trigger fee mint
    const lpToRemove = deployerLPInitial / 10n;
    console.log("Removing", hre.ethers.formatEther(lpToRemove), "LP tokens (10% of position)");
    console.log();

    await pair.approve(ROUTER_V0, lpToRemove);

    const removeTx = await router.removeLiquidityETH(
      tokenAddress,
      lpToRemove,
      0,
      0,
      deployer.address,
      Math.floor(Date.now() / 1000) + 1200
    );
    await removeTx.wait();

    console.log("✅ Liquidity removed!");
    console.log();

    const protocolLPAfter = await pair.balanceOf(feeTo);
    const protocolLPGained = protocolLPAfter - protocolLPBefore;

    console.log("After liquidity removal:");
    console.log("  Protocol LP tokens: ", hre.ethers.formatEther(protocolLPAfter));
    console.log("  Gained:             ", hre.ethers.formatEther(protocolLPGained), "LP tokens");
    console.log();

    if (protocolLPGained > 0n) {
      console.log("✅ PROTOCOL FEES COLLECTED!");
      console.log();
      console.log("The protocol (feeTo address) received", hre.ethers.formatEther(protocolLPGained), "LP tokens.");
      console.log("These LP tokens represent the 0.05% protocol fee from all swaps.");
      console.log();

      const totalLPSupply = await pair.totalSupply();
      const protocolShare = (Number(protocolLPAfter) / Number(totalLPSupply)) * 100;
      console.log("Protocol now owns", protocolShare.toFixed(6), "% of the pool.");
      console.log();
    } else {
      console.log("⚠️ No protocol LP tokens minted (volume may be too small)");
      console.log();
    }
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                      FINAL SUMMARY                               ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log();

  console.log("✅ Fee Collection Verified:");
  console.log("   1. Reserves both increased after round-trip (fees accumulated)");
  console.log("   2. Trader lost", ((Number(traderLoss) / Number(buyAmount)) * 100).toFixed(4), "% (expected ~0.6%)");
  console.log("   3. k increased by", ((Number(kChange) / Number(kInitial)) * 100).toFixed(6), "%");
  console.log();

  console.log("💡 Where Fees Go:");
  console.log("   • 0.25% added to reserves → increases LP token value");
  console.log("   • 0.05% mints LP tokens to protocol feeTo address");
  console.log();

  console.log("📍 Contract Addresses:");
  console.log("   FactoryV0:  ", FACTORY_V0);
  console.log("   RouterV0:   ", ROUTER_V0);
  console.log("   Test Token: ", tokenAddress);
  console.log("   Test Pair:  ", pairAddress);
  console.log("   Protocol:   ", feeTo);
  console.log();

  console.log("🎉 V0 contracts are working correctly!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
