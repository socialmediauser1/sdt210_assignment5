import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Board from "./pages/Board";
import Archive from "./pages/Archive";
import Stats from "./pages/Stats";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Board />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/stats" element={<Stats />} />
      </Route>
    </Routes>
  );
}

export default App;