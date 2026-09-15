import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ coordinator = false }: { coordinator?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="app__not-found" role="status">Проверяем сессию…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (coordinator && user.role !== "COORDINATOR") return <Navigate to="/procedures" replace />;
  return <Outlet />;
}
