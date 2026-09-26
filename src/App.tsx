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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Donor page */}
        <Route
          path="/donate"
          element={
            <ProtectedRoute>
              <DonationPage />
            </ProtectedRoute>
          }
        />

        {/* Volunteer page */}
        <Route
          path="/volunteer"
          element={
            <ProtectedRoute requiredRole="volunteer">
              <VolunteerPage />
            </ProtectedRoute>
          }
        />

        {/* NGO Dashboard */}
        <Route
          path="/ngo"
          element={
            <ProtectedRoute requiredRole="ngo">
              <NgoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recipients"
          element={
            <ProtectedRoute requiredRole="ngo">
              <RecipientPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recipient"
          element={
            <ProtectedRoute requiredRole="recipient">
              <RecipientPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feedback/:deliveryId"
          element={
            <ProtectedRoute requiredRole="recipient">
              <FeedbackPage />
            </ProtectedRoute>
          }
        />
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
