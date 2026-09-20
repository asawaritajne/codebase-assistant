import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Layout } from "./components/layout/Layout";
import { AskPage } from "./pages/AskPage";
import { HomePage } from "./pages/HomePage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ReposPage } from "./pages/ReposPage";
import { ReposProvider } from "./repos/ReposContext";

export default function App() {
  return (
    <BrowserRouter>
      <ReposProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="repos" element={<ReposPage />} />
            <Route path="ask" element={<Navigate to="/ask/react-hook-form" replace />} />
            <Route path="ask/:repoId" element={<AskPage />} />
            <Route path="how-it-works" element={<HowItWorksPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ReposProvider>
    </BrowserRouter>
  );
}
