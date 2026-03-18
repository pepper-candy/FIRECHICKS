import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "react-qr-code";
import QrScanner from "qr-scanner";

type Role = "holder" | "receiver";

const ExamTips = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("holder");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [codeUsed, setCodeUsed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  // Generate a unique share code
  const generateCode = useCallback(async () => {
    const code = crypto.randomUUID();
    setShareCode(code);

    // Insert into mission_logs as pending
    const { error } = await supabase.from("mission_logs").insert({ share_code: code, status: "pending" });

    if (error) {
      toast.error("Failed to create share code");
      console.error(error);
      return;
    }

    toast.success("Share code generated! Show the QR to a receiver.");
  }, []);

  // Holder: listen for realtime updates on their share code
  useEffect(() => {
    if (role !== "holder" || !shareCode) return;

    const channel = supabase.
    channel(`mission-${shareCode}`).
    on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "mission_logs",
        filter: `share_code=eq.${shareCode}`
      },
      (payload) => {
        if (payload.new && (payload.new as any).status === "received") {
          setCodeUsed(true);
          toast.success("🎉 Exam Tips successfully shared!");
        }
      }
    ).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, shareCode]);

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

        // Check if code is still pending (not already used)
        const { data: existing } = await supabase.from("mission_logs").select("status").eq("share_code", code).single();

        if (!existing || existing.status !== "pending") {
          toast.error("⚠️ This QR code has already been used!");
          setScanned(false);
          return;
        }

        // Update mission_logs status to received
        const { error } = await supabase.
        from("mission_logs").
        update({ status: "received" }).
        eq("share_code", code).
        eq("status", "pending");

        if (error) {
          toast.error("Failed to confirm receipt");
          console.error(error);
          return;
        }

        toast.success("📚 Exam Tips received!");
      },
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true
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
            setShareCode(null);
            setScanning(false);
            setScanned(false);
          }}
          className="flex gap-4">
          
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
      {role === "holder" &&
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <Button onClick={generateCode} className="w-full h-14 text-sm font-mono">
            Generate Share Code
          </Button>

          {shareCode &&
        <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-border bg-card w-full">
              <p className="text-xs text-muted-foreground font-mono">
                {codeUsed ? "This code has been used" : "Show this QR to a nearby receiver"}
              </p>
              <div className="relative bg-white p-4 rounded-lg">
                <div className={codeUsed ? "blur-[2px] grayscale opacity-80 pointer-events-none select-none" : ""}>
                  <QRCode value={shareCode} size={200} />
                </div>
                {/* The "USED" Stamp overlay */}
                {codeUsed &&
            <div className="absolute inset-0 flex items-center justify-center">
                    <div className="transform rotate-[-12deg] border-4 border-destructive px-4 py-2 rounded-md bg-white/90 shadow-lg">
                      <span className="text-3xl font-black text-destructive tracking-tighter uppercase">Claimed</span>
                    </div>
                  </div>
            }
              </div>
              {!codeUsed &&
          <>
                  <p className="text-[10px] text-muted-foreground font-mono break-all text-center">{shareCode}</p>
                  <p className="text-xs text-muted-foreground font-mono animate-pulse">
                    Waiting for scan confirmation...
                  </p>
                </>
          }
              {codeUsed &&
          <Button
            variant="outline"
            onClick={() => {
              setCodeUsed(false);
              setShareCode(null);
            }}
            className="text-sm font-mono">
            
                  Generate New Code
                </Button>
          }
            </div>
        }
        </div>
      }

      {/* Receiver view */}
      {role === "receiver" &&
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
          {!scanning && !scanned &&
        <Button onClick={startScan} className="w-full h-14 text-sm font-mono">
              Scan for Tips
            </Button>
        }

          {scanning &&
        <div className="flex flex-col items-center gap-4 w-full">
              <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-border">
                <video ref={videoRef} className="w-full h-full object-cover" />
              </div>
              <Button variant="outline" onClick={stopScan} className="text-sm font-mono">
                Stop Scanning
              </Button>
            </div>
        }

          {scanned &&
        <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-border bg-card w-full">
              <p className="text-2xl">✅</p>
              <p className="text-sm font-mono text-primary">Tips received successfully!</p>
              <Button
            variant="outline"
            onClick={() => {
              setScanned(false);
            }}
            className="text-sm font-mono">
            
                Scan Another
              </Button>
            </div>
        }
        </div>
      }
    </div>);

};

export default ExamTips;