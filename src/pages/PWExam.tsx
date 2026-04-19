import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, ArrowLeft, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { assetUrl } from "@/lib/assets";

const ANSWER_KEY: Record<string, Record<number, string>> = {
  Final: { 1: "A+", 2: "4.3", 3: "FIRE", 4: "RED" },
  Mock: { 1: "UST", 2: "11M", 3: "BIRD", 4: "HALL" },
};

const ASPECT_W = 873;
const ASPECT_H = 457;

type ExamCategory = "Mock" | "Final" | null;
type Phase = "menu" | "questions" | "camera";

const PWExam = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState<ExamCategory>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [questionNum, setQuestionNum] = useState<number>(1);
  const [layer, setLayer] = useState<string>("layer-1");
  const [zoom, setZoom] = useState(0.8);
  const [opacity, setOpacity] = useState(0.9);
  const [answer, setAnswer] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [examWhiteBg, setExamWhiteBg] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const prefix = category === "Final" ? "PW_Final" : "PW_Mock";
  const overlayUrl = assetUrl(`/PW/${prefix}_${questionNum}_${layer}.png`);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Could not access camera");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (phase === "camera") {
      startCamera();
    }
    return () => stopCamera();
  }, [phase, startCamera, stopCamera]);

  const selectCategory = (cat: ExamCategory) => {
    setCategory(cat);
    setPhase("questions");
  };

  const selectQuestion = (num: number) => {
    setQuestionNum(num);
    setLayer("layer-1");
    setZoom(0.8);
    setOpacity(0.9);
    setAnswer("");
    setShowSuccess(false);
    setPhase("camera");
  };

  const goBack = () => {
    if (phase === "camera") {
      stopCamera();
      setPhase("questions");
    } else if (phase === "questions") {
      setPhase("menu");
      setCategory(null);
    }
  };

  const handleSubmit = () => {
    if (!category) return;
    const correct = ANSWER_KEY[category][questionNum];
    if (answer.toUpperCase().trim() === correct) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } else {
      toast.error("Incorrect answer. Try again!");
    }
  };

  // ─── Menu ─────────────────────────────────────────
  if (phase === "menu") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-8">
        <h1 className="text-lg md:text-2xl text-primary text-glow-green tracking-wider">PW EXAM</h1>
        <p className="text-xs text-muted-foreground font-mono max-w-xs text-center">
          Visual Cryptography — overlay layers to reveal the answer
        </p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Button
            onClick={() => selectCategory("Mock")}
            className="h-14 text-sm font-pixel bg-primary hover:bg-primary/80 text-primary-foreground glow-green"
          >
            MOCK EXAM
          </Button>
          <Button
            onClick={() => selectCategory("Final")}
            variant="outline"
            className="h-14 text-sm font-pixel border-secondary text-secondary hover:bg-secondary/10 glow-purple"
          >
            FINAL EXAM
          </Button>
          <Button
            onClick={() => navigate("/exam-tips")}
            variant="outline"
            className="h-14 text-sm font-pixel border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            EXAM TIPS
          </Button>
        </div>
        <Button
          onClick={() => navigate("/")}
          variant="ghost"
          className="text-xs text-muted-foreground hover:text-foreground font-mono"
        >
          🎮 Back to Game
        </Button>
      </div>
    );
  }

  // ─── Question Select ──────────────────────────────
  if (phase === "questions") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-8">
        <button onClick={goBack} className="absolute top-4 left-4 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg md:text-2xl text-primary text-glow-green tracking-wider">{category} EXAM</h1>
        <p className="text-xs text-muted-foreground font-mono">Select a question number</p>
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          {[1, 2, 3, 4].map((n) => (
            <Button
              key={n}
              onClick={() => selectQuestion(n)}
              variant="outline"
              className="h-20 text-lg font-pixel border-border hover:bg-muted"
            >
              Q{n}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Camera + Overlay ─────────────────────────────
  return (
    <div className="flex flex-col items-center min-h-screen bg-background p-4 pt-12">
      {/* Success overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-4 animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="w-24 h-24 text-primary" />
            <p className="text-2xl font-pixel text-primary text-glow-green">CORRECT!</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center w-full p-3 gap-3">
        <button onClick={goBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-pixel text-muted-foreground">
          {category} Q{questionNum}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setExamWhiteBg(!examWhiteBg)}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
              examWhiteBg ? "bg-white text-black border-white" : "bg-transparent text-muted-foreground border-border"
            }`}
            title="Toggle white background"
          >
            🏳️
          </button>
          <div className="w-32">
            <Select value={layer} onValueChange={setLayer}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="layer-1">Layer 1</SelectItem>
                <SelectItem value="layer-2">Layer 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Camera container – locked aspect ratio */}
      <div
        className="relative w-full overflow-hidden bg-black"
        style={{ aspectRatio: `${ASPECT_W} / ${ASPECT_H}`, maxWidth: "100vw" }}
      >
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        
        {/* White background toggle */}
        {examWhiteBg && <div className="absolute inset-0 bg-white" />}
        
        {/* Overlay image */}
        <img
          src={overlayUrl}
          alt={`${prefix} Q${questionNum} ${layer}`}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{
            opacity,
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 w-full max-w-md p-4">
        <div className="flex items-center gap-3">
          <Camera className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground w-14 shrink-0">Zoom</span>
          <Slider
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            min={0.3}
            max={0.9}
            step={0.05}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-10 text-right">{zoom.toFixed(2)}×</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-4 shrink-0 text-center text-muted-foreground text-sm">◐</span>
          <span className="text-xs text-muted-foreground w-14 shrink-0">Opacity</span>
          <Slider
            value={[opacity]}
            onValueChange={([v]) => setOpacity(v)}
            min={0}
            max={1}
            step={0.05}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(opacity * 100)}%</span>
        </div>
        <div className="p-4 bg-muted/30 text-center">
        <p className="text-[10px] font-mono text-muted-foreground">
          -- SOLO DEMO MODE -- <br /> Switch layers to see how it works.
        </p>
      </div>

        {/* Answer input */}
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Type your answer…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value.toUpperCase())}
            className="flex-1 uppercase"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <Button onClick={handleSubmit} className="font-pixel text-xs">
            SUBMIT
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PWExam;