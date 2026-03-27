import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AssetLoadingProvider } from "@/context/AssetLoadingContext";
import { ImmersiveProvider } from "@/context/ImmersiveContext";
import PWExam from "./pages/PWExam";
import GameIndex from "./pages/GameIndex";
import Host from "./pages/Host";
import Client from "./pages/Client";
import NotFound from "./pages/NotFound";
import Character from "./pages/Character";
import ExamTips from "./pages/ExamTips";
// Preview pages
import PreviewClientReveal from "./pages/preview/ClientReveal";
import PreviewHostReveal from "./pages/preview/HostReveal";
import PreviewClientGameover from "./pages/preview/ClientGameover";
import PreviewHostGameover from "./pages/preview/HostGameover";
import PreviewClientDead from "./pages/preview/ClientDead";
import PreviewClientCountdown from "./pages/preview/ClientCountdown";
import PreviewHostCountdown from "./pages/preview/HostCountdown";
// New preview pages
import PreviewVideoHurt from "./pages/preview/VideoHurt";
import PreviewVideoDead from "./pages/preview/VideoDead";
import PreviewMockExamHost from "./pages/preview/MockExamHost";
import PreviewMockExamClient from "./pages/preview/MockExamClient";
import PreviewHitboxHost from "./pages/preview/HitboxHost";
import PreviewHitboxClient from "./pages/preview/HitboxClient";
import PreviewCrossyRoadHost from "./pages/preview/CrossyRoadHost";
import PreviewCrossyRoadClient from "./pages/preview/CrossyRoadClient";
import PreviewFinalExamHost from "./pages/preview/FinalExamHost";
import PreviewFinalExamClient from "./pages/preview/FinalExamClient";
import PreviewChickStage1 from "./pages/preview/ChickStage1";
import PreviewChickStage23 from "./pages/preview/ChickStage23";
import PreviewEagleControl from "./pages/preview/EagleControl";
import PreviewStageTransition from "./pages/preview/StageTransitionPreview";
import CrossyRoadLab from "./pages/CrossyRoadLab";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ImmersiveProvider>
    <AssetLoadingProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<GameIndex />} />
          <Route path="/pw-exam" element={<PWExam />} />
          <Route path="/pw" element={<PWExam />} />
          <Route path="/host" element={<Host />} />
          <Route path="/client" element={<Client />} />
          <Route path="/character" element={<Character />} />
          <Route path="/exam-tips" element={<ExamTips />} />
          {/* Preview routes for individual phases */}
          <Route path="/client-reveal" element={<PreviewClientReveal />} />
          <Route path="/host-reveal" element={<PreviewHostReveal />} />
          <Route path="/client-gameover" element={<PreviewClientGameover />} />
          <Route path="/host-gameover" element={<PreviewHostGameover />} />
          <Route path="/client-dead" element={<PreviewClientDead />} />
          <Route path="/client-countdown" element={<PreviewClientCountdown />} />
          <Route path="/host-countdown" element={<PreviewHostCountdown />} />
          {/* New preview routes */}
          <Route path="/preview/video-hurt" element={<PreviewVideoHurt />} />
          <Route path="/preview/video-dead" element={<PreviewVideoDead />} />
          <Route path="/preview/mock-exam-host" element={<PreviewMockExamHost />} />
          <Route path="/preview/mock-exam-client" element={<PreviewMockExamClient />} />
          <Route path="/preview/hitbox-host" element={<PreviewHitboxHost />} />
          <Route path="/preview/hitbox-client" element={<PreviewHitboxClient />} />
          <Route path="/preview/crossy-road-host" element={<PreviewCrossyRoadHost />} />
          <Route path="/preview/crossy-road-client" element={<PreviewCrossyRoadClient />} />
          <Route path="/preview/final-exam-host" element={<PreviewFinalExamHost />} />
          <Route path="/preview/final-exam-client" element={<PreviewFinalExamClient />} />
          <Route path="/preview/chick-stage1" element={<PreviewChickStage1 />} />
          <Route path="/preview/chick-stage23" element={<PreviewChickStage23 />} />
          <Route path="/preview/eagle-control" element={<PreviewEagleControl />} />
          <Route path="/preview/stage-transition" element={<PreviewStageTransition />} />
          <Route path="/test-crossy-road" element={<CrossyRoadLab />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AssetLoadingProvider>
  </QueryClientProvider>
);

export default App;
