import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Auth.css";

function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
  name,
  email,
  phone,
  role,
  password,
  password_confirmation: passwordConfirmation,
}),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          const firstError = Object.values(data.errors)
            .flat()
            .at(0);

          setError(String(firstError || "Registration failed."));
        } else {
          setError(data.message || "Registration failed.");
        }

        return;
      }

      // Save authentication token
      localStorage.setItem("auth_token", data.token);

      // Save user information
      localStorage.setItem("user", JSON.stringify(data.user));

      // Save selected role for frontend use
      localStorage.setItem("user_role", data.user.role);

      if (data.user.role === "volunteer") {
        navigate("/volunteer", { replace: true });
      } else if (data.user.role === "ngo") {
        navigate("/ngo", { replace: true });
      } else if (data.user.role === "recipient") {
        navigate("/recipient", { replace: true });
      } else {
        navigate("/donate", { replace: true });
      }
    } catch (error) {
      console.error("Signup error:", error);
      setError(
        "Cannot connect to backend. Make sure Laravel is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card signup-card">
        <div className="auth-brand">
          <div className="auth-logo">🌿</div>

          <div>
            <h1>FoodBridge</h1>
            <span>Food · People · Impact</span>
          </div>
        </div>

        <div className="auth-heading">
          <p>JOIN FOODBRIDGE</p>

          <h2>Create your account</h2>

          <span>
            Become part of a community working to reduce food waste.
          </span>
        </div>

        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label>Full name</label>

            <input
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
            <label>Phone number</label>

            <input
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>I want to join as</label>

            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="">Select a role</option>
              <option value="donor">Donor</option>
              <option value="ngo">NGO / Charity</option>
              <option value="volunteer">Volunteer</option>
              <option value="recipient">Recipient</option>
            </select>
          </div>

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm password</label>

            <input
              type="password"
              placeholder="Confirm your password"
              value={passwordConfirmation}
              onChange={(e) =>
                setPasswordConfirmation(e.target.value)
              }
              required
            />
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login">Log in</Link>
        </p>

        <Link to="/" className="back-home">
          ← Back to FoodBridge
        </Link>
      </div>

      <div className="auth-image signup-image">
        <div className="auth-overlay">
          <span>MAKE AN IMPACT</span>

          <h2>One connection can make a difference.</h2>

          <p>
            Join donors, charities and volunteers working together to
            give surplus food a second chance.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
