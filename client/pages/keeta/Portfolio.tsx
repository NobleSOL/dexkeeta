import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet,
  Copy,
  CheckCircle2,
  Send,
  Loader2,
  Info,
} from "lucide-react";
import { useKeetaWallet } from "@/contexts/KeetaWalletContext";
import { isKeythingsInstalled } from "@/lib/keythings-provider";

export default function KeetaPortfolio() {
  const {
    wallet,
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
    connectKeythingsWallet,
    loading,
  } = useKeetaWallet();

  if (!wallet) {
    return (
      <div className="container py-10">
        <div className="mx-auto max-w-2xl">
          <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
            <CardHeader>
              <CardTitle>Portfolio</CardTitle>
              <CardDescription>
                Connect your Keeta wallet to view your portfolio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isKeythingsInstalled() ? (
                <div className="rounded-xl border border-border/40 bg-secondary/40 p-6 backdrop-blur">
                  <h3 className="text-sm font-semibold mb-4">Connect Wallet</h3>
                  <Button onClick={connectKeythingsWallet} disabled={loading} className="w-full bg-brand hover:bg-brand/90">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Wallet className="mr-2 h-4 w-4" />
                        Connect Keythings
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-6">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 mb-1">
                          Keythings Wallet Required
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Install the Keythings browser extension to connect and view your portfolio.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('https://keythings.io', '_blank')}
                      >
                        Get Keythings Wallet →
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-2xl">
        <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur">
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
    </div>
  );
}
