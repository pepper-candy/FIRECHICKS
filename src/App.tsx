import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
