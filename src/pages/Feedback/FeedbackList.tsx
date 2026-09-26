import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./FeedbackList.css";

type Feedback = {
  id: number;
  feedback_id?: number;
  delivery_id: number;
  rating: number;
  comments?: string | null;
  submitted_by_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: Feedback[];
};

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

function FeedbackList() {
  const navigate = useNavigate();

  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("auth_token");

  const headers = (): HeadersInit => ({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  });

  const apiError = (data: any) => {
    if (data?.message) {
      return data.message;
    }

    if (data?.errors) {
      return Object.values(data.errors)
        .flat()
        .join(" ");
    }

    return "Unable to load feedback.";
  };

  const loadFeedback = async () => {
    setLoading(true);
    setError("");

    try {
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      const response = await fetch(`${API_URL}/feedback`, {
        headers: headers(),
      });

      const data: ApiResponse = await response.json();

      if (response.status === 401) {
        localStorage.clear();
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(apiError(data));
      }

      setFeedback(Array.isArray(data.data) ? data.data : []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load feedback."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const renderStars = (rating: number) => {
    return (
      <div
        className="feedback-list-stars"
        aria-label={`${rating} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`feedback-list-star ${
              star <= rating ? "feedback-list-star-active" : ""
            }`}
            aria-hidden="true"
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) {
      return "—";
    }

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleString();
  };

  const formatSubmitter = (
    submittedByType: string | null | undefined
  ) => {
    if (!submittedByType) {
      return "Unknown";
    }

    return (
      submittedByType.charAt(0).toUpperCase() +
      submittedByType.slice(1)
    );
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        headers: headers(),
      });
    } finally {
      localStorage.clear();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="feedback-list-page">
      <header className="feedback-list-header">
        <Link to="/" className="feedback-list-brand">
          FoodBridge
        </Link>

        <nav className="feedback-list-nav">
          <Link to="/ngo" className="feedback-list-nav-link">
            Dashboard
          </Link>

          <Link
            to="/recipients"
            className="feedback-list-nav-link"
          >
            Recipients
          </Link>

          <button
            type="button"
            onClick={logout}
            className="feedback-list-logout"
          >
            Log out
          </button>
        </nav>
      </header>

      <main className="feedback-list-main">
        <section className="feedback-list-intro">
          <p className="feedback-list-kicker">
            NGO FEEDBACK MANAGEMENT
          </p>

          <h1>Feedback</h1>

          <p>
            Review feedback submitted for deliveries managed by your
            NGO.
          </p>
        </section>

        {loading ? (
          <section className="feedback-list-state">
            <h2>Loading feedback...</h2>
            <p>Please wait while we retrieve the feedback records.</p>
          </section>
        ) : error ? (
          <section className="feedback-list-state feedback-list-state-error">
            <h2>Unable to load feedback</h2>
            <p>{error}</p>

            <button
              type="button"
              onClick={loadFeedback}
              className="feedback-list-retry"
            >
              Try again
            </button>
          </section>
        ) : feedback.length === 0 ? (
          <section className="feedback-list-state">
            <div className="feedback-list-empty-icon">
              ★
            </div>

            <h2>No feedback yet</h2>

            <p>
              Feedback submitted for completed deliveries will
              appear here.
            </p>

            <Link
              to="/recipients"
              className="feedback-list-back-button"
            >
              View recipients
            </Link>
          </section>
        ) : (
          <>
            <section className="feedback-list-summary">
              <div>
                <span>Total feedback</span>
                <strong>{feedback.length}</strong>
              </div>

              <div>
                <span>Average rating</span>
                <strong>
                  {(
                    feedback.reduce(
                      (total, item) => total + Number(item.rating || 0),
                      0
                    ) / feedback.length
                  ).toFixed(1)}
                  /5
                </strong>
              </div>
            </section>

            <section className="feedback-list-section">
              <div className="feedback-list-section-heading">
                <div>
                  <p className="feedback-list-kicker">
                    SUBMITTED RECORDS
                  </p>

                  <h2>Delivery Feedback</h2>
                </div>

                <span>
                  {feedback.length}{" "}
                  {feedback.length === 1 ? "record" : "records"}
                </span>
              </div>

              <div className="feedback-list-grid">
                {feedback.map((item) => (
                  <article
                    className="feedback-list-card"
                    key={item.id ?? item.feedback_id}
                  >
                    <div className="feedback-list-card-header">
                      <div>
                        <span>Delivery</span>

                        <h3>
                          #{item.delivery_id}
                        </h3>
                      </div>

                      <span className="feedback-list-submitter">
                        {formatSubmitter(
                          item.submitted_by_type
                        )}
                      </span>
                    </div>

                    <div className="feedback-list-rating">
                      <span className="feedback-list-label">
                        Rating
                      </span>

                      {renderStars(Number(item.rating || 0))}

                      <strong>
                        {item.rating}/5
                      </strong>
                    </div>

                    <div className="feedback-list-comment">
                      <span className="feedback-list-label">
                        Comment
                      </span>

                      {item.comments ? (
                        <p>{item.comments}</p>
                      ) : (
                        <p className="feedback-list-no-comment">
                          No comment provided.
                        </p>
                      )}
                    </div>

                    <div className="feedback-list-meta">
                      <div>
                        <span>Submitted by</span>
                        <strong>
                          {formatSubmitter(
                            item.submitted_by_type
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Submitted at</span>
                        <strong>
                          {formatDate(item.created_at)}
                        </strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default FeedbackList;