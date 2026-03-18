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
import Battlefield from "./pages/Battlefield";
import Character from "./pages/Character";
import ExamTips from "./pages/ExamTips";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GameIndex />} />
          <Route path="/pw" element={<PWExam />} />
          <Route path="/host" element={<Host />} />
          <Route path="/client" element={<Client />} />
          <Route path="/battlefield" element={<Battlefield />} />
          <Route path="/character" element={<Character />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
