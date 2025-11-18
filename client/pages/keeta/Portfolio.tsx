import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet,
  Copy,
  CheckCircle2,
  Send,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { useKeetaWallet } from "@/contexts/KeetaWalletContext";
import PriceChart from "@/components/charts/PriceChart";

interface PriceDataPoint {
  time: number;
  value: number;
}

export default function KeetaPortfolio() {
  const {
    wallet,
    pools,
    showAllTokens,
    setShowAllTokens,
    copiedAddress,
    tokenPrices,
    displayedTokens,
    disconnectWallet,
    copyToClipboard,
    setSendToken,
    setSendRecipient,
    setSendAmount,
    setSendDialogOpen,
  } = useKeetaWallet();

  const [selectedPool, setSelectedPool] = useState<string>("");
  const [chartData, setChartData] = useState<PriceDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-select first pool on mount
  useEffect(() => {
    if (pools.length > 0 && !selectedPool) {
      setSelectedPool(pools[0].poolAddress);
    }
  }, [pools]);

  // Fetch chart data when pool selection changes
  useEffect(() => {
    if (!selectedPool) return;

    const fetchChartData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/charts/price/${selectedPool}?limit=100`);
        const result = await response.json();

        if (result.success && result.data) {
          setChartData(result.data);
        } else {
          setChartData([]);
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [selectedPool]);

  const selectedPoolInfo = pools.find(p => p.poolAddress === selectedPool);

  if (!wallet) {
    return (
      <div className="container py-10">
        <div className="mx-auto max-w-2xl">
          <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
            <CardHeader>
              <CardTitle>Connect Wallet</CardTitle>
              <CardDescription>
                Please connect your wallet to view your portfolio
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
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
                  {wallet.tokens.length > 5 && (
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
                          <span>Show {wallet.tokens.length - 5} More Token{wallet.tokens.length - 5 > 1 ? 's' : ''}</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Price Charts */}
          <div className="lg:col-span-7">
            <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-sky-400" />
                    <CardTitle>Token Price Charts</CardTitle>
                  </div>
                </div>
                <CardDescription>Historical price data from pool reserves</CardDescription>
              </CardHeader>
              <CardContent>
                {pools.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">No pools available</p>
                    <p className="text-sm">Create a pool to see price charts</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Pool Selector */}
                    <div className="flex flex-wrap gap-2">
                      {pools.map((pool) => (
                        <button
                          key={pool.poolAddress}
                          onClick={() => setSelectedPool(pool.poolAddress)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                            selectedPool === pool.poolAddress
                              ? 'bg-brand text-white shadow-lg'
                              : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                          }`}
                        >
                          {pool.symbolA} / {pool.symbolB}
                        </button>
                      ))}
                    </div>

                    {/* Chart Display */}
                    {loading ? (
                      <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
                      </div>
                    ) : chartData.length > 0 ? (
                      <PriceChart
                        data={chartData}
                        tokenSymbol={selectedPoolInfo ? `${selectedPoolInfo.symbolA}/${selectedPoolInfo.symbolB}` : ''}
                      />
                    ) : (
                      <div className="text-center py-20 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No price data available</p>
                        <p className="text-sm">Price history will appear as the pool records snapshots</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
