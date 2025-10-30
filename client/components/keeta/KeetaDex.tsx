import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Wallet,
  ArrowRightLeft,
  ArrowDownUp,
  Plus,
  Droplets,
  ExternalLink,
  Copy,
  CheckCircle2,
  Info,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { KeetaPoolCard, KeetaPoolCardData } from "@/components/keeta/KeetaPoolCard";

// API base URL
const API_BASE = "http://localhost:8888/api";

type KeetaWallet = {
  address: string;
  seed: string;
  accountIndex?: number; // Account derivation index (default 0)
  tokens: {
    address: string;
    symbol: string;
    balance: string;
    balanceFormatted: string;
    decimals: number;
  }[];
};

type KeetaPool = {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  symbolA: string;
  symbolB: string;
  reserveA: string;
  reserveB: string;
  reserveAHuman: number;
  reserveBHuman: number;
  price: string;
  totalShares: string;
};

type KeetaPosition = {
  poolAddress: string;
  lpStorageAddress?: string; // User's LP storage account (optional for backwards compat)
  tokenA: string;
  tokenB: string;
  symbolA: string;
  symbolB: string;
  liquidity: string;
  sharePercent: number;
  amountA: string;
  amountB: string;
  timestamp: number;
};

export default function KeetaDex() {
  const [wallet, setWallet] = useState<KeetaWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [pools, setPools] = useState<KeetaPool[]>([]);
  const [positions, setPositions] = useState<KeetaPosition[]>([]);
  const [seedInput, setSeedInput] = useState("");
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showAllTokens, setShowAllTokens] = useState(false);
  const [newSeedBackup, setNewSeedBackup] = useState<string | null>(null);
  const [seedBackupConfirmed, setSeedBackupConfirmed] = useState(false);
  const [copiedSeed, setCopiedSeed] = useState(false);

  // Swap state
  const [selectedPoolForSwap, setSelectedPoolForSwap] = useState<string>("");
  const [swapTokenIn, setSwapTokenIn] = useState<string>("");
  const [swapAmount, setSwapAmount] = useState("");
  const [swapQuote, setSwapQuote] = useState<any>(null);
  const [swapping, setSwapping] = useState(false);

  // Add liquidity state
  const [selectedPoolForLiq, setSelectedPoolForLiq] = useState<string>("");
  const [liqAmountA, setLiqAmountA] = useState("");
  const [liqAmountB, setLiqAmountB] = useState("");
  const [addingLiq, setAddingLiq] = useState(false);

  // Pool creation state
  const [createMode, setCreateMode] = useState(false);
  const [newPoolTokenA, setNewPoolTokenA] = useState<string>("");
  const [newPoolTokenB, setNewPoolTokenB] = useState<string>("");
  const [creatingPool, setCreatingPool] = useState(false);

  // Remove liquidity state
  const [removeLiqPercent, setRemoveLiqPercent] = useState(100);
  const [removingLiq, setRemovingLiq] = useState(false);

  // Toggle tokens function for liquidity/swap
  function toggleSwapTokens() {
    const tempToken = swapTokenIn;
    setSwapTokenIn("");
    setSelectedPoolForSwap("");
    // Note: In current design, we select pool not individual out token
  }

  function toggleLiquidityTokens() {
    if (createMode) {
      // Swap Token A and Token B
      const tempToken = newPoolTokenA;
      const tempAmount = liqAmountA;
      setNewPoolTokenA(newPoolTokenB);
      setNewPoolTokenB(tempToken);
      setLiqAmountA(liqAmountB);
      setLiqAmountB(tempAmount);
    }
  }

  // Sort and filter tokens - KTA always first, then show top 5 (or all if expanded)
  const sortedTokens = wallet?.tokens.sort((a, b) => {
    if (a.symbol === "KTA") return -1;
    if (b.symbol === "KTA") return 1;
    return 0;
  }) || [];
  const displayedTokens = showAllTokens ? sortedTokens : sortedTokens.slice(0, 5);

  // Load wallet from localStorage on mount
  useEffect(() => {
    const savedWallet = localStorage.getItem("keetaWallet");
    if (savedWallet) {
      try {
        setWallet(JSON.parse(savedWallet));
      } catch (e) {
        console.error("Failed to load wallet:", e);
      }
    }
  }, []);

  // Fetch pools and positions when wallet is loaded
  useEffect(() => {
    if (wallet?.address) {
      fetchPools();
      fetchPositions();
    }
  }, [wallet?.address]);

  // Debug: Monitor newSeedBackup state changes
  useEffect(() => {
    console.log('🟣 newSeedBackup state changed:', newSeedBackup);
    console.log('🟣 Modal should be open:', !!newSeedBackup);
  }, [newSeedBackup]);

  async function generateWallet() {
    setLoading(true);
    try {
      console.log('🔵 Generating wallet, API_BASE:', API_BASE);
      const res = await fetch(`${API_BASE}/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      console.log('🔵 Response status:', res.status);
      const data = await res.json();
      console.log('🔵 Response data:', data);

      console.log('🔵 Checking data.seed:', data.seed);
      console.log('🔵 Type of data.seed:', typeof data.seed);

      if (data.seed) {
        console.log('✅ Seed received, showing modal. Setting newSeedBackup to:', data.seed);
        // Show seed backup modal instead of immediately saving
        setNewSeedBackup(data.seed);
        setSeedBackupConfirmed(false);
        console.log('✅ State updated. newSeedBackup should now be set.');
      } else {
        console.error('❌ No seed in response:', data);
        throw new Error(data.error || "Failed to generate wallet");
      }
    } catch (error: any) {
      console.error('❌ Generate wallet error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function confirmSeedBackup() {
    if (!newSeedBackup || !seedBackupConfirmed) {
      toast({
        title: "Confirmation Required",
        description: "Please confirm that you have saved your seed phrase",
        variant: "destructive",
      });
      return;
    }

    // Now actually import the wallet
    importWalletWithSeed(newSeedBackup);
    setNewSeedBackup(null);
    setSeedBackupConfirmed(false);
    setCopiedSeed(false);
  }

  async function importWalletWithSeed(seed: string, accountIndex: number = 0) {
    setLoading(true);
    try {
      console.log('🔍 Frontend: Sending seed to backend:', seed);
      console.log('🔍 Frontend: Account index:', accountIndex);

      // Clear old positions data before importing new wallet
      setPositions([]);
      setPools([]);

      const res = await fetch(`${API_BASE}/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", seed: seed, accountIndex }),
      });
      const data = await res.json();

      console.log('🔍 Frontend: Received from backend:', {
        seed: data.seed,
        address: data.address,
        accountIndex: data.accountIndex
      });

      if (data.seed) {
        const walletData: KeetaWallet = {
          address: data.address,
          seed: data.seed,
          accountIndex: data.accountIndex || 0,
          tokens: data.tokens || [],
        };
        setWallet(walletData);
        localStorage.setItem("keetaWallet", JSON.stringify(walletData));

        console.log('🔍 Frontend: Stored in localStorage:', walletData);

        toast({
          title: "Wallet Ready!",
          description: `Your wallet has been successfully set up (index ${walletData.accountIndex})`,
        });
      } else {
        throw new Error(data.error || "Failed to load wallet");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function importWallet() {
    if (!seedInput || seedInput.length !== 64) {
      toast({
        title: "Invalid Seed",
        description: "Seed must be 64 hex characters",
        variant: "destructive",
      });
      return;
    }

    // Use importWalletWithSeed helper with accountIndex 0 (default)
    await importWalletWithSeed(seedInput, 0);
    setSeedInput("");
  }

  function disconnectWallet() {
    setWallet(null);
    localStorage.removeItem("keetaWallet");
    setPools([]);
    setPositions([]);
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    });
  }

  async function fetchPools() {
    try {
      const res = await fetch(`${API_BASE}/pools`, {
        cache: 'no-store'
      });
      const data = await res.json();
      console.log('🔍 Fetched pools data:', data.pools);
      if (data.pools && data.pools.length > 0) {
        console.log('🔍 First pool reserves:', {
          reserveAHuman: data.pools[0].reserveAHuman,
          reserveBHuman: data.pools[0].reserveBHuman
        });
      }
      setPools(data.pools || []);
    } catch (error) {
      console.error("Failed to fetch pools:", error);
    }
  }

  async function fetchPositions() {
    if (!wallet) return;
    try {
      const res = await fetch(`${API_BASE}/liquidity/positions/${wallet.address}`);
      const data = await res.json();
      setPositions(data.positions || []);
    } catch (error) {
      console.error("Failed to fetch positions:", error);
    }
  }

  async function getSwapQuote() {
    if (!selectedPoolForSwap || !swapTokenIn || !swapAmount || !wallet) return;

    try {
      const pool = pools.find((p) => p.poolAddress === selectedPoolForSwap);
      if (!pool) return;

      // Determine tokenOut (the opposite token in the pool)
      const tokenOut = pool.tokenA === swapTokenIn ? pool.tokenB : pool.tokenA;

      const res = await fetch(`${API_BASE}/swap/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenIn: swapTokenIn,
          tokenOut: tokenOut,
          amountIn: swapAmount,
        }),
      });
      const data = await res.json();
      // API returns { success: true, quote: {...} }
      if (data.success && data.quote) {
        setSwapQuote(data.quote);
      } else {
        setSwapQuote(null);
      }
    } catch (error) {
      console.error("Failed to get swap quote:", error);
      setSwapQuote(null);
    }
  }

  useEffect(() => {
    if (swapAmount && selectedPoolForSwap && swapTokenIn) {
      const timer = setTimeout(() => getSwapQuote(), 500);
      return () => clearTimeout(timer);
    } else {
      setSwapQuote(null);
    }
  }, [swapAmount, selectedPoolForSwap, swapTokenIn]);

  async function executeSwap() {
    if (!wallet || !selectedPoolForSwap || !swapTokenIn || !swapAmount) return;

    setSwapping(true);
    try {
      const pool = pools.find((p) => p.poolAddress === selectedPoolForSwap);
      if (!pool) {
        throw new Error("Pool not found");
      }

      // Determine tokenOut (the opposite token in the pool)
      const tokenOut = pool.tokenA === swapTokenIn ? pool.tokenB : pool.tokenA;

      const res = await fetch(`${API_BASE}/swap/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: wallet.address,
          userSeed: wallet.seed,
          tokenIn: swapTokenIn,
          tokenOut: tokenOut,
          amountIn: swapAmount,
        }),
      });
      const data = await res.json();

      if (data.success && data.result) {
        // Get token symbols for better display
        const tokenInSymbol = pool.tokenA === swapTokenIn ? pool.symbolA : pool.symbolB;
        const tokenOutSymbol = pool.tokenA === swapTokenIn ? pool.symbolB : pool.symbolA;

        // Build explorer link - use block hash if available, otherwise fallback to address
        const explorerUrl = data.result.blockHash
          ? `https://explorer.test.keeta.com/block/${data.result.blockHash}`
          : `https://explorer.test.keeta.com/address/${wallet.address}`;

        toast({
          title: "Swap Successful!",
          description: (
            <div className="space-y-1">
              <div>Swapped {swapAmount} {tokenInSymbol}</div>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 underline text-sm flex items-center gap-1"
              >
                View on Keeta Explorer
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          ),
        });
        setSwapAmount("");
        setSwapQuote(null);
        // Refresh wallet balances
        const walletRes = await fetch(`${API_BASE}/wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "import", seed: wallet.seed }),
        });
        const walletData = await walletRes.json();
        if (walletData.success) {
          const updatedWallet = {
            address: walletData.address,
            seed: wallet.seed,
            tokens: walletData.tokens || [],
          };
          setWallet(updatedWallet);
          localStorage.setItem("keetaWallet", JSON.stringify(updatedWallet));
        }
      } else {
        throw new Error(data.error || "Swap failed");
      }
    } catch (error: any) {
      toast({
        title: "Swap Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSwapping(false);
    }
  }

  async function createPool() {
    if (!wallet || !newPoolTokenA || !newPoolTokenB || !liqAmountA || !liqAmountB) return;

    if (newPoolTokenA === newPoolTokenB) {
      toast({
        title: "Invalid Pool",
        description: "Cannot create pool with same token",
        variant: "destructive",
      });
      return;
    }

    setCreatingPool(true);
    try {
      // Step 1: Create the pool
      const createRes = await fetch(`${API_BASE}/pools/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenA: newPoolTokenA,
          tokenB: newPoolTokenB,
          userSeed: wallet.seed,
        }),
      });
      const createData = await createRes.json();

      if (!createData.success) {
        throw new Error(createData.error || "Failed to create pool");
      }

      // Step 2: Add initial liquidity to the new pool
      const liqRes = await fetch(`${API_BASE}/liquidity/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userSeed: wallet.seed,
          tokenA: newPoolTokenA,
          tokenB: newPoolTokenB,
          amountADesired: liqAmountA,
          amountBDesired: liqAmountB,
        }),
      });
      const liqData = await liqRes.json();

      if (liqData.success) {
        toast({
          title: "Pool Created & Liquidity Added!",
          description: `Successfully created ${createData.pool.symbolA}/${createData.pool.symbolB} pool and added initial liquidity`,
        });
        // Refresh data
        await fetchPools();
        await fetchPositions();
        // Reset form
        setCreateMode(false);
        setNewPoolTokenA("");
        setNewPoolTokenB("");
        setLiqAmountA("");
        setLiqAmountB("");
      } else {
        // Pool was created but liquidity add failed
        toast({
          title: "Pool Created, Liquidity Failed",
          description: `Pool created successfully but failed to add liquidity: ${liqData.error}`,
          variant: "destructive",
        });
        await fetchPools();
      }
    } catch (error: any) {
      toast({
        title: "Operation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreatingPool(false);
    }
  }

  async function addLiquidity() {
    if (!wallet || !selectedPoolForLiq || !liqAmountA || !liqAmountB) return;

    setAddingLiq(true);
    try {
      const pool = pools.find((p) => p.poolAddress === selectedPoolForLiq);
      if (!pool) return;

      const res = await fetch(`${API_BASE}/liquidity/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userSeed: wallet.seed,
          tokenA: pool.tokenA,
          tokenB: pool.tokenB,
          amountADesired: liqAmountA,
          amountBDesired: liqAmountB,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: "Liquidity Added!",
          description: `Added ${data.amountA} ${pool.symbolA} and ${data.amountB} ${pool.symbolB}`,
        });
        setLiqAmountA("");
        setLiqAmountB("");
        fetchPositions();
      } else {
        throw new Error(data.error || "Failed to add liquidity");
      }
    } catch (error: any) {
      toast({
        title: "Add Liquidity Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingLiq(false);
    }
  }

  async function removeLiquidity(position: KeetaPosition) {
    if (!wallet) return;

    setRemovingLiq(true);
    try {
      // Calculate liquidity amount to remove based on percentage
      const liquidityAmount = (BigInt(position.liquidity) * BigInt(removeLiqPercent) / 100n).toString();

      const res = await fetch(`${API_BASE}/liquidity/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userSeed: wallet.seed,
          tokenA: position.tokenA,
          tokenB: position.tokenB,
          liquidity: liquidityAmount,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: "Liquidity Removed!",
          description: `Removed ${removeLiqPercent}% of your liquidity`,
        });
        fetchPositions();
      } else {
        throw new Error(data.error || "Failed to remove liquidity");
      }
    } catch (error: any) {
      toast({
        title: "Remove Liquidity Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRemovingLiq(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  }

  if (!wallet) {
    return (
      <>
        <div className="container py-10">
          <div className="mx-auto max-w-2xl">
            <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <img
                    src="https://cdn.builder.io/api/v1/image/assets%2Fd70091a6f5494e0195b033a72f7e79ae%2Fee3a0a5652aa480f9aa42277503e94b2?format=webp&width=64"
                    alt="Silverback logo"
                    className="h-8 w-8 rounded-md object-contain"
                  />
                  <CardTitle>Silverback DEX</CardTitle>
                </div>
                <CardDescription>
                  Connect your Keeta wallet to start trading on the Keeta Network
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
              <div className="rounded-xl border border-border/40 bg-secondary/40 p-6 backdrop-blur">
                <h3 className="text-sm font-semibold mb-4">Generate New Wallet</h3>
                <Button
                  onClick={generateWallet}
                  disabled={loading}
                  className="w-full bg-brand hover:bg-brand/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wallet className="mr-2 h-4 w-4" />
                      Generate Wallet
                    </>
                  )}
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground">or</div>

              <div className="rounded-xl border border-border/40 bg-secondary/40 p-6 backdrop-blur">
                <h3 className="text-sm font-semibold mb-4">Import Existing Wallet</h3>
                <div className="space-y-4">
                  <Input
                    placeholder="Enter your 64-character hex seed"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={importWallet}
                    disabled={loading || !seedInput}
                    variant="outline"
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      "Import Wallet"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Seed Backup Modal - also needed when no wallet exists */}
      <Dialog open={!!newSeedBackup} onOpenChange={(open) => {
        console.log('🟠 Dialog onOpenChange called (no wallet), open:', open);
        if (!open) setNewSeedBackup(null);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              <DialogTitle className="text-xl">Save Your Seed Phrase</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              This is your wallet's recovery phrase. You will need it to restore access to your wallet.
              <span className="block mt-2 text-destructive font-semibold">
                ⚠️ There is NO backup. If you lose this, you lose access to your funds forever!
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Seed Display */}
            <div className="rounded-lg border-2 border-yellow-500/50 bg-yellow-500/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                  Your Seed Phrase:
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(newSeedBackup || "");
                    setCopiedSeed(true);
                    setTimeout(() => setCopiedSeed(false), 2000);
                  }}
                  className="h-8 gap-2"
                >
                  {copiedSeed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <code className="block break-all text-xs font-mono bg-black/20 p-3 rounded">
                {newSeedBackup}
              </code>
            </div>

            {/* Warning Checklist */}
            <div className="space-y-3 rounded-lg border border-border/40 bg-secondary/40 p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-sky-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-semibold">Important Security Guidelines:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Write it down on paper and store it safely</li>
                    <li>Never share your seed phrase with anyone</li>
                    <li>Do not store it in email, screenshots, or cloud storage</li>
                    <li>Anyone with this seed phrase can access your funds</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-3 rounded-lg border-2 border-destructive/50 bg-destructive/10 p-4">
              <Checkbox
                id="seed-confirm"
                checked={seedBackupConfirmed}
                onCheckedChange={(checked) => setSeedBackupConfirmed(checked as boolean)}
                className="mt-1"
              />
              <label
                htmlFor="seed-confirm"
                className="text-sm font-medium leading-tight cursor-pointer select-none"
              >
                I have written down my seed phrase and understand that I will lose access to my
                wallet if I lose it. There is no way to recover it.
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewSeedBackup(null);
                setSeedBackupConfirmed(false);
                setCopiedSeed(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSeedBackup}
              disabled={!seedBackupConfirmed}
              className="bg-brand hover:bg-brand/90"
            >
              I've Saved My Seed - Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
    );
  }

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Wallet */}
          <div className="lg:col-span-5">
            <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur sticky top-24 h-fit">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-brand/20 p-2">
                      <Wallet className="h-5 w-5 text-sky-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Keeta Wallet</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs font-mono text-muted-foreground">
                          {wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(wallet.address)}
                        >
                          {copiedAddress ? (
                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={disconnectWallet}>
                    Disconnect
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {displayedTokens.map((token) => (
                    <div
                      key={token.address}
                      className="group relative rounded-xl border border-border/40 bg-gradient-to-br from-secondary/40 to-secondary/20 p-4 transition-all hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Token Icon */}
                          {token.symbol === "KTA" ? (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-brand/20 to-brand/10">
                              <img
                                src="https://assets.kraken.com/marketing/web/icons-uni-webp/s_kta.webp?i=kds"
                                alt="KTA"
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand/20 to-brand/10 text-sm font-bold text-brand">
                              {token.symbol.slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div className="text-base font-semibold">{token.symbol}</div>
                            <code
                              className="text-xs text-muted-foreground cursor-pointer hover:text-sky-400 transition-colors"
                              onClick={() => copyToClipboard(token.address)}
                              title="Click to copy address"
                            >
                              {token.address.slice(0, 6)}...{token.address.slice(-4)}
                            </code>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{token.balanceFormatted}</div>
                          <div className="text-xs text-muted-foreground">{token.symbol}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {sortedTokens.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllTokens(!showAllTokens)}
                      className="w-full text-sm hover:bg-brand/10"
                    >
                      {showAllTokens ? (
                        <>
                          <span>Show Less</span>
                        </>
                      ) : (
                        <>
                          <span>Show {sortedTokens.length - 5} More Token{sortedTokens.length - 5 > 1 ? 's' : ''}</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Tabs */}
          <div className="lg:col-span-7">
            <Tabs defaultValue="swap" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6 bg-card/60 border border-border/40">
                <TabsTrigger value="swap">
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Swap
                </TabsTrigger>
                <TabsTrigger value="pools">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Active Pools
                </TabsTrigger>
                <TabsTrigger value="liquidity">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Liquidity
                </TabsTrigger>
                <TabsTrigger value="positions">
                  <Droplets className="mr-2 h-4 w-4" />
                  My Positions
                </TabsTrigger>
              </TabsList>

              {/* Active Pools Tab */}
              <TabsContent value="pools">
                <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
                  <CardHeader>
                    <CardTitle>Active Pools</CardTitle>
                    <CardDescription>Explore liquidity pools and start earning</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pools.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No active pools yet. Be the first to create one!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pools.map((pool) => {
                          // Find user's position in this pool
                          const userPosition = positions.find(
                            (p) => p.poolAddress === pool.poolAddress
                          );

                          // Convert to KeetaPoolCardData format
                          const poolCardData: KeetaPoolCardData = {
                            poolAddress: pool.poolAddress,
                            tokenA: pool.tokenA,
                            tokenB: pool.tokenB,
                            symbolA: pool.symbolA,
                            symbolB: pool.symbolB,
                            reserveA: pool.reserveA,
                            reserveB: pool.reserveB,
                            reserveAHuman: pool.reserveAHuman,
                            reserveBHuman: pool.reserveBHuman,
                            decimalsA: 9, // Keeta default
                            decimalsB: 9,
                            totalShares: pool.totalShares,
                            userPosition: userPosition
                              ? {
                                  shares: userPosition.liquidity,
                                  sharePercent: userPosition.sharePercent,
                                  amountA: userPosition.amountA,
                                  amountB: userPosition.amountB,
                                }
                              : undefined,
                          };

                          return (
                            <KeetaPoolCard
                              key={pool.poolAddress}
                              pool={poolCardData}
                              onManage={(selectedPool) => {
                                // Switch to liquidity tab and pre-select this pool
                                setSelectedPoolForLiq(selectedPool.poolAddress);
                                // Trigger tab change would need ref or state management
                                // For now, user clicks the "Manage" button and we select the pool
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Swap Tab */}
              <TabsContent value="swap">
                <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
              <CardHeader>
                <CardTitle>Swap</CardTitle>
                <CardDescription>Trade tokens on Keeta Network</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* From Token Input */}
                <div className="rounded-xl border border-border/60 bg-secondary/60 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>You pay</span>
                    {swapTokenIn && wallet && (
                      <span>
                        Bal: {wallet.tokens.find(t => t.address === swapTokenIn)?.balanceFormatted || "0"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={swapTokenIn}
                      onChange={(e) => setSwapTokenIn(e.target.value)}
                      className="min-w-24 sm:min-w-28 shrink-0 rounded-lg bg-card hover:bg-card/80 px-3 py-2 text-sm font-semibold border-none outline-none cursor-pointer"
                    >
                      <option value="">Select</option>
                      {wallet?.tokens.map((token) => (
                        <option key={token.address} value={token.address}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                    <input
                      inputMode="decimal"
                      pattern="^[0-9]*[.,]?[0-9]*$"
                      placeholder="0.00"
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(e.target.value.replace(",", "."))}
                      className="ml-auto flex-1 min-w-0 bg-transparent text-right text-2xl sm:text-3xl font-semibold outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>

                {/* Swap Arrow - Vertical with toggle */}
                <div className="relative flex justify-center -my-2">
                  <button
                    type="button"
                    onClick={toggleSwapTokens}
                    className="rounded-xl border border-border/60 bg-card p-2 shadow-md hover:bg-card/80 transition-colors cursor-pointer z-10"
                  >
                    <ArrowDownUp className="h-4 w-4" />
                  </button>
                </div>

                {/* To Token Input */}
                <div className="rounded-xl border border-border/60 bg-secondary/60 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>You receive</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedPoolForSwap}
                      onChange={(e) => setSelectedPoolForSwap(e.target.value)}
                      disabled={!swapTokenIn}
                      className="min-w-24 sm:min-w-28 shrink-0 rounded-lg bg-card hover:bg-card/80 px-3 py-2 text-sm font-semibold border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select</option>
                      {pools
                        .filter(pool =>
                          swapTokenIn && (pool.tokenA === swapTokenIn || pool.tokenB === swapTokenIn)
                        )
                        .map((pool) => {
                          const oppositeSymbol = pool.tokenA === swapTokenIn ? pool.symbolB : pool.symbolA;
                          return (
                            <option key={pool.poolAddress} value={pool.poolAddress}>
                              {oppositeSymbol}
                            </option>
                          );
                        })}
                    </select>
                    <input
                      readOnly
                      value={swapQuote ? swapQuote.amountOutHuman : "0.00"}
                      className="ml-auto flex-1 min-w-0 bg-transparent text-right text-2xl sm:text-3xl font-semibold outline-none text-muted-foreground/80"
                    />
                  </div>
                </div>

                {/* Quote Details */}
                {swapQuote && (
                  <div className="rounded-lg bg-secondary/40 p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Output</span>
                      <span className="font-medium">{swapQuote.amountOutHuman}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fee</span>
                      <span className="font-medium">{swapQuote.feeAmountHuman}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price Impact</span>
                      <span className={Number(swapQuote.priceImpact) > 5 ? "text-red-400 font-medium" : "font-medium"}>
                        {swapQuote.priceImpact}%
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={executeSwap}
                  disabled={swapping || !swapAmount || !swapTokenIn || !selectedPoolForSwap}
                  className="w-full h-12 text-base font-semibold"
                >
                  {swapping ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Swapping...
                    </>
                  ) : (
                    "Swap"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add Liquidity Tab */}
          <TabsContent value="liquidity">
            <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
              <CardHeader>
                <CardTitle>Add Liquidity</CardTitle>
                <CardDescription>Provide liquidity to Keeta pools and earn trading fees</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <Button
                    variant={!createMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCreateMode(false)}
                    className="flex-1"
                  >
                    Select Pool
                  </Button>
                  <Button
                    variant={createMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCreateMode(true)}
                    className="flex-1"
                  >
                    Create Pool
                  </Button>
                </div>

                {!createMode ? (
                  // Select Existing Pool Mode
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <label className="text-xs text-muted-foreground mb-2 block">Select Pool</label>
                    <select
                      value={selectedPoolForLiq}
                      onChange={(e) => setSelectedPoolForLiq(e.target.value)}
                      className="w-full rounded-lg bg-card hover:bg-card/80 px-3 py-2 text-sm font-semibold border-none outline-none cursor-pointer"
                    >
                      <option value="">Choose a pool...</option>
                      {pools.map((pool) => (
                        <option key={pool.poolAddress} value={pool.poolAddress}>
                          {pool.symbolA} / {pool.symbolB}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  // Create New Pool Mode
                  <div className="space-y-3">
                    {/* Token A Input - Matching swap design */}
                    <div className="rounded-xl border border-border/60 bg-secondary/60 p-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Token A</span>
                        {newPoolTokenA && wallet && (
                          <span>
                            Bal: {wallet.tokens.find(t => t.address === newPoolTokenA)?.balanceFormatted || "0"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={newPoolTokenA}
                          onChange={(e) => {
                            const tokenA = e.target.value;
                            setNewPoolTokenA(tokenA);

                            // Check if pool already exists with current Token B selection
                            if (tokenA && newPoolTokenB) {
                              const existingPool = pools.find(p =>
                                (p.tokenA === tokenA && p.tokenB === newPoolTokenB) ||
                                (p.tokenA === newPoolTokenB && p.tokenB === tokenA)
                              );

                              if (existingPool) {
                                // Pool exists, switch to Select Pool mode
                                setCreateMode(false);
                                setSelectedPoolForLiq(existingPool.poolAddress);
                                toast({
                                  title: "Pool Already Exists",
                                  description: "Switched to existing pool. Add liquidity to it instead.",
                                });
                              }
                            }
                          }}
                          className="min-w-24 sm:min-w-28 shrink-0 rounded-lg bg-card hover:bg-card/80 px-3 py-2 text-sm font-semibold border-none outline-none cursor-pointer"
                        >
                          <option value="">Select</option>
                          {wallet?.tokens.map((token) => (
                            <option key={token.address} value={token.address}>
                              {token.symbol}
                            </option>
                          ))}
                        </select>
                        <input
                          inputMode="decimal"
                          pattern="^[0-9]*[.,]?[0-9]*$"
                          placeholder="0.00"
                          value={liqAmountA}
                          onChange={(e) => setLiqAmountA(e.target.value.replace(",", "."))}
                          disabled={!newPoolTokenA}
                          className="ml-auto flex-1 min-w-0 bg-transparent text-right text-2xl sm:text-3xl font-semibold outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Plus Icon - Vertical with toggle */}
                    <div className="relative flex justify-center -my-2">
                      <button
                        type="button"
                        onClick={toggleLiquidityTokens}
                        className="rounded-xl border border-border/60 bg-card p-2 shadow-md hover:bg-card/80 transition-colors cursor-pointer z-10"
                      >
                        <ArrowDownUp className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Token B Input - Matching swap design */}
                    <div className="rounded-xl border border-border/60 bg-secondary/60 p-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Token B</span>
                        {newPoolTokenB && wallet && (
                          <span>
                            Bal: {wallet.tokens.find(t => t.address === newPoolTokenB)?.balanceFormatted || "0"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={newPoolTokenB}
                          onChange={(e) => {
                            const tokenB = e.target.value;
                            setNewPoolTokenB(tokenB);

                            // Check if pool already exists with current Token A selection
                            if (newPoolTokenA && tokenB) {
                              const existingPool = pools.find(p =>
                                (p.tokenA === newPoolTokenA && p.tokenB === tokenB) ||
                                (p.tokenA === tokenB && p.tokenB === newPoolTokenA)
                              );

                              if (existingPool) {
                                // Pool exists, switch to Select Pool mode
                                setCreateMode(false);
                                setSelectedPoolForLiq(existingPool.poolAddress);
                                toast({
                                  title: "Pool Already Exists",
                                  description: "Switched to existing pool. Add liquidity to it instead.",
                                });
                              }
                            }
                          }}
                          disabled={!newPoolTokenA}
                          className="min-w-24 sm:min-w-28 shrink-0 rounded-lg bg-card hover:bg-card/80 px-3 py-2 text-sm font-semibold border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select</option>
                          {wallet?.tokens
                            .filter((token) => token.address !== newPoolTokenA)
                            .map((token) => (
                              <option key={token.address} value={token.address}>
                                {token.symbol}
                              </option>
                            ))}
                        </select>
                        <input
                          inputMode="decimal"
                          pattern="^[0-9]*[.,]?[0-9]*$"
                          placeholder="0.00"
                          value={liqAmountB}
                          onChange={(e) => setLiqAmountB(e.target.value.replace(",", "."))}
                          disabled={!newPoolTokenB}
                          className="ml-auto flex-1 min-w-0 bg-transparent text-right text-2xl sm:text-3xl font-semibold outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={createPool}
                      disabled={creatingPool || !newPoolTokenA || !newPoolTokenB || !liqAmountA || !liqAmountB}
                      className="w-full h-12 text-base font-semibold"
                    >
                      {creatingPool ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Pool...
                        </>
                      ) : (
                        "Create Pool & Add Liquidity"
                      )}
                    </Button>
                  </div>
                )}

                {!createMode && selectedPoolForLiq && (() => {
                  const pool = pools.find((p) => p.poolAddress === selectedPoolForLiq);
                  if (!pool) return null;

                  return (
                    <>
                      {/* Token A Input */}
                      <div className="rounded-xl border border-border/60 bg-secondary/60 p-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{pool.symbolA || ''}</span>
                          {wallet && (
                            <span>
                              Bal: {wallet.tokens.find(t => t.address === pool.tokenA)?.balanceFormatted || "0"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="min-w-24 sm:min-w-28 shrink-0 rounded-lg bg-card px-3 py-2 text-sm font-semibold">
                            {pool.symbolA || ''}
                          </div>
                          <input
                            inputMode="decimal"
                            pattern="^[0-9]*[.,]?[0-9]*$"
                            placeholder="0.00"
                            value={liqAmountA}
                            onChange={(e) => {
                              const value = e.target.value.replace(",", ".");
                              setLiqAmountA(value);
                              // Auto-calculate Token B amount based on pool ratio
                              if (value && pool && pool.reserveAHuman && pool.reserveBHuman) {
                                const amountA = parseFloat(value);
                                if (!isNaN(amountA) && amountA > 0) {
                                  const ratio = pool.reserveBHuman / pool.reserveAHuman;
                                  const amountB = (amountA * ratio).toFixed(6);
                                  setLiqAmountB(amountB);
                                }
                              } else if (!value) {
                                setLiqAmountB("");
                              }
                            }}
                            className="ml-auto flex-1 min-w-0 bg-transparent text-right text-2xl sm:text-3xl font-semibold outline-none placeholder:text-muted-foreground/60"
                          />
                        </div>
                      </div>

                      {/* Plus Icon - Vertical */}
                      <div className="relative flex justify-center -my-2">
                        <div className="rounded-xl border border-border/60 bg-card p-2 shadow-md">
                          <ArrowDownUp className="h-4 w-4" />
                        </div>
                      </div>

                      {/* Token B Input */}
                      <div className="rounded-xl border border-border/60 bg-secondary/60 p-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{pool.symbolB || ''}</span>
                          {wallet && (
                            <span>
                              Bal: {wallet.tokens.find(t => t.address === pool.tokenB)?.balanceFormatted || "0"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="min-w-24 sm:min-w-28 shrink-0 rounded-lg bg-card px-3 py-2 text-sm font-semibold">
                            {pool.symbolB || ''}
                          </div>
                          <input
                            inputMode="decimal"
                            pattern="^[0-9]*[.,]?[0-9]*$"
                            placeholder="0.00"
                            value={liqAmountB}
                            onChange={(e) => setLiqAmountB(e.target.value.replace(",", "."))}
                            className="ml-auto flex-1 min-w-0 bg-transparent text-right text-2xl sm:text-3xl font-semibold outline-none placeholder:text-muted-foreground/60"
                          />
                        </div>
                      </div>

                      {/* Pool Info */}
                      {liqAmountA && liqAmountB && (
                        <div className="rounded-lg bg-secondary/40 p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pool Ratio</span>
                            <span className="font-medium">
                              1 {pool.symbolA} = {(Number(pool.reserveBHuman) / Number(pool.reserveAHuman)).toFixed(6)} {pool.symbolB}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Share of Pool</span>
                            <span className="font-medium">~0.00%</span>
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={addLiquidity}
                        disabled={addingLiq || !liqAmountA || !liqAmountB}
                        className="w-full h-12 text-base font-semibold"
                      >
                        {addingLiq ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding Liquidity...
                          </>
                        ) : (
                          "Add Liquidity"
                        )}
                      </Button>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions">
            <div className="space-y-4">
              {positions.length === 0 ? (
                <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
                  <CardContent className="pt-6 text-center py-12">
                    <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-semibold mb-2">No Liquidity Positions</p>
                    <p className="text-sm text-muted-foreground">
                      Add liquidity to a pool to start earning fees
                    </p>
                  </CardContent>
                </Card>
              ) : (
                positions.map((position, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-brand/30 bg-card/40 backdrop-blur p-4 transition-all hover:border-brand/50 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-1">
                        <div className="font-semibold text-sm">
                          {position.symbolA}/{position.symbolB}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Silverback Pool
                        </div>
                        {position.lpStorageAddress && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-emerald-400 font-medium">Your LP Account:</span>
                            <code className="text-xs text-sky-400">
                              {position.lpStorageAddress.slice(0, 8)}...{position.lpStorageAddress.slice(-6)}
                            </code>
                            <a
                              href={`https://explorer.test.keeta.com/address/${position.lpStorageAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-400 hover:text-sky-300 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        You Own This
                      </div>
                    </div>

                    {/* Position Details */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="rounded-lg border border-border/40 bg-secondary/40 p-2">
                        <div className="text-xs text-muted-foreground mb-1">Your Position</div>
                        <div className="text-xs font-semibold leading-tight">
                          {position.amountA} {position.symbolA || ''}
                        </div>
                        <div className="text-xs font-semibold leading-tight">
                          {position.amountB} {position.symbolB || ''}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/40 bg-secondary/40 p-2">
                        <div className="text-xs text-muted-foreground mb-1">Pool Share</div>
                        <div className="text-xs font-semibold text-sky-400">
                          {Number(position.sharePercent).toFixed(4)}%
                        </div>
                      </div>
                    </div>

                    {/* Remove Liquidity Controls */}
                    <div className="rounded-lg border border-brand/40 bg-brand/10 p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Remove Liquidity</span>
                        <span className="text-sm font-semibold text-sky-400">{removeLiqPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={removeLiqPercent}
                        onChange={(e) => setRemoveLiqPercent(Number(e.target.value))}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-sky-400"
                      />
                      <div className="flex gap-1 mt-2">
                        {[25, 50, 75, 100].map((percent) => (
                          <Button
                            key={percent}
                            variant="outline"
                            size="sm"
                            onClick={() => setRemoveLiqPercent(percent)}
                            className="flex-1 text-xs h-7"
                          >
                            {percent}%
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button
                      onClick={() => removeLiquidity(position)}
                      disabled={removingLiq}
                      variant="destructive"
                      size="sm"
                      className="w-full text-xs h-8"
                    >
                      {removingLiq ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        `Remove ${removeLiqPercent}% Liquidity`
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Seed Backup Modal */}
      <Dialog open={!!newSeedBackup} onOpenChange={(open) => {
        console.log('🟠 Dialog onOpenChange called, open:', open);
        if (!open) setNewSeedBackup(null);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              <DialogTitle className="text-xl">Save Your Seed Phrase</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              This is your wallet's recovery phrase. You will need it to restore access to your wallet.
              <span className="block mt-2 text-destructive font-semibold">
                ⚠️ There is NO backup. If you lose this, you lose access to your funds forever!
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Seed Display */}
            <div className="rounded-lg border-2 border-yellow-500/50 bg-yellow-500/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                  Your Seed Phrase:
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(newSeedBackup || "");
                    setCopiedSeed(true);
                    setTimeout(() => setCopiedSeed(false), 2000);
                  }}
                  className="h-8 gap-2"
                >
                  {copiedSeed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <code className="block break-all text-xs font-mono bg-black/20 p-3 rounded">
                {newSeedBackup}
              </code>
            </div>

            {/* Warning Checklist */}
            <div className="space-y-3 rounded-lg border border-border/40 bg-secondary/40 p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-sky-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-semibold">Important Security Guidelines:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Write it down on paper and store it safely</li>
                    <li>Never share your seed phrase with anyone</li>
                    <li>Do not store it in email, screenshots, or cloud storage</li>
                    <li>Anyone with this seed phrase can access your funds</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-3 rounded-lg border-2 border-destructive/50 bg-destructive/10 p-4">
              <Checkbox
                id="seed-confirm"
                checked={seedBackupConfirmed}
                onCheckedChange={(checked) => setSeedBackupConfirmed(checked as boolean)}
                className="mt-1"
              />
              <label
                htmlFor="seed-confirm"
                className="text-sm font-medium leading-tight cursor-pointer select-none"
              >
                I have written down my seed phrase and understand that I will lose access to my
                wallet if I lose it. There is no way to recover it.
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewSeedBackup(null);
                setSeedBackupConfirmed(false);
                setCopiedSeed(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSeedBackup}
              disabled={!seedBackupConfirmed}
              className="bg-brand hover:bg-brand/90"
            >
              I've Saved My Seed - Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
