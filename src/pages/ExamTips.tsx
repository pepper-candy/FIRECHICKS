import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import QrScanner from "qr-scanner";
import QRCode from "react-qr-code";

type Role = "holder" | "receiver";

const ExamTips = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("holder");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [codeStatus, setCodeStatus] = useState<"pending" | "claimed" | "expired" | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Generate a unique share code via Neon API
  const generateCode = useCallback(async () => {
    try {
      const res = await fetch("/api/exam-tip?action=create", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create share code");
        return;
      }

      setShareCode(data.code);
      setCodeStatus("pending");
      toast.success("Share code generated! Show the QR to a receiver.");
    } catch (error) {
      console.error("Generate error:", error);
      toast.error("Failed to create share code");
    }
  }, []);

  // Poll for status changes (Neon polling)
  const pollStatus = useCallback(async (code: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/exam-tip?action=status&code${code}`);
        const data = await res.json();

        if (!res.ok) return;

        if (data.status === "claimed") {
          setCodeStatus("claimed");
          toast.success("🎉 Exam Tips successfully shared!");
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.status === "expired") {
          setCodeStatus("expired");
          toast.error("⏰ Code has expired. Generate a new one.");
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (error) {
        console.error("Poll error:", error);
      }
    }, 300); // Poll every 0.3 second
  }, []);

  // Start polling when a code is generated
  useEffect(() => {
    if (shareCode && codeStatus === "pending") {
      pollStatus(shareCode);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [shareCode, codeStatus, pollStatus]);

  // Start scanning
  const startScan = useCallback(() => {
    setScanning(true);
    setScanned(false);
  }, []);

  // Initialize scanner when scanning starts
  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      async (result) => {
        const code = result.data;
        if (!code || scanned) return;

        setScanned(true);
        scanner.stop();
        setScanning(false);

        // Claim the code via Neon API
        try {
          const res = await fetch("/api/exam-tip?action=claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const data = await res.json();

          if (!res.ok) {
            toast.error(data.error || "Failed to claim tips");
            setScanned(false);
            return;
          }

          toast.success("📚 Exam Tips received!");
        } catch (error) {
          console.error("Claim error:", error);
          toast.error("Failed to claim tips");
          setScanned(false);
        }
      },
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
      }
    );

    scannerRef.current = scanner;
    scanner.start().catch((err) => {
      console.error("Camera error:", err);
      toast.error("Could not access camera");
      setScanning(false);
    });

    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [scanning, scanned]);

  const stopScan = useCallback(() => {
    scannerRef.current?.stop();
    setScanning(false);
  }, []);

  const resetHolder = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setShareCode(null);
    setCodeStatus(null);
  };

  const isCodeInactive = codeStatus === "claimed" || codeStatus === "expired";

  return (
    <div className="flex flex-col items-center min-h-screen p-6 gap-6">
      <div className="flex items-center justify-between w-full max-w-md">
        <Button variant="ghost" onClick={() => navigate("/")} className="text-sm font-mono">
          ← Back
        </Button>
        <h1 className="text-lg font-bold text-primary tracking-wide">Exam Tips</h1>
        <div className="w-16" />
      </div>

      {/* Role selector */}
      <div className="w-full max-w-md p-4 rounded-xl border border-border bg-card">
        <RadioGroup
          value={role}
          onValueChange={(v) => {
            setRole(v as Role);
            resetHolder();
            setScanning(false);
            setScanned(false);
          }}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="holder" id="holder" />
            <Label htmlFor="holder" className="text-sm font-mono cursor-pointer">
              Tips Holder
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="receiver" id="receiver" />
            <Label htmlFor="receiver" className="text-sm font-mono cursor-pointer">
              Tips Receiver
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Holder view */}
      {role === "holder" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          {!shareCode ? (
            <Button onClick={generateCode} className="w-full h-14 text-sm font-mono">
              Generate Share Code
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-border bg-card w-full">
              <p className="text-xs text-muted-foreground font-mono">
                {codeStatus === "claimed"
                  ? "This code has been claimed"
                  : codeStatus === "expired"
                  ? "This code has expired"
                  : "Show this QR to a nearby receiver"}
              </p>
              <div className="relative bg-white p-4 rounded-lg">
                <div className={isCodeInactive ? "blur-[2px] grayscale opacity-80" : ""}>
                  <QRCode value={shareCode} size={200} />
                </div>
                {isCodeInactive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="transform rotate-[-12deg] border-4 border-destructive px-4 py-2 rounded-md bg-white/90 shadow-lg">
                      <span className="text-3xl font-black text-destructive tracking-tighter uppercase">
                        {codeStatus === "claimed" ? "Claimed" : "Expired"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {!isCodeInactive && (
                <>
                  <p className="text-[10px] text-muted-foreground font-mono break-all text-center">
                    {shareCode}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono animate-pulse">
                    Waiting for scan...
                  </p>
                </>
              )}
              <Button variant="outline" onClick={resetHolder} className="text-sm font-mono">
                Generate New Code
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Receiver view */}
      {role === "receiver" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          {!scanning && !scanned && (
            <Button onClick={startScan} className="w-full h-14 text-sm font-mono">
              Scan for Tips
            </Button>
          )}

          {scanning && (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-border">
                <video ref={videoRef} className="w-full h-full object-cover" />
              </div>
              <Button variant="outline" onClick={stopScan} className="text-sm font-mono">
                Stop Scanning
              </Button>
            </div>
          )}

          {scanned && (
            <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-border bg-card w-full">
              <p className="text-2xl">✅</p>
              <p className="text-sm font-mono text-primary">Tips received successfully!</p>
              <Button
                variant="outline"
                onClick={() => {
                  setScanned(false);
                }}
                className="text-sm font-mono"
              >
                Scan Another
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExamTips;