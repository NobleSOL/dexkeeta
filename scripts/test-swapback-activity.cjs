/**
 * Generate swap activity with burner wallet to trigger swapBack mechanism
 */

const hre = require("hardhat");

const ROUTER_V0 = "0x342d3879EbE201Db0966B595650c6614390857fa";
const WETH = "0x4200000000000000000000000000000000000006";

// Use the BUYTAX token that was deployed successfully
const TAX_TOKEN = "0xd9A8A64b8044088d2EA05CAF2449E984b6c6b8fC";
const PAIR_ADDRESS = "0x025259A879Fc21E4ED5Bd81b9988C81754471B81";

async function main() {
  console.log("🔄 Testing SwapBack Mechanism with Multiple Swaps");
  console.log("=".repeat(60));
  console.log();

  const [deployer] = await hre.ethers.getSigners();

  // Check balances
  const deployerBal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Deployer balance:", hre.ethers.formatEther(deployerBal), "ETH");

  // Get burner from previous test (we need to recreate with same private key or fund a new one)
  const burner = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log("🔥 Burner address:", burner.address);

  // Fund burner with 0.05 ETH
  const fundTx = await deployer.sendTransaction({
    to: burner.address,
    value: hre.ethers.parseEther("0.05")
  });
  await fundTx.wait();
  console.log("✅ Burner funded with 0.05 ETH");
  console.log();

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address, uint256) external returns (bool)",
      "function transfer(address, uint256) external returns (bool)",
      "function swapThreshold() external view returns (uint256)",
      "function owner() external view returns (address)",
    ],
    TAX_TOKEN
  );

  const router = await hre.ethers.getContractAt(
    [
      "function swapExactETHForTokens(uint, address[], address, uint) external payable returns (uint[])",
      "function swapExactTokensForETH(uint, uint, address[], address, uint) external returns (uint[])",
    ],
    ROUTER_V0
  );

  const burnerRouter = router.connect(burner);

  console.log("📊 Tax Token Info:");
  console.log("   Address:", TAX_TOKEN);
  console.log("   Pair:", PAIR_ADDRESS);

  const swapThreshold = await token.swapThreshold();
  console.log("   SwapBack Threshold:", hre.ethers.formatEther(swapThreshold), "tokens");

  const tokenContractBalance = await token.balanceOf(TAX_TOKEN);
  console.log("   Contract balance:", hre.ethers.formatEther(tokenContractBalance), "tokens");

  const owner = await token.owner();
  console.log("   Owner:", owner);
  console.log();

  const deadline = Math.floor(Date.now() / 1000) + 1200;

  // Do 5 buy-sell cycles to accumulate tax in contract
  for (let i = 1; i <= 5; i++) {
    console.log(`🔄 Round ${i}/5`);
    console.log("-".repeat(60));

    // BUY: Swap 0.005 ETH for tokens
    console.log(`  📥 BUY: Swapping 0.005 ETH → BUYTAX...`);
    const path = [WETH, TAX_TOKEN];

    const balanceBefore = await token.balanceOf(burner.address);
    const contractBalBefore = await token.balanceOf(TAX_TOKEN);

    const buyTx = await burnerRouter.swapExactETHForTokens(
      0,
      path,
      burner.address,
      deadline,
      { value: hre.ethers.parseEther("0.005") }
    );
    const buyReceipt = await buyTx.wait();

    const balanceAfter = await token.balanceOf(burner.address);
    const contractBalAfter = await token.balanceOf(TAX_TOKEN);
    const tokensReceived = balanceAfter - balanceBefore;
    const taxCollected = contractBalAfter - contractBalBefore;

    console.log(`  ✅ Received: ${hre.ethers.formatEther(tokensReceived)} BUYTAX`);
    console.log(`  💰 Tax collected: ${hre.ethers.formatEther(taxCollected)} BUYTAX`);
    console.log(`  📦 Contract balance: ${hre.ethers.formatEther(contractBalAfter)} BUYTAX`);
    console.log(`  ⛽ Gas: ${buyReceipt.gasUsed.toString()}`);

    // Check if swapBack happened (look at events or contract balance drop)
    if (contractBalAfter < contractBalBefore && contractBalBefore > 0n) {
      console.log(`  🔄 ⚡ SWAPBACK TRIGGERED! Contract sold ${hre.ethers.formatEther(contractBalBefore - contractBalAfter)} tokens`);
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // SELL: Sell half of what we bought
    const sellAmount = tokensReceived / 2n;
    if (sellAmount > 0n) {
      console.log(`  📤 SELL: Swapping ${hre.ethers.formatEther(sellAmount)} BUYTAX → ETH...`);

      const burnerToken = token.connect(burner);
      await burnerToken.approve(ROUTER_V0, sellAmount);

      const contractBalBeforeSell = await token.balanceOf(TAX_TOKEN);
      const reversePath = [TAX_TOKEN, WETH];

      const sellTx = await burnerRouter.swapExactTokensForETH(
        sellAmount,
        0,
        reversePath,
        burner.address,
        deadline
      );
      const sellReceipt = await sellTx.wait();

      const contractBalAfterSell = await token.balanceOf(TAX_TOKEN);
      const taxFromSell = contractBalAfterSell - contractBalBeforeSell;

      console.log(`  ✅ Sold ${hre.ethers.formatEther(sellAmount)} BUYTAX`);
      console.log(`  💰 Tax collected: ${hre.ethers.formatEther(taxFromSell)} BUYTAX`);
      console.log(`  📦 Contract balance: ${hre.ethers.formatEther(contractBalAfterSell)} BUYTAX`);
      console.log(`  ⛽ Gas: ${sellReceipt.gasUsed.toString()}`);

      if (contractBalAfterSell < contractBalBeforeSell && contractBalBeforeSell > 0n) {
        console.log(`  🔄 ⚡ SWAPBACK TRIGGERED! Contract sold ${hre.ethers.formatEther(contractBalBeforeSell - contractBalAfterSell)} tokens`);
      }
    }

    console.log();
  }

  // Final status
  const finalContractBal = await token.balanceOf(TAX_TOKEN);
  const finalBurnerBal = await token.balanceOf(burner.address);
  const finalBurnerEth = await hre.ethers.provider.getBalance(burner.address);

  console.log("=".repeat(60));
  console.log("📊 Final Status");
  console.log("=".repeat(60));
  console.log("Contract balance:", hre.ethers.formatEther(finalContractBal), "BUYTAX");
  console.log("Burner tokens:", hre.ethers.formatEther(finalBurnerBal), "BUYTAX");
  console.log("Burner ETH:", hre.ethers.formatEther(finalBurnerEth), "ETH");
  console.log();
  console.log("✅ SwapBack testing complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
