import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import TraceList from "./pages/TraceList";
import TraceDetail from "./pages/TraceDetail";
import Analytics from "./pages/Analytics";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TraceList />} />
        <Route path="traces/:id" element={<TraceDetail />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
    </Routes>
  );
}
