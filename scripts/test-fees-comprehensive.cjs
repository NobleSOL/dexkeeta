/**
 * Comprehensive fee testing:
 * 1. Track tax token swapBack mechanism
 * 2. Track protocol LP fees going to feeTo address
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const FACTORY_V0 = "0x099869678bCCc5514e870e7d5A8FacF0E7cFF877";
const WETH = "0x4200000000000000000000000000000000000006";
const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const PAIR = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";

async function main() {
  console.log("💰 COMPREHENSIVE FEE TRACKING TEST");
  console.log("=".repeat(70));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  // Create fresh burner
  const burner = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log("🔥 Burner address:", burner.address);

  // Fund burner with 0.05 ETH
  const fundTx = await deployer.sendTransaction({
    to: burner.address,
    value: hre.ethers.parseEther("0.05")
  });
  await fundTx.wait();
  console.log("✅ Burner funded with 0.05 ETH\n");

  const factory = await hre.ethers.getContractAt(
    ["function feeTo() external view returns (address)"],
    FACTORY_V0
  );

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address, uint256) external returns (bool)",
      "function taxRecipient() external view returns (address)",
    ],
    TAX_TOKEN
  );

  const pair = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function totalSupply() external view returns (uint256)",
      "function getReserves() external view returns (uint112, uint112, uint32)",
    ],
    PAIR
  );

  const router = await hre.ethers.getContractAt(
    [
      "function swapExactETHForTokens(uint, address[], address, uint) external payable returns (uint[])",
      "function swapExactTokensForETH(uint, uint, address[], address, uint) external returns (uint[])",
    ],
    ROUTER_V0
  );

  const burnerRouter = router.connect(burner);
  const burnerToken = token.connect(burner);

  const feeTo = await factory.feeTo();
  const taxRecipient = await token.taxRecipient();

  console.log("📊 Initial State:");
  console.log("-".repeat(70));

  // Track protocol LP fees
  const protocolLPBefore = await pair.balanceOf(feeTo);
  console.log("Protocol LP Tokens (feeTo):", hre.ethers.formatEther(protocolLPBefore), "LP");

  // Track tax token balance
  const taxContractBalBefore = await token.balanceOf(TAX_TOKEN);
  console.log("Tax Contract Balance:", hre.ethers.formatEther(taxContractBalBefore), "BUYTAX");

  // Track tax recipient ETH
  const taxRecipientEthBefore = await hre.ethers.provider.getBalance(taxRecipient);
  console.log("Tax Recipient ETH:", hre.ethers.formatEther(taxRecipientEthBefore), "ETH");

  // Track pair reserves and total supply
  const [reserve0Before, reserve1Before] = await pair.getReserves();
  const totalSupplyBefore = await pair.totalSupply();
  console.log("Pair Total LP Supply:", hre.ethers.formatEther(totalSupplyBefore), "LP");
  console.log("Pair Reserves:", hre.ethers.formatEther(reserve0Before), "WETH /", hre.ethers.formatEther(reserve1Before), "BUYTAX");
  console.log();

  const deadline = Math.floor(Date.now() / 1000) + 1200;

  // Do 10 buy-sell cycles to accumulate fees
  console.log("🔄 Executing 10 Buy-Sell Cycles...");
  console.log("-".repeat(70));

  for (let i = 1; i <= 10; i++) {
    process.stdout.write(`Round ${i}/10... `);

    // BUY
    const path = [WETH, TAX_TOKEN];
    const buyTx = await burnerRouter.swapExactETHForTokens(
      0,
      path,
      burner.address,
      deadline,
      { value: hre.ethers.parseEther("0.003") }
    );
    await buyTx.wait();

    // Check if swapBack triggered (look for high gas or balance drop)
    const taxBalAfterBuy = await token.balanceOf(TAX_TOKEN);
    const swappedBack = taxBalAfterBuy < taxContractBalBefore && taxContractBalBefore > 0n;

    if (swappedBack) {
      process.stdout.write("🔄 SWAPBACK! ");
    }

    // SELL half
    const burnerBal = await token.balanceOf(burner.address);
    if (burnerBal > 0n) {
      const sellAmount = burnerBal / 2n;
      await burnerToken.approve(ROUTER_V0, sellAmount);

      const reversePath = [TAX_TOKEN, WETH];
      const sellTx = await burnerRouter.swapExactTokensForETH(
        sellAmount,
        0,
        reversePath,
        burner.address,
        deadline
      );
      await sellTx.wait();
    }

    console.log("✅");

    // Brief delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log();
  console.log("📊 Final State:");
  console.log("-".repeat(70));

  // Track protocol LP fees
  const protocolLPAfter = await pair.balanceOf(feeTo);
  const protocolLPGained = protocolLPAfter - protocolLPBefore;
  console.log("Protocol LP Tokens (feeTo):", hre.ethers.formatEther(protocolLPAfter), "LP");
  console.log("  → Gained:", hre.ethers.formatEther(protocolLPGained), "LP", protocolLPGained > 0n ? "✅" : "❌");

  // Track tax token balance
  const taxContractBalAfter = await token.balanceOf(TAX_TOKEN);
  const taxAccumulated = taxContractBalAfter - taxContractBalBefore;
  console.log("Tax Contract Balance:", hre.ethers.formatEther(taxContractBalAfter), "BUYTAX");
  console.log("  → Accumulated:", hre.ethers.formatEther(taxAccumulated), "BUYTAX");

  // Track tax recipient ETH
  const taxRecipientEthAfter = await hre.ethers.provider.getBalance(taxRecipient);
  const taxEthGained = taxRecipientEthAfter - taxRecipientEthBefore;
  console.log("Tax Recipient ETH:", hre.ethers.formatEther(taxRecipientEthAfter), "ETH");
  console.log("  → Gained:", hre.ethers.formatEther(taxEthGained), "ETH", taxEthGained > 0n ? "✅" : "❌");

  // Track pair reserves and total supply
  const [reserve0After, reserve1After] = await pair.getReserves();
  const totalSupplyAfter = await pair.totalSupply();
  const supplyGrowth = totalSupplyAfter - totalSupplyBefore;
  console.log("Pair Total LP Supply:", hre.ethers.formatEther(totalSupplyAfter), "LP");
  console.log("  → Grew by:", hre.ethers.formatEther(supplyGrowth), "LP");
  console.log("Pair Reserves:", hre.ethers.formatEther(reserve0After), "WETH /", hre.ethers.formatEther(reserve1After), "BUYTAX");

  console.log();
  console.log("=".repeat(70));
  console.log("💡 FEE ANALYSIS");
  console.log("=".repeat(70));

  console.log();
  console.log("1️⃣ PROTOCOL LP FEES (0.05% to feeTo via LP token minting):");
  if (protocolLPGained > 0n) {
    console.log("   ✅ Protocol received", hre.ethers.formatEther(protocolLPGained), "LP tokens");
    console.log("   ✅ Uniswap V2 protocol fee mechanism working!");
  } else {
    console.log("   ⚠️  No LP tokens minted to protocol yet");
    console.log("   ℹ️  Protocol fees accrue on next liquidity event (mint/burn)");
  }

  console.log();
  console.log("2️⃣ TAX TOKEN SWAPBACK (5% buy tax → collected → swapped to ETH):");
  if (taxEthGained > 0n) {
    console.log("   ✅ Tax recipient received", hre.ethers.formatEther(taxEthGained), "ETH");
    console.log("   ✅ SwapBack mechanism working!");
  } else {
    console.log("   ⚠️  No ETH received by tax recipient yet");
    if (taxContractBalAfter > 0n) {
      console.log("   ℹ️  Tax accumulated but threshold not reached for swapBack");
      console.log("      Current:", hre.ethers.formatEther(taxContractBalAfter), "tokens");
      console.log("      Need: 10,000 tokens for automatic trigger");
    }
  }

  console.log();
  console.log("3️⃣ TOTAL LP SUPPLY GROWTH:");
  if (supplyGrowth > 0n) {
    console.log("   ✅ LP supply grew by", hre.ethers.formatEther(supplyGrowth), "tokens");
    console.log("   ℹ️  This is from swaps adding liquidity depth");
  }

  console.log();
  console.log("✅ Comprehensive fee tracking complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
