import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { base } from "viem/chains";
import { useNetwork } from "@/contexts/NetworkContext";
import { useKeetaWallet } from "@/contexts/KeetaWalletContext";
import { toast } from "@/hooks/use-toast";

function truncate(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ConnectButton() {
  const { network } = useNetwork();
  const { address, isConnected } = useAccount();
  const { connectors, connect, status, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Get Keythings wallet state from context
  const { keythingsAddress, keythingsConnected, connectKeythingsWallet, disconnectWallet } = useKeetaWallet();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  // Keeta network - show Keythings wallet
  if (network === "Keeta") {
    if (keythingsConnected && keythingsAddress) {
      return (
        <div className="relative" ref={ref}>
          <Button onClick={() => setOpen((o) => !o)}>
            {truncate(keythingsAddress)}
          </Button>
          {open && (
            <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-md border border-border/60 bg-popover p-1 text-popover-foreground shadow-md">
              <button
                className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  disconnectWallet();
                  setOpen(false);
                }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <Button onClick={connectKeythingsWallet}>
        Connect Wallet
      </Button>
    );
  }

  // Base network - show wagmi wallet (MetaMask, Phantom, etc.)
  if (isConnected)
    return (
      <div className="relative" ref={ref}>
        <Button onClick={() => setOpen((o) => !o)}>{truncate(address)}</Button>
        {open && (
          <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-md border border-border/60 bg-popover p-1 text-popover-foreground shadow-md">
            <button
              className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );

  const connectPreferred = () => {
    // Auto-connect with preferred wallet (MetaMask/injected first, then fallback)
    const preferred = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (preferred) {
      connect({ connector: preferred, chainId: base.id });
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button onClick={connectPreferred}>Connect Wallet</Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-border/60 bg-popover p-1 text-popover-foreground shadow-md">
          {connectors.map((c) => (
            <button
              key={c.id}
              className={cn(
                "block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent",
                {
                  "opacity-50": !c.ready,
                },
              )}
              disabled={!c.ready}
              onClick={() => {
                connect({ connector: c, chainId: base.id });
                setOpen(false);
              }}
            >
              {c.name}
            </button>
          ))}
          {status === "error" && (
            <div className="px-3 py-2 text-xs text-destructive-foreground">
              {error?.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
