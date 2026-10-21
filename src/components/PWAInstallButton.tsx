import React, { useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={install}
        className="tap-scale gap-1.5 rounded-xl border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Install App</span>
      </Button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowIOSGuide(true)}
          className="tap-scale gap-1.5 rounded-xl border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold"
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>Install App</span>
        </Button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-bold text-foreground">Install on iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <p>
                  1. Tap the <strong className="text-foreground">Share</strong> icon at the bottom
                  of Safari.
                </p>
                <p>
                  2. Scroll down and tap{" "}
                  <strong className="text-foreground">Add to Home Screen</strong>.
                </p>
                <p>
                  3. Tap <strong className="text-foreground">Add</strong> in the top right corner.
                </p>
              </div>
              <Button
                type="button"
                className="mt-4 w-full rounded-xl text-xs"
                onClick={() => setShowIOSGuide(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
