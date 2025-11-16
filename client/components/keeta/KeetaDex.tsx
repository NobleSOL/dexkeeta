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
  Send,
} from "lucide-react";
import { KeetaPoolCard, KeetaPoolCardData } from "@/components/keeta/KeetaPoolCard";
import QuickFill from "@/components/shared/QuickFill";
import { useKeetaTokenPrices } from "@/components/keeta/useKeetaPricing";
import {
  generateWallet as generateWalletClient,
  getAddressFromSeed,
  fetchBalances,
  fetchLiquidityPositions,
  fetchPools,
  getSwapQuote as getSwapQuoteClient,
  executeSwap as executeSwapClient,
  addLiquidity as addLiquidityClient,
  removeLiquidity as removeLiquidityClient,
  createPool as createPoolClient,
} from "@/lib/keeta-client";
import {
  isKeythingsInstalled,
  connectKeythings,
  getSelectedAddress,
  isConnected,
  onAccountsChanged,
  onDisconnect,
} from "@/lib/keythings-provider";

// API base URL - uses environment variable if set, otherwise falls back to same origin
// For production: set VITE_KEETA_API_BASE to your Railway backend URL (e.g., https://dexkeeta-production.up.railway.app/api)
// For development: uses Vite dev server on same origin (localhost:8080/api)
const API_BASE = import.meta.env.VITE_KEETA_API_BASE || `${window.location.origin}/api`;

type KeetaWallet = {
  address: string;
  seed: string;
  accountIndex?: number; // Account derivation index (default 0)
  isKeythings?: boolean; // True if connected via Keythings wallet
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
  decimalsA?: number;
  decimalsB?: number;
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

  // Keythings wallet state
  const [keythingsConnected, setKeythingsConnected] = useState(false);
  const [keythingsAddress, setKeythingsAddress] = useState<string | null>(null);

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

  // Tab state for controlled navigation
  const [activeTab, setActiveTab] = useState("swap");

  // Send tokens state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendToken, setSendToken] = useState<{ address: string; symbol: string; balanceFormatted: string } | null>(null);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

  // Fetch token prices
  const tokenAddresses = wallet?.tokens.map(t => t.address) || [];
  const { data: tokenPrices } = useKeetaTokenPrices(tokenAddresses);

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
        const walletData = JSON.parse(savedWallet);
        setWallet(walletData);

        // If it was a Keythings wallet, update the state
        if (walletData.isKeythings) {
          setKeythingsConnected(true);
          setKeythingsAddress(walletData.address);

          // Set up event listeners for Keythings
          onAccountsChanged((accounts) => {
            console.log('👤 Keythings account changed:', accounts);
            if (accounts.length === 0) {
              disconnectWallet();
            } else {
              connectKeythingsWallet();
            }
          });

          onDisconnect(() => {
            console.log('🔌 Keythings disconnected');
            disconnectWallet();
          });
        }
      } catch (e) {
        console.error("Failed to load wallet:", e);
      }
    }
  }, []);

  // Watch for Keythings connection from header
  useEffect(() => {
    // Check if Keythings was connected from the header
    const keythingsConnectedFromHeader = localStorage.getItem('keythingsConnected') === 'true';
    const keythingsAddressFromHeader = localStorage.getItem('keythingsAddress');

    if (keythingsConnectedFromHeader && keythingsAddressFromHeader && !wallet) {
      // Keythings was connected from header but KeetaDex wallet state is not set up
      console.log('🔍 Detected Keythings connection from header, setting up KeetaDex wallet...');
      connectKeythingsWallet();
    }
  }, [wallet]);

  // Fetch pools and positions when wallet is loaded
  useEffect(() => {
    if (wallet?.address) {
      loadPools().catch(err => console.error('Error fetching pools:', err));
      fetchPositions().catch(err => console.error('Error fetching positions:', err));
    }
  }, [wallet?.address]);

  // Merge backend pools with pools discovered from user's LP tokens
  const allPools = React.useMemo(() => {
    const poolMap = new Map<string, KeetaPool>();

    // Blacklist legacy/test pools that should not be displayed
    const BLACKLISTED_POOLS = new Set([
      'keeta_aqkycfpx2rafbdie3kreukjl7cg274kjdo6f6ajk42dp6tpw2z3nug2yd2buk', // Legacy KTA/TEST pool
      'keeta_aty6ahjppurrlzmcxk45kthor7ojea77aeyg6ext5gdvwxh34uue57mtct26a',  // Legacy pool
    ]);

    // Add all backend pools (except blacklisted ones and empty pools)
    pools.forEach(pool => {
      if (BLACKLISTED_POOLS.has(pool.poolAddress)) {
        console.log(`⏭️ Skipping blacklisted pool: ${pool.poolAddress.slice(-8)}`);
        return;
      }

      // Skip pools with no liquidity (0 reserves)
      const reserveAHuman = pool.reserveAHuman ?? 0;
      const reserveBHuman = pool.reserveBHuman ?? 0;

      if (reserveAHuman === 0 && reserveBHuman === 0) {
        console.log(`⏭️ Skipping empty backend pool: ${pool.symbolA}/${pool.symbolB} (${pool.poolAddress.slice(-8)})`);
        return;
      }

      poolMap.set(pool.poolAddress, pool);
    });

    // Add pools discovered from LP tokens (for newly created pools not yet in backend)
    // But skip pools with zero liquidity (burned LP tokens)
    positions.forEach(position => {
      // Skip blacklisted pools even if discovered from LP tokens
      if (BLACKLISTED_POOLS.has(position.poolAddress)) {
        console.log(`⏭️ Skipping blacklisted pool from LP token: ${position.poolAddress.slice(-8)}`);
        return;
      }

      if (!poolMap.has(position.poolAddress)) {
        // Parse amounts to check if position is meaningful
        const userAmountA = parseFloat(position.amountA || '0');
        const userAmountB = parseFloat(position.amountB || '0');
        const sharePercent = position.sharePercent || 0;

        // Skip if:
        // 1. No LP tokens (liquidity = 0)
        // 2. Dust amounts (both amounts < 0.000001)
        // 3. Share percent is effectively zero (< 0.0001%)
        const hasMeaningfulLiquidity =
          BigInt(position.liquidity || 0) > 0n &&
          (userAmountA >= 0.000001 || userAmountB >= 0.000001) &&
          sharePercent >= 0.0001;

        if (hasMeaningfulLiquidity) {
          console.log(`🔍 Discovered pool from LP token: ${position.symbolA}/${position.symbolB}`, {
            amountA: position.amountA,
            amountB: position.amountB,
            sharePercent: position.sharePercent,
          });

          // Calculate total pool reserves from user's position
          // User has sharePercent% of the pool, so total = userAmount / (sharePercent / 100)
          const totalReserveAHuman = sharePercent > 0 ? (userAmountA / sharePercent) * 100 : 0;
          const totalReserveBHuman = sharePercent > 0 ? (userAmountB / sharePercent) * 100 : 0;

          console.log(`📊 Calculated reserves:`, {
            userAmountA,
            userAmountB,
            sharePercent,
            totalReserveAHuman,
            totalReserveBHuman,
          });

          // Convert to atomic units (assuming 9 decimals)
          const reserveA = (totalReserveAHuman * 1e9).toString();
          const reserveB = (totalReserveBHuman * 1e9).toString();

          poolMap.set(position.poolAddress, {
            poolAddress: position.poolAddress,
            tokenA: position.tokenA,
            tokenB: position.tokenB,
            symbolA: position.symbolA,
            symbolB: position.symbolB,
            reserveA,
            reserveB,
            reserveAHuman: totalReserveAHuman,
            reserveBHuman: totalReserveBHuman,
            price: totalReserveBHuman > 0 ? (totalReserveAHuman / totalReserveBHuman).toString() : '0',
            totalShares: position.liquidity,
            decimalsA: 9,
            decimalsB: 9,
          });
        } else {
          console.log(`⏭️ Skipping pool with no meaningful liquidity: ${position.symbolA}/${position.symbolB} (amountA: ${userAmountA}, amountB: ${userAmountB}, share: ${sharePercent}%)`);
        }
      }
    });

    const result = Array.from(poolMap.values());
    console.log('🔄 allPools after merge:', result);
    return result;
  }, [pools, positions]);

  // Auto-refresh balances every 30 seconds while wallet is connected
  useEffect(() => {
    if (!wallet?.address) return;

    // Set up interval to refresh balances
    const intervalId = setInterval(() => {
      console.log('⏰ Auto-refreshing balances...');
      refreshBalances().catch(err => console.error('Auto-refresh failed:', err));
    }, 30000); // 30 seconds

    // Clean up interval on unmount or when wallet disconnects
    return () => clearInterval(intervalId);
  }, [wallet?.address, wallet?.seed, wallet?.accountIndex]);

  // Debug: Monitor newSeedBackup state changes
  useEffect(() => {
    console.log('🟣 newSeedBackup state changed:', newSeedBackup);
    console.log('🟣 Modal should be open:', !!newSeedBackup);
  }, [newSeedBackup]);

  async function generateWallet() {
    setLoading(true);
    try {
      console.log('🔵 Generating wallet (client-side)...');

      // Generate hex seed directly
      const walletData = generateWalletClient();
      const seed = walletData.seed;
      console.log('✅ Hex seed generated');

      // Derive address from seed
      const address = getAddressFromSeed(seed, 0);

      console.log('✅ Wallet generated client-side');
      console.log('✅ Address:', address);
      console.log('✅ Seed:', seed.substring(0, 10) + '...');

      // Show seed backup modal
      setNewSeedBackup(seed);
      setSeedBackupConfirmed(false);
      console.log('✅ Showing seed backup modal');
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
      console.log('🔍 Importing wallet (client-side)...');
      console.log('🔍 Account index:', accountIndex);

      // Clear old positions data before importing new wallet
      setPositions([]);
      setPools([]);

      // Derive address from seed (client-side)
      const address = getAddressFromSeed(seed, accountIndex);
      console.log('✅ Address derived:', address);

      // Fetch balances from blockchain (client-side)
      console.log('📊 Fetching balances from Keeta blockchain...');
      const tokens = await fetchBalances(seed, accountIndex);
      console.log('✅ Balances fetched:', tokens);

      const walletData: KeetaWallet = {
        address,
        seed,
        accountIndex,
        tokens,
      };

      setWallet(walletData);
      localStorage.setItem("keetaWallet", JSON.stringify(walletData));

      console.log('✅ Wallet imported and saved to localStorage');

      toast({
        title: "Wallet Ready!",
        description: `Connected to ${address.substring(0, 20)}... with ${tokens.length} tokens`,
      });
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
    if (!seedInput) {
      toast({
        title: "Invalid Input",
        description: "Please enter your hex seed",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate hex seed
      const trimmedSeed = seedInput.trim();
      if (trimmedSeed.length !== 64 || !/^[0-9a-fA-F]+$/.test(trimmedSeed)) {
        toast({
          title: "Invalid Hex Seed",
          description: "Seed must be 64 hex characters",
          variant: "destructive",
        });
        return;
      }
      const seed = trimmedSeed;

      // Use importWalletWithSeed helper with accountIndex 0 (default)
      await importWalletWithSeed(seed, 0);
      setSeedInput("");
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function refreshBalances() {
    if (!wallet) return;

    try {
      console.log('🔄 Refreshing balances...');
      const tokens = await fetchBalances(wallet.seed, wallet.accountIndex || 0);

      const updatedWallet = {
        ...wallet,
        tokens,
      };

      setWallet(updatedWallet);
      localStorage.setItem("keetaWallet", JSON.stringify(updatedWallet));
      console.log('✅ Balances refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh balances:', error);
    }
  }

  async function connectKeythingsWallet() {
    setLoading(true);
    try {
      // Check if Keythings is installed
      if (!isKeythingsInstalled()) {
        toast({
          title: "Keythings Not Found",
          description: "Please install the Keythings browser extension to continue",
          variant: "destructive",
        });
        return;
      }

      console.log('🔌 Connecting to Keythings wallet...');

      // Request connection
      const accounts = await connectKeythings();

      if (!accounts || accounts.length === 0) {
        throw new Error("Please unlock your Keythings wallet and ensure you have an account created. Then try connecting again.");
      }

      const address = accounts[0];
      console.log('✅ Connected to Keythings:', address);

      // Clear old positions/pools data
      setPositions([]);
      setPools([]);

      // Fetch balances using Keythings' native API
      console.log('📊 Fetching balances via Keythings...');

      const { getNormalizedBalances } = await import('@/lib/keythings-provider');
      const balances = await getNormalizedBalances(address);

      console.log('✅ Keythings balances:', balances);

      // Transform Keythings balances to our token format
      const tokens = balances.map((bal: any) => ({
        address: bal.token,
        symbol: bal.token === 'KTA' ? 'KTA' : bal.token.slice(0, 8), // Use first 8 chars as symbol for custom tokens
        balance: bal.balance,
        balanceFormatted: (parseFloat(bal.balance) / 1e9).toFixed(4), // Assuming 9 decimals
        decimals: 9,
      }));

      // For Keythings wallet, we use a placeholder seed since signing is done via extension
      const placeholderSeed = "0".repeat(64);

      // Create wallet object
      const walletData: KeetaWallet = {
        address,
        seed: placeholderSeed, // Not used for Keythings - signing is done via extension
        isKeythings: true,
        tokens,
      };

      setWallet(walletData);
      setKeythingsConnected(true);
      setKeythingsAddress(address);

      // Set up event listeners
      onAccountsChanged((accounts) => {
        console.log('👤 Keythings account changed:', accounts);
        if (accounts.length === 0) {
          // Disconnected
          disconnectWallet();
        } else {
          // Account switched - reconnect with new account
          connectKeythingsWallet();
        }
      });

      onDisconnect(() => {
        console.log('🔌 Keythings disconnected');
        disconnectWallet();
      });

      toast({
        title: "Keythings Connected!",
        description: `Connected to ${address.substring(0, 20)}...`,
      });

      // Note: We'll save to localStorage but mark it as Keythings
      localStorage.setItem("keetaWallet", JSON.stringify(walletData));

      // Fetch data (balances will be empty initially - need to implement Keythings balance fetching)
      console.log('📊 Loading pools and positions...');

      // Load pools
      await loadPools();

      // For positions, we'll need the actual implementation
      // For now, just log that we're connected
      console.log('✅ Keythings wallet connected successfully');

    } catch (error: any) {
      console.error('❌ Keythings connection error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Keythings wallet",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function disconnectWallet() {
    setWallet(null);
    setKeythingsConnected(false);
    setKeythingsAddress(null);
    localStorage.removeItem("keetaWallet");
    // Also clear header connection markers
    localStorage.removeItem('keythingsConnected');
    localStorage.removeItem('keythingsAddress');
    setPools([]);
    setPositions([]);
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    });
  }

  async function loadPools() {
    try {
      const poolsData = await fetchPools();
      console.log('🔍 Fetched pools data:', poolsData);
      if (poolsData && poolsData.length > 0) {
        console.log('🔍 First pool reserves:', {
          reserveAHuman: poolsData[0].reserveAHuman,
          reserveBHuman: poolsData[0].reserveBHuman
        });
      }
      setPools(poolsData || []);
    } catch (error) {
      console.error("Failed to fetch pools:", error);
    }
  }

  async function fetchPositions() {
    if (!wallet) return;

    try {
      console.log('📋 Fetching positions client-side...');
      const userPositions = await fetchLiquidityPositions(wallet.seed, wallet.accountIndex || 0);
      setPositions(userPositions);
      console.log('✅ Positions loaded:', userPositions);
    } catch (error) {
      console.error("Failed to fetch positions:", error);
      setPositions([]);
    }
  }

  async function getSwapQuote() {
    if (!selectedPoolForSwap || !swapTokenIn || !swapAmount || !wallet) return;

    try {
      const pool = pools.find((p) => p.poolAddress === selectedPoolForSwap);
      if (!pool) return;

      // Determine tokenOut (the opposite token in the pool)
      const tokenOut = pool.tokenA === swapTokenIn ? pool.tokenB : pool.tokenA;
      const tokenInSymbol = pool.tokenA === swapTokenIn ? pool.symbolA : pool.symbolB;
      const tokenOutSymbol = pool.tokenA === swapTokenIn ? pool.symbolB : pool.symbolA;

      // Use client-side swap quote calculation
      const quote = await getSwapQuoteClient(
        swapTokenIn,
        tokenOut,
        swapAmount,
        selectedPoolForSwap
      );

      if (quote) {
        setSwapQuote({
          amountOut: quote.amountOutHuman.toFixed(6),
          amountOutHuman: quote.amountOutHuman.toFixed(6),
          priceImpact: quote.priceImpact.toFixed(2),
          minimumReceived: (Number(quote.minimumReceived) / 1e9).toFixed(6),
          feeAmountHuman: `${quote.feeAmountHuman.toFixed(6)} ${tokenInSymbol}`,
          tokenOutSymbol,
        });
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
    if (!wallet || !selectedPoolForSwap || !swapTokenIn || !swapAmount || !swapQuote) return;

    setSwapping(true);
    try {
      const pool = pools.find((p) => p.poolAddress === selectedPoolForSwap);
      if (!pool) {
        throw new Error("Pool not found");
      }

      // Determine tokenOut (the opposite token in the pool)
      const tokenOut = pool.tokenA === swapTokenIn ? pool.tokenB : pool.tokenA;
      const tokenInSymbol = pool.tokenA === swapTokenIn ? pool.symbolA : pool.symbolB;
      const tokenOutSymbol = pool.tokenA === swapTokenIn ? pool.symbolB : pool.symbolA;

      console.log('🔄 Executing swap via backend API (requires ops SEND_ON_BEHALF permission)...');

      // Execute swap via backend API (ops account has SEND_ON_BEHALF permission on pool)
      const swapResponse = await fetch(`${API_BASE}/swap/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: wallet.address,
          userSeed: wallet.seed,
          tokenIn: swapTokenIn,
          tokenOut: tokenOut,
          amountIn: swapAmount,
          minAmountOut: swapQuote.minimumReceived,
          slippagePercent: 0.5,
        }),
      });

      const result = await swapResponse.json();

      console.log('🔍 Swap API result received:', JSON.stringify(result, null, 2));

      if (result.success) {
        // Build explorer link using block hash from result.result.blockHash
        const blockHash = result.result?.blockHash || result.blockHash;
        console.log('🔍 Block hash extracted:', blockHash);

        const explorerUrl = blockHash
          ? `https://explorer.test.keeta.com/block/${blockHash}`
          : `https://explorer.test.keeta.com/account/${wallet.address}`;

        console.log('🔍 Explorer URL built:', explorerUrl);

        toast({
          title: "Swap Successful!",
          description: (
            <div className="space-y-1">
              <div>Swapped {swapAmount} {tokenInSymbol} for {swapQuote.amountOutHuman} {tokenOutSymbol}</div>
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

        // Clear form
        setSwapAmount("");
        setSwapQuote(null);

        // Wait for blockchain to sync before refreshing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Refresh wallet balances
        await refreshBalances();

        // Refresh pools to update reserves
        await loadPools();
      } else {
        throw new Error(result.error || "Swap failed");
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

    setCreatingPool(true);
    try {
      console.log('🏊 Creating new pool via backend API (creates STORAGE account with AMM logic)...');

      // Call backend API to create pool and add initial liquidity
      // The backend will create a proper STORAGE account with swap functionality
      const response = await fetch(`${API_BASE}/liquidity/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSeed: wallet.seed,
          tokenA: newPoolTokenA,
          tokenB: newPoolTokenB,
          amountADesired: liqAmountA,
          amountBDesired: liqAmountB,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Pool created with AMM logic and initial liquidity added');

        // Build explorer link - use pool address to view the newly created pool
        const poolAddress = data.result.poolAddress;
        const explorerUrl = poolAddress
          ? `https://explorer.test.keeta.com/account/${poolAddress}`
          : `https://explorer.test.keeta.com/account/${wallet.address}`;

        toast({
          title: "Pool Created!",
          description: (
            <div className="space-y-1">
              <div>Added initial liquidity: {liqAmountA} + {liqAmountB}</div>
              <div className="text-sm text-gray-400">LP shares: {data.result.liquidity}</div>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 underline block mt-1"
              >
                View Pool on Explorer →
              </a>
            </div>
          ),
        });

        // Clear form
        setNewPoolTokenA("");
        setNewPoolTokenB("");
        setLiqAmountA("");
        setLiqAmountB("");

        // Wait for blockchain to sync before refreshing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Refresh data
        await refreshBalances();
        await loadPools();
        await fetchPositions();
      } else {
        throw new Error(data.error || "Failed to create pool");
      }
    } catch (error: any) {
      toast({
        title: "Pool Creation Failed",
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

      console.log('💧 Adding liquidity (calling keeta-client addLiquidity)...');
      console.log('  Using decimals:', pool.decimalsA, pool.decimalsB);

      // Execute add liquidity - this calls the backend API which creates LP STORAGE accounts
      const result = await addLiquidityClient(
        wallet.seed,
        selectedPoolForLiq,
        pool.tokenA,
        pool.tokenB,
        liqAmountA,
        liqAmountB,
        pool.decimalsA || 9,
        pool.decimalsB || 9,
        wallet.accountIndex || 0
      );

      if (result.success) {
        // Build explorer link
        const explorerUrl = result.blockHash
          ? `https://explorer.test.keeta.com/block/${result.blockHash}`
          : `https://explorer.test.keeta.com/account/${wallet.address}`;

        toast({
          title: "Liquidity Added!",
          description: (
            <div className="space-y-1">
              <div>Added {result.amountA} {pool.symbolA} and {result.amountB} {pool.symbolB}</div>
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

        // Clear form
        setLiqAmountA("");
        setLiqAmountB("");

        // Wait for blockchain to sync before refreshing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Refresh data
        await refreshBalances();
        await loadPools();
        await fetchPositions();
      } else {
        throw new Error(result.error || "Failed to add liquidity");
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
      console.log('🔥 Removing liquidity with client-side transaction signing...');

      // Execute remove liquidity using client-side implementation
      const result = await removeLiquidityClient(
        wallet.seed,
        position.poolAddress,
        position.tokenA,
        position.tokenB,
        removeLiqPercent,
        position.liquidity,
        wallet.accountIndex || 0
      );

      if (result.success) {
        // Build explorer link
        const explorerUrl = result.blockHash
          ? `https://explorer.test.keeta.com/block/${result.blockHash}`
          : `https://explorer.test.keeta.com/account/${wallet.address}`;

        toast({
          title: "Liquidity Removed!",
          description: (
            <div className="space-y-1">
              <div>Removed {removeLiqPercent}% of your liquidity</div>
              <div className="text-sm text-muted-foreground">
                Received {result.amountA} {position.symbolA} and {result.amountB} {position.symbolB}
              </div>
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

        // Wait for blockchain to sync before refreshing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Refresh data
        await refreshBalances();
        await loadPools();
        await fetchPositions();
      } else {
        throw new Error(result.error || "Failed to remove liquidity");
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

  async function executeSend() {
    if (!wallet || !sendToken || !sendRecipient || !sendAmount) return;

    setSending(true);
    try {
      const response = await fetch(`${API_BASE}/transfer/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderSeed: wallet.seed,
          recipientAddress: sendRecipient,
          tokenAddress: sendToken.address,
          amount: sendAmount,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Transfer Successful!",
          description: `Sent ${sendAmount} ${sendToken.symbol} to ${sendRecipient.slice(0, 12)}...`,
        });

        // Close dialog and refresh balances
        setSendDialogOpen(false);
        await refreshBalances();
      } else {
        throw new Error(result.error || "Transfer failed");
      }
    } catch (error: any) {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
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
              {isKeythingsInstalled() && (
                <>
                  <div className="rounded-xl border border-border/40 bg-secondary/40 p-6 backdrop-blur">
                    <h3 className="text-sm font-semibold mb-4">Connect Keythings Wallet</h3>
                    <div className="space-y-4">
                      <Button
                        onClick={connectKeythingsWallet}
                        disabled={loading}
                        className="w-full bg-brand hover:bg-brand/90"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Wallet className="mr-2 h-4 w-4" />
                            Connect Keythings Wallet
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="text-center text-sm text-muted-foreground">or</div>
                </>
              )}

              <div className="rounded-xl border border-border/40 bg-secondary/40 p-6 backdrop-blur">
                <h3 className="text-sm font-semibold mb-4">Generate New Wallet</h3>
                <div className="space-y-4">
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
        if (!open) {
          setNewSeedBackup(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500 flex-shrink-0" />
              <DialogTitle className="text-base sm:text-xl">Save Your Seed Phrase</DialogTitle>
            </div>
            <DialogDescription className="text-sm sm:text-base">
              This is your wallet's recovery phrase. You will need it to restore access to your wallet.
              <span className="block mt-2 text-destructive font-semibold text-xs sm:text-sm">
                ⚠️ There is NO backup. If you lose this, you lose access to your funds forever!
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
            {/* Seed Display */}
            <div className="rounded-lg border-2 border-yellow-500/50 bg-yellow-500/10 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-xs sm:text-sm font-semibold text-yellow-600 dark:text-yellow-400">
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
                  className="h-7 sm:h-8 gap-1 sm:gap-2 flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3"
                >
                  {copiedSeed ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Copy</span>
                    </>
                  )}
                </Button>
              </div>
              <code className="block break-all text-[10px] sm:text-xs font-mono bg-black/20 p-2 sm:p-3 rounded leading-relaxed">
                {newSeedBackup}
              </code>
            </div>

            {/* Warning Checklist */}
            <div className="space-y-2 sm:space-y-3 rounded-lg border border-border/40 bg-secondary/40 p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <Info className="h-4 w-4 sm:h-5 sm:w-5 text-sky-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm space-y-1 sm:space-y-2 min-w-0">
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
            <div className="flex items-start gap-2 sm:gap-3 rounded-lg border-2 border-destructive/50 bg-destructive/10 p-3 sm:p-4">
              <Checkbox
                id="seed-confirm"
                checked={seedBackupConfirmed}
                onCheckedChange={(checked) => setSeedBackupConfirmed(checked as boolean)}
                className="mt-1 flex-shrink-0"
              />
              <label
                htmlFor="seed-confirm"
                className="text-xs sm:text-sm font-medium leading-tight cursor-pointer select-none"
              >
                I have written down my seed phrase and understand that I will lose access to my
                wallet if I lose it. There is no way to recover it.
              </label>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setNewSeedBackup(null);
                setSeedBackupConfirmed(false);
                setCopiedSeed(false);
              }}
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSeedBackup}
              disabled={!seedBackupConfirmed}
              className="bg-brand hover:bg-brand/90 w-full sm:w-auto text-xs sm:text-sm"
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-lg bg-brand/20 p-2 flex-shrink-0">
                      <Wallet className="h-5 w-5 text-sky-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg">Keeta Wallet</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs font-mono text-muted-foreground truncate block max-w-[180px] sm:max-w-none">
                          {wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 flex-shrink-0"
                          onClick={() => copyToClipboard(wallet.address)}
                        >
                          {copiedAddress ? (
                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      {wallet.isKeythings && (
                        <div className="flex items-center gap-1 mt-1">
                          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-xs text-green-400 font-medium">Connected via Keythings</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={disconnectWallet} className="flex-shrink-0 self-start sm:self-center">
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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => {
                              setSendToken(token);
                              setSendRecipient("");
                              setSendAmount("");
                              setSendDialogOpen(true);
                            }}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                          <div className="text-right">
                            <div className="text-lg font-bold">{token.balanceFormatted}</div>
                            <div className="text-xs text-muted-foreground">{token.symbol}</div>
                            {tokenPrices?.[token.address]?.priceUsd && (
                              <div className="text-xs text-muted-foreground">
                                ${(parseFloat(token.balanceFormatted) * tokenPrices[token.address].priceUsd!).toFixed(2)} USD
                              </div>
                            )}
                          </div>
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-card/60 border border-border/40">
                <TabsTrigger value="swap" className="text-xs sm:text-sm px-2 sm:px-4">
                  <ArrowRightLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Swap</span>
                </TabsTrigger>
                <TabsTrigger value="pools" className="text-xs sm:text-sm px-2 sm:px-4">
                  <Droplets className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Pools</span>
                </TabsTrigger>
                <TabsTrigger value="liquidity" className="text-xs sm:text-sm px-2 sm:px-4">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Liquidity</span>
                </TabsTrigger>
              </TabsList>

              {/* Pools Tab */}
              <TabsContent value="pools">
                <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
                  <CardHeader>
                    <CardTitle>Liquidity Pools</CardTitle>
                    <CardDescription>View all pools and manage your positions</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-visible">
                    {allPools.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Droplets className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No pools yet. Be the first to create one!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        {allPools.map((pool) => {
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
                            decimalsA: pool.decimalsA || 9, // Use actual decimals from API, fallback to 9
                            decimalsB: pool.decimalsB || 9,
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
                                setCreateMode(false);
                                setActiveTab("liquidity");
                              }}
                              onRemoveLiquidity={async (selectedPool, percent) => {
                                // Find the position to pass to removeLiquidity
                                const position = positions.find(
                                  (p) => p.poolAddress === selectedPool.poolAddress
                                );
                                if (!position) return;

                                setRemoveLiqPercent(percent);
                                await removeLiquidity(position);
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
                {/* QuickFill header row */}
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Select a share of your balance</span>
                  <QuickFill
                    balance={swapTokenIn && wallet ? parseFloat(wallet.tokens.find(t => t.address === swapTokenIn)?.balanceFormatted || "0") : undefined}
                    onSelect={setSwapAmount}
                    percents={[25, 50, 75, 100]}
                  />
                </div>

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
                  {swapTokenIn && swapAmount && tokenPrices?.[swapTokenIn]?.priceUsd && (
                    <div className="text-xs text-muted-foreground text-right mt-1">
                      ${(parseFloat(swapAmount) * tokenPrices[swapTokenIn].priceUsd!).toFixed(2)} USD
                    </div>
                  )}
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
                    {selectedPoolForSwap && wallet && (() => {
                      const pool = pools.find((p) => p.poolAddress === selectedPoolForSwap);
                      if (!pool) return null;
                      const tokenOut = pool.tokenA === swapTokenIn ? pool.tokenB : pool.tokenA;
                      const tokenOutBalance = wallet.tokens.find(t => t.address === tokenOut);
                      return tokenOutBalance ? (
                        <span>
                          Bal: {tokenOutBalance.balanceFormatted}
                        </span>
                      ) : null;
                    })()}
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
                  {selectedPoolForSwap && swapQuote && (() => {
                    const pool = pools.find((p) => p.poolAddress === selectedPoolForSwap);
                    if (!pool) return null;
                    const tokenOut = pool.tokenA === swapTokenIn ? pool.tokenB : pool.tokenA;
                    const price = tokenPrices?.[tokenOut]?.priceUsd;
                    if (!price) return null;
                    return (
                      <div className="text-xs text-muted-foreground text-right mt-1">
                        ${(parseFloat(swapQuote.amountOutHuman) * price).toFixed(2)} USD
                      </div>
                    );
                  })()}
                </div>

                {/* Quote Details */}
                {swapQuote && (
                  <div className="rounded-lg bg-secondary/40 p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Output</span>
                      <span className="font-medium">{swapQuote.amountOutHuman} {swapQuote.tokenOutSymbol}</span>
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

          {/* Liquidity Tab */}
          <TabsContent value="liquidity">
            <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
              <CardHeader>
                <CardTitle>Liquidity</CardTitle>
                <CardDescription>Add liquidity to pools and earn trading fees</CardDescription>
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
            </Tabs>
          </div>
        </div>
      </div>

      {/* Seed Backup Modal */}
      <Dialog open={!!newSeedBackup} onOpenChange={(open) => {
        console.log('🟠 Dialog onOpenChange called, open:', open);
        if (!open) {
          setNewSeedBackup(null);
        }
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

      {/* Send Tokens Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send {sendToken?.symbol}</DialogTitle>
            <DialogDescription>
              Send tokens to another Keeta address
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient Address</label>
              <Input
                placeholder="keeta_a..."
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Amount
                {sendToken && (
                  <span className="text-muted-foreground font-normal ml-2">
                    (Balance: {sendToken.balanceFormatted} {sendToken.symbol})
                  </span>
                )}
              </label>
              <Input
                type="number"
                placeholder="0.0"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
              />
              {sendToken && tokenPrices?.[sendToken.address]?.priceUsd && sendAmount && (
                <div className="text-xs text-muted-foreground">
                  ≈ ${(parseFloat(sendAmount) * tokenPrices[sendToken.address].priceUsd!).toFixed(2)} USD
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSendDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={executeSend}
              disabled={sending || !sendRecipient || !sendAmount}
              className="bg-brand hover:bg-brand/90"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
