import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import Home from "./pages/Home";
import Results from "./pages/Results";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Welcome from "./pages/Welcome";
import Capabilities from "./pages/Capabilities";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <div className="dark min-h-screen bg-slate-950 text-white">
              <Navbar />
              <main className="pt-12">
                <Routes>
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/" element={<Home />} />
                  <Route path="/results" element={<Results />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/capabilities" element={<Capabilities />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;