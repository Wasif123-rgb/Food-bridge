import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home/Home";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/Signup";
import DonationPage from "./pages/Donation/DonationPage";
import VolunteerPage from "./pages/Volunteer/VolunteerPage";
import ProtectedRoute from "./pages/Auth/ProtectedRoute";
import NgoPage from "./pages/NGO/NgoPage";
import Admin from "./pages/Admin/Admin";
import RecipientPage from "./pages/Recipient/RecipientPage";
import FeedbackPage from "./pages/Feedback/FeedbackPage";
import FeedbackList from "./pages/Feedback/FeedbackList";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* =========================================================
            PUBLIC PAGES
        ========================================================= */}

        <Route path="/" element={<Home />} />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<Signup />}
        />

        {/* =========================================================
            DONOR
        ========================================================= */}

        <Route
          path="/donate"
          element={
            <ProtectedRoute>
              <DonationPage />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            VOLUNTEER
        ========================================================= */}

        <Route
          path="/volunteer"
          element={
            <ProtectedRoute requiredRole="volunteer">
              <VolunteerPage />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            NGO DASHBOARD
        ========================================================= */}

        <Route
          path="/ngo"
          element={
            <ProtectedRoute requiredRole="ngo">
              <NgoPage />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            NGO RECIPIENTS
        ========================================================= */}

        <Route
          path="/recipients"
          element={
            <ProtectedRoute requiredRole="ngo">
              <RecipientPage />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            INDIVIDUAL RECIPIENT
        ========================================================= */}

        <Route
          path="/recipient"
          element={
            <ProtectedRoute requiredRole="recipient">
              <RecipientPage />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            FEEDBACK
        ========================================================= */}

        <Route
          path="/feedback/:deliveryId"
          element={
            <ProtectedRoute requiredRole={["ngo", "recipient"]}>
              <FeedbackPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feedback"
          element={
            <ProtectedRoute requiredRole={["ngo", "recipient"]}>
              <FeedbackList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feedback/view/:deliveryId"
          element={
            <ProtectedRoute requiredRole={["ngo", "recipient"]}>
              <FeedbackList />
            </ProtectedRoute>
          }
        />

        {/* =========================================================
            ADMIN
        ========================================================= */}

        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <Admin />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;