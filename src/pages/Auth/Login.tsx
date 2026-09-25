import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Auth.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Invalid email or password.");
        return;
      }

      // Save authentication token
      localStorage.setItem("auth_token", data.token);

      // Save user information
      localStorage.setItem("user", JSON.stringify(data.user));

      localStorage.setItem("user_role", data.user.role);

      // Go to the dashboard for the authenticated role
      if (data.user.role === "admin") {
  navigate("/admin");
} else if (data.user.role === "volunteer") {
  navigate("/volunteer");
} else if (data.user.role === "ngo") {
  navigate("/ngo");
} else if (data.user.role === "recipient") {
  navigate("/recipient");
} else {
  navigate("/donate");
}
    } catch (error) {
      console.error("Login error:", error);
      setError("Cannot connect to backend. Make sure Laravel is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">🌿</div>

          <div>
            <h1>FoodBridge</h1>
            <span>Food · People · Impact</span>
          </div>
        </div>

        <div className="auth-heading">
          <p>WELCOME BACK</p>

          <h2>Log in to FoodBridge</h2>

          <span>
            Continue your journey of turning surplus food into support.
          </span>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email address</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-options">
            <label className="remember">
              <input type="checkbox" />
              Remember me
            </label>

            <a href="#">Forgot password?</a>
          </div>

          {error && (
            <div
              style={{
                color: "#dc2626",
                marginBottom: "15px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <p className="auth-switch">
          Don't have an account?{" "}
          <Link to="/signup">Create an account</Link>
        </p>

        <Link to="/" className="back-home">
          ← Back to FoodBridge
        </Link>
      </div>

      <div className="auth-image">
        <div className="auth-overlay">
          <span>FOOD · PEOPLE · IMPACT</span>

          <h2>Good food deserves a second chance.</h2>

          <p>
            Together, we can connect surplus food with people and communities
            who need it.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
