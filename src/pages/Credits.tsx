import { useNavigate } from "react-router-dom";
import { assetUrl } from "@/lib/assets";

export default function CreditsPage() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <video
        src={assetUrl('/Animations/Credit.mp4')}
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