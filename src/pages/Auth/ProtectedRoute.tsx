import React from "react";
import { Navigate } from "react-router-dom";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredRole?: string | string[];
};

function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const token = localStorage.getItem("auth_token");

  // User is not logged in
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // No role restriction
  if (!requiredRole) {
    return <>{children}</>;
  }

  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return <Navigate to="/login" replace />;
    }

    const user = JSON.parse(storedUser);

    const userRole = String(user?.role || "")
      .trim()
      .toLowerCase();

    const allowedRoles = Array.isArray(requiredRole)
      ? requiredRole.map((role) => role.trim().toLowerCase())
      : [requiredRole.trim().toLowerCase()];

    console.log("ProtectedRoute ROLE CHECK:", {
      userRole,
      allowedRoles,
      path: window.location.pathname,
    });

    if (!allowedRoles.includes(userRole)) {
      console.log("ProtectedRoute: ROLE MISMATCH → /");

      return <Navigate to="/" replace />;
    }

    return <>{children}</>;
  } catch (error) {
    console.error("Unable to read logged-in user:", error);

    return <Navigate to="/login" replace />;
  }
}

export default ProtectedRoute;