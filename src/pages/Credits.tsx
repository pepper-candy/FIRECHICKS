import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { assetUrl } from "@/lib/assets";
import { getFromCache } from "@/lib/assetCache";

export default function CreditsPage() {
  const navigate = useNavigate();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const url = assetUrl('/Animations/Credit.mp4');
    getFromCache(url).then(async (cached) => {
      if (cached) {
        const blob = await cached.blob();
        setSrc(URL.createObjectURL(blob));
      } else {
        setSrc(url);
      }
    });
  }, []);

  if (!src) return null;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <video
        src={src}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
        controls={false}
        onEnded={() => navigate("/")}
      />
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 right-4 px-3 py-1.5 rounded bg-white/10 border border-white/20 text-white/70 text-xs font-mono hover:bg-white/20 transition-all"
      >
        ✕ SKIP
      </button>
    </div>
  );
}