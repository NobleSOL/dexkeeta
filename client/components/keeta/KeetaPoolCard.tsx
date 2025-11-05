import { TrendingUp, Droplet, ArrowRight, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface KeetaPoolCardData {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  symbolA: string;
  symbolB: string;
  reserveA: string;
  reserveB: string;
  reserveAHuman: number;
  reserveBHuman: number;
  decimalsA?: number;
  decimalsB?: number;
  totalShares: string;
  userPosition?: {
    shares: string;
    sharePercent: number;
    amountA: string;
    amountB: string;
  };
}

export function KeetaPoolCard({
  pool,
  onManage
}: {
  pool: KeetaPoolCardData;
  onManage: (pool: KeetaPoolCardData) => void;
}) {
  // Handle undefined reserves gracefully
  const reserveAHuman = pool.reserveAHuman ?? 0;
  const reserveBHuman = pool.reserveBHuman ?? 0;

  // Calculate TVL display
  const tvl = `${reserveAHuman.toFixed(2)} ${pool.symbolA} + ${reserveBHuman.toFixed(2)} ${pool.symbolB}`;

  // Estimate APY (simplified - assumes daily volume is ~10% of TVL)
  const assumedDailyVolumePercent = 0.1;
  const estimatedAPY = reserveAHuman > 0
    ? ((assumedDailyVolumePercent * 0.003 * 365) * 100).toFixed(2)
    : "0.00";

  // User's position
  const hasPosition = pool.userPosition && pool.userPosition.sharePercent > 0;
  const userAmountA = hasPosition ? parseFloat(pool.userPosition!.amountA) / Math.pow(10, pool.decimalsA || 9) : 0;
  const userAmountB = hasPosition ? parseFloat(pool.userPosition!.amountB) / Math.pow(10, pool.decimalsB || 9) : 0;

  // Estimated fee earnings (protocol fee goes to treasury, but LPs earn from price impact)
  const estimatedDailyVolume = reserveAHuman * 0.1;
  const totalDailyFees = estimatedDailyVolume * 0.003;
  const userDailyFees = hasPosition
    ? (totalDailyFees * pool.userPosition!.sharePercent / 100)
    : 0;

  return (
    <div className={`rounded-xl border bg-card/40 backdrop-blur p-4 transition-all hover:border-brand/50 hover:shadow-lg ${hasPosition ? 'border-brand/30 bg-brand/5' : 'border-border/60'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Token pair display */}
          <div className="flex items-center">
            {pool.symbolA === "KTA" ? (
              <div className="w-8 h-8 rounded-full shadow-md border-2 border-background overflow-hidden">
                <img
                  src="https://assets.kraken.com/marketing/web/icons-uni-webp/s_kta.webp?i=kds"
                  alt="KTA"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full shadow-md border-2 border-background bg-gradient-to-br from-brand/20 to-brand/10 flex items-center justify-center text-xs font-bold text-brand">
                {pool.symbolA.slice(0, 2)}
              </div>
            )}
            <div className="w-8 h-8 rounded-full shadow-md border-2 border-background -ml-2 bg-gradient-to-br from-brand/20 to-brand/10 flex items-center justify-center text-xs font-bold text-brand">
              {pool.symbolB.slice(0, 2)}
            </div>
          </div>
          <div>
            <div className="font-semibold text-sm">
              {pool.symbolA}/{pool.symbolB}
            </div>
            <div className="text-xs text-muted-foreground">
              Silverback Pool
            </div>
            <a
              href={`https://explorer.test.keeta.com/account/${pool.poolAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              {pool.poolAddress.slice(0, 12)}...{pool.poolAddress.slice(-8)}
            </a>
          </div>
        </div>

        {hasPosition && (
          <div className="rounded-full bg-brand/20 px-2 py-0.5 text-xs font-medium text-white">
            Your Pool
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* TVL */}
        <div className="rounded-lg border border-border/40 bg-secondary/40 p-2">
          <div className="text-xs text-muted-foreground mb-1">Total Liquidity</div>
          <div className="text-xs font-semibold leading-tight">{tvl}</div>
        </div>

        {/* APY */}
        <div className="rounded-lg border border-border/40 bg-secondary/40 p-2">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="h-3 w-3 text-green-400" />
            <span className="text-xs text-muted-foreground">Est. APY</span>
          </div>
          <div className="text-xs font-semibold text-green-400">{estimatedAPY}%</div>
        </div>
      </div>

      {/* User Position */}
      {hasPosition && (
        <>
          <div className="rounded-lg border border-brand/40 bg-brand/10 p-2 mb-2">
            <div className="flex items-center gap-1 mb-1">
              <Droplet className="h-3 w-3 text-sky-400" />
              <span className="text-xs text-muted-foreground">Your Position</span>
            </div>
            <div className="text-xs font-semibold text-sky-400">
              {Number(pool.userPosition?.sharePercent || 0).toFixed(4)}% of pool
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {userAmountA.toFixed(4)} {pool.symbolA} + {userAmountB.toFixed(4)} {pool.symbolB}
            </div>
          </div>

          {/* Fee Earnings Estimate */}
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-2 mb-3">
            <div className="flex items-center gap-1 mb-1">
              <Coins className="h-3 w-3 text-green-400" />
              <span className="text-xs text-muted-foreground">Est. Price Impact Earnings</span>
            </div>
            <div className="text-xs font-semibold text-green-400">
              ~{userDailyFees.toFixed(6)} {pool.symbolA}/day
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              From trading volume and arbitrage (0.3% fee to treasury)
            </div>
          </div>
        </>
      )}

      {/* Exchange Rate */}
      <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
        <div>1 {pool.symbolA} = {reserveAHuman > 0 ? (reserveBHuman / reserveAHuman).toFixed(6) : '0.000000'} {pool.symbolB}</div>
        <div>1 {pool.symbolB} = {reserveBHuman > 0 ? (reserveAHuman / reserveBHuman).toFixed(6) : '0.000000'} {pool.symbolA}</div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-8"
          onClick={() => onManage(pool)}
        >
          {hasPosition ? 'Manage' : 'Add Liquidity'}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
