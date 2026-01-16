import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Webhooks from "./pages/Webhooks";
import Docs from "./pages/Docs";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}



function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/transactions"
        element={
          <ProtectedRoute>
            <Transactions />
          </ProtectedRoute>
        }
      />
      {/* Serve dashboard webhooks at canonical path (public) */}
      <Route path="/dashboard/webhooks" element={<Webhooks />} />
      <Route
        path="/dashboard/docs"
        element={
          <ProtectedRoute>
            <Docs />
          </ProtectedRoute>
        }
      />

      {/* Redirect legacy /docs to canonical /dashboard/docs */}
      <Route path="/docs" element={<Navigate to="/dashboard/docs" replace />} />
      {/* Redirect legacy /webhooks to canonical /dashboard/webhooks */}
      <Route path="/webhooks" element={<Navigate to="/dashboard/webhooks" replace />} />

      <Route 
        path="*" 
        element={
          isLoading ? (
            <div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>
          ) : (
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          )
        } 
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
