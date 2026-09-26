import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./FeedbackPage.css";

type Delivery = {
  delivery_id?: number;
  id?: number;
  delivery_status?: string;
  status?: string;
  recipient_name?: string;
  recipient_email?: string;
  recipient_phone?: string;
  food_name?: string;
  quantity?: number | string;
  delivery_date?: string;
  delivered_at?: string;
  scheduled_date?: string;
  address?: string;
  ngo_name?: string;
  [key: string]: unknown;
};

type Feedback = {
  id: number;
  delivery_id: number;
  rating: number;
  comments?: string | null;
  submitted_by_type?: string;
  created_at?: string;
};

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

function FeedbackPage() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const navigate = useNavigate();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [existingFeedback, setExistingFeedback] =
    useState<Feedback | null>(null);

  const [rating, setRating] = useState<number>(0);
  const [comments, setComments] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [userRole, setUserRole] = useState<string>("");

  const token = localStorage.getItem("auth_token");

  const backPath =
    userRole === "ngo"
      ? "/recipients"
      : "/recipient";

  const backLabel =
    userRole === "ngo"
      ? "Back to Recipients"
      : "Back to My Deliveries";

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);

        setUserRole(
          String(user?.role || "")
            .trim()
            .toLowerCase()
        );
      } catch {
        setUserRole("");
      }
    }
  }, []);

  useEffect(() => {
    if (!deliveryId) {
      setError("Delivery ID is missing.");
      setLoading(false);
      return;
    }

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    loadFeedbackData();
  }, [deliveryId, token]);

  const handleUnauthorized = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const getHeaders = (): HeadersInit => ({
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  });

  const loadFeedbackData = async () => {
    setLoading(true);
    setError("");

    try {
      const deliveryResponse = await fetch(
        `${API_BASE_URL}/feedback/delivery/${deliveryId}`,
        {
          method: "GET",
          headers: getHeaders(),
        }
      );

      if (deliveryResponse.status === 401) {
        handleUnauthorized();
        return;
      }

      const deliveryJson: ApiResponse<Delivery> =
        await deliveryResponse.json();

      if (!deliveryResponse.ok) {
        throw new Error(
          deliveryJson.message || "Unable to load delivery details."
        );
      }

      if (!deliveryJson.data) {
        throw new Error("Delivery details were not found.");
      }

      setDelivery(deliveryJson.data);

      const feedbackResponse = await fetch(
        `${API_BASE_URL}/feedback`,
        {
          method: "GET",
          headers: getHeaders(),
        }
      );

      if (feedbackResponse.status === 401) {
        handleUnauthorized();
        return;
      }

      const feedbackJson: ApiResponse<Feedback[]> =
        await feedbackResponse.json();

      if (!feedbackResponse.ok) {
        throw new Error(
          feedbackJson.message || "Unable to load feedback information."
        );
      }

      const feedbackList = Array.isArray(feedbackJson.data)
        ? feedbackJson.data
        : [];

      const currentFeedback = feedbackList.find(
        (feedback) =>
          Number(feedback.delivery_id) === Number(deliveryId)
      );

      if (currentFeedback) {
        setExistingFeedback(currentFeedback);
        setRating(Number(currentFeedback.rating) || 0);
        setComments(currentFeedback.comments || "");
      } else {
        setExistingFeedback(null);
        setRating(0);
        setComments("");
      }
    } catch (err) {
      console.error("Feedback page error:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong while loading the feedback page.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getDeliveryStatus = (): string => {
    return String(
      delivery?.delivery_status ||
        delivery?.status ||
        ""
    )
      .trim()
      .toLowerCase();
  };

  const isDelivered = getDeliveryStatus() === "delivered";

  const getDeliveryId = (): number => {
    return Number(delivery?.delivery_id || delivery?.id || deliveryId);
  };

  const getDisplayValue = (
    value: unknown,
    fallback = "Not available"
  ): string => {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }

    return String(value);
  };

  const formatDate = (value: unknown): string => {
    if (!value) {
      return "Not available";
    }

    const date = new Date(String(value));

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!deliveryId) {
      setError("Delivery ID is missing.");
      return;
    }

    if (!isDelivered) {
      setError(
        "Feedback can only be submitted after the delivery is completed."
      );
      return;
    }

    if (existingFeedback) {
      setError("Feedback has already been submitted for this delivery.");
      return;
    }

    if (rating < 1 || rating > 5) {
      setError("Please select a rating from 1 to 5 stars.");
      return;
    }

    if (!token) {
      handleUnauthorized();
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          delivery_id: getDeliveryId(),
          rating,
          comments: comments.trim() || null,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const json: ApiResponse<Feedback> =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.message || "Unable to submit feedback."
        );
      }

      setSuccess(
        json.message || "Feedback submitted successfully."
      );

      if (json.data) {
        setExistingFeedback(json.data);
      } else {
        setExistingFeedback({
          id: 0,
          delivery_id: getDeliveryId(),
          rating,
          comments: comments.trim() || null,
          submitted_by_type: userRole,
        });
      }
    } catch (err) {
      console.error("Submit feedback error:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong while submitting feedback.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (
    selectedRating: number,
    interactive: boolean
  ) => {
    return (
      <div className="feedback-stars">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= selectedRating;

          if (!interactive) {
            return (
              <span
                key={star}
                className={`feedback-star ${
                  active ? "feedback-star-active" : ""
                }`}
                aria-hidden="true"
              >
                ★
              </span>
            );
          }

          return (
            <button
              key={star}
              type="button"
              className={`feedback-star ${
                active ? "feedback-star-active" : ""
              }`}
              onClick={() => setRating(star)}
              aria-label={`Give ${star} out of 5 stars`}
              disabled={submitting}
            >
              ★
            </button>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="feedback-page">
        <header className="feedback-header">
          <Link to="/" className="feedback-brand">
            FoodBridge
          </Link>
        </header>

        <main className="feedback-main">
          <div className="feedback-state">
            <h2>Loading feedback...</h2>
            <p>
              Please wait while we load the delivery details.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !delivery) {
    return (
      <div className="feedback-page">
        <header className="feedback-header">
          <Link to="/" className="feedback-brand">
            FoodBridge
          </Link>

          <Link
            to={backPath}
            className="feedback-back-link"
          >
            {backLabel}
          </Link>
        </header>

        <main className="feedback-main">
          <div className="feedback-state feedback-state-error">
            <h2>Unable to load delivery</h2>
            <p>{error}</p>

            <Link
              to={backPath}
              className="feedback-back-button"
            >
              {backLabel}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="feedback-page">
        <header className="feedback-header">
          <Link to="/" className="feedback-brand">
            FoodBridge
          </Link>
        </header>

        <main className="feedback-main">
          <div className="feedback-state">
            <h2>Delivery not found</h2>
            <p>
              We could not find the delivery you are trying to
              review.
            </p>

            <Link
              to={backPath}
              className="feedback-back-button"
            >
              {backLabel}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <header className="feedback-header">
        <Link to="/" className="feedback-brand">
          FoodBridge
        </Link>

        <Link
          to={backPath}
          className="feedback-back-link"
        >
          {backLabel}
        </Link>
      </header>

      <main className="feedback-main">
        <section className="feedback-intro">
          <p className="feedback-kicker">DELIVERY FEEDBACK</p>

          <h1>Share your experience</h1>

          <p>
            Your feedback helps FoodBridge understand how each
            delivery went and improve the experience for everyone
            involved.
          </p>
        </section>

        <div className="feedback-grid">
          <section className="feedback-card">
            <div className="feedback-delivery-header">
              <div>
                <span>DELIVERY</span>

                <h2>
                  #{getDisplayValue(
                    delivery.delivery_id || delivery.id,
                    deliveryId || "N/A"
                  )}
                </h2>
              </div>

              <span className="feedback-status">
                {getDisplayValue(
                  delivery.delivery_status || delivery.status,
                  "Unknown"
                )}
              </span>
            </div>

            <div className="feedback-delivery-details">
              <div>
                <span>Recipient</span>
                <strong>
                  {getDisplayValue(
                    delivery.recipient_name
                  )}
                </strong>
              </div>

              <div>
                <span>Food</span>
                <strong>
                  {getDisplayValue(delivery.food_name)}
                </strong>
              </div>

              <div>
                <span>Quantity</span>
                <strong>
                  {getDisplayValue(delivery.quantity)}
                </strong>
              </div>

              <div>
                <span>Delivery Date</span>
                <strong>
                  {formatDate(
                    delivery.delivery_date ||
                      delivery.delivered_at ||
                      delivery.scheduled_date
                  )}
                </strong>
              </div>

              {delivery.ngo_name && (
                <div>
                  <span>NGO</span>
                  <strong>
                    {getDisplayValue(delivery.ngo_name)}
                  </strong>
                </div>
              )}

              {delivery.address && (
                <div>
                  <span>Address</span>
                  <strong>
                    {getDisplayValue(delivery.address)}
                  </strong>
                </div>
              )}
            </div>
          </section>

          {existingFeedback ? (
            <section className="feedback-card feedback-form-card">
              <div className="feedback-section-heading">
                <h2>Feedback submitted</h2>

                <p>
                  Thank you for sharing your experience with this
                  delivery.
                </p>
              </div>

              <div className="feedback-rating-section">
                <label>Your rating</label>

                {renderStars(
                  Number(existingFeedback.rating),
                  false
                )}

                <p className="feedback-rating-text">
                  {existingFeedback.rating} out of 5
                </p>
              </div>

              <div className="feedback-comment-section">
                <label>Your comments</label>

                <div className="feedback-existing-comment">
                  {existingFeedback.comments
                    ? existingFeedback.comments
                    : "No comments were provided."}
                </div>
              </div>

              <div className="feedback-message">
                {success && (
                  <p className="feedback-success">
                    {success}
                  </p>
                )}
              </div>

              <div className="feedback-actions">
                <Link
                  to={backPath}
                  className="feedback-secondary-button"
                >
                  {backLabel}
                </Link>
              </div>
            </section>
          ) : !isDelivered ? (
            <section className="feedback-card feedback-form-card">
              <div className="feedback-not-eligible">
                <div className="feedback-not-eligible-icon">
                  !
                </div>

                <h2>Feedback is not available yet</h2>

                <p>
                  You can submit feedback after this delivery has
                  been marked as delivered.
                </p>

                <Link
                  to={backPath}
                  className="feedback-back-button"
                >
                  {backLabel}
                </Link>
              </div>
            </section>
          ) : (
            <section className="feedback-card feedback-form-card">
              <div className="feedback-section-heading">
                <h2>How did it go?</h2>

                <p>
                  Tell us about your experience with this
                  delivery.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="feedback-rating-section">
                  <label htmlFor="feedback-rating">
                    Rating
                  </label>

                  <p className="feedback-helper">
                    Select a rating from 1 to 5 stars.
                  </p>

                  {renderStars(rating, true)}

                  <p className="feedback-rating-text">
                    {rating === 0
                      ? "No rating selected"
                      : `${rating} out of 5`}
                  </p>
                </div>

                <div className="feedback-comment-section">
                  <label htmlFor="feedback-comments">
                    Comments
                  </label>

                  <textarea
                    id="feedback-comments"
                    value={comments}
                    onChange={(event) =>
                      setComments(event.target.value)
                    }
                    placeholder="Tell us anything you would like us to know about this delivery..."
                    maxLength={5000}
                    disabled={submitting}
                  />
                </div>

                <div className="feedback-actions">
                  <Link
                    to={backPath}
                    className="feedback-secondary-button"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    className="feedback-primary-button"
                    disabled={submitting || rating === 0}
                  >
                    {submitting
                      ? "Submitting..."
                      : "Submit Feedback"}
                  </button>
                </div>

                {(error || success) && (
                  <div className="feedback-message">
                    {error && (
                      <p className="feedback-error">
                        {error}
                      </p>
                    )}

                    {success && (
                      <p className="feedback-success">
                        {success}
                      </p>
                    )}
                  </div>
                )}
              </form>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default FeedbackPage;