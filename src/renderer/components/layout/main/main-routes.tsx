import { Routes, Route } from "react-router-dom";
import Home from "@/routes/Home";
import Chat from "@/routes/Chat";
import Doc from "@/routes/Doc";
import Settings from "@/routes/Settings";

export function MainRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/chat/:id" element={<Chat />} />
      <Route path="/doc" element={<Doc />} />
      <Route path="/doc/:id" element={<Doc />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
