import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./FeedbackPage.css";

type Delivery = {
  delivery_id: number;
  request_id: number;
  volunteer_name: string | null;
  food_name: string;
  food_category: string;
  quantity: string | number;
  unit: string;
  pickup_time: string | null;
  delivery_status: string;
  delivered_at: string | null;
  can_submit_feedback: boolean | number;
};

type Feedback = {
  id: number;
  delivery_id: number;
  rating: number;
  comments: string | null;
  submitted_at: string;
  submitted_by_type: string;
};

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
};

const API_URL = "http://127.0.0.1:8000/api";

const apiError = (
  data: {
    message?: string;
    errors?: Record<string, string[]>;
  },
) =>
  (data.errors && Object.values(data.errors).flat()[0]) ||
  data.message ||
  "Something went wrong.";

const displayStatus = (status: string) =>
  status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const displayDate = (value: string | null) => {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
};

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { deliveryId } = useParams<{ deliveryId: string }>();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [existingFeedback, setExistingFeedback] =
    useState<Feedback | null>(null);

  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const headers = (json = false) => ({
    ...(json ? { "Content-Type": "application/json" } : {}),
    Accept: "application/json",
    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
  });

  useEffect(() => {
    const loadFeedbackPage = async () => {
      if (!deliveryId) {
        setError("Delivery ID is missing.");
        setLoading(false);
        return;
      }

      try {
        /*
         * Load only the authenticated recipient's deliveries.
         */
        const deliveriesResponse = await fetch(
          `${API_URL}/recipient/deliveries`,
          {
            headers: headers(),
          },
        );

        if (deliveriesResponse.status === 401) {
          localStorage.clear();
          navigate("/login", { replace: true });
          return;
        }

        const deliveriesData: ApiResponse<Delivery[]> =
          await deliveriesResponse.json();

        if (!deliveriesResponse.ok) {
          throw new Error(apiError(deliveriesData));
        }

        const deliveryList = Array.isArray(deliveriesData.data)
          ? deliveriesData.data
          : [];

        const foundDelivery = deliveryList.find(
          (item) =>
            Number(item.delivery_id) === Number(deliveryId),
        );

        if (!foundDelivery) {
          throw new Error(
            "This delivery was not found in your recipient account.",
          );
        }

        setDelivery(foundDelivery);

        /*
         * Load existing feedback.
         *
         * The backend automatically limits this list to
         * feedback belonging to the authenticated recipient.
         */
        const feedbackResponse = await fetch(
          `${API_URL}/feedback`,
          {
            headers: headers(),
          },
        );

        if (feedbackResponse.ok) {
          const feedbackData: ApiResponse<Feedback[]> =
            await feedbackResponse.json();

          const feedbackList = Array.isArray(feedbackData.data)
            ? feedbackData.data
            : [];

          const foundFeedback = feedbackList.find(
            (item) =>
              Number(item.delivery_id) === Number(deliveryId),
          );

          if (foundFeedback) {
            setExistingFeedback(foundFeedback);
          }
        }
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load feedback.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadFeedbackPage();
  }, [deliveryId, navigate]);

  const submitFeedback = async (event: FormEvent) => {
    event.preventDefault();

    if (!delivery) return;

    if (existingFeedback) {
      setError(
        "Feedback has already been submitted for this delivery.",
      );
      return;
    }

    if (delivery.delivery_status !== "delivered") {
      setError(
        "Feedback can only be submitted after the delivery is completed.",
      );
      return;
    }

    if (rating < 1 || rating > 5) {
      setError("Please select a rating from 1 to 5.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({
          delivery_id: delivery.delivery_id,
          rating,
          comments: comments.trim() || null,
        }),
      });

      const data: ApiResponse<Feedback> =
        await response.json();

      if (!response.ok) {
        throw new Error(apiError(data));
      }

      if (data.data) {
        setExistingFeedback(data.data);
      }

      setSuccess(
        "Thank you! Your feedback has been submitted successfully.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to submit feedback.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="feedback-page">
        <header className="feedback-header">
          <Link to="/recipient" className="feedback-brand">
            FoodBridge
          </Link>
        </header>

        <main className="feedback-main">
          <div className="feedback-state">
            <h2>Loading feedback...</h2>
            <p>
              We are checking your delivery information.
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
          <Link to="/recipient" className="feedback-brand">
            FoodBridge
          </Link>
        </header>

        <main className="feedback-main">
          <div className="feedback-state feedback-state-error">
            <h2>Unable to open feedback</h2>

            <p>{error}</p>

            <Link
              to="/recipient"
              className="feedback-back-button"
            >
              Back to recipient page
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!delivery) return null;

  const isEligible =
    delivery.delivery_status === "delivered";

  return (
    <div className="feedback-page">
      <header className="feedback-header">
        <Link to="/recipient" className="feedback-brand">
          FoodBridge
        </Link>

        <Link
          to="/recipient"
          className="feedback-back-link"
        >
          Back to Recipient
        </Link>
      </header>

      <main className="feedback-main">
        <section className="feedback-intro">
          <p className="feedback-kicker">
            DELIVERY FEEDBACK
          </p>

          <h1>How was your delivery?</h1>

          <p>
            Your feedback helps FoodBridge understand the
            delivery experience and improve future food
            deliveries.
          </p>
        </section>

        <section className="feedback-card">
          <div className="feedback-delivery-header">
            <div>
              <span>DELIVERY</span>
              <h2>#{delivery.delivery_id}</h2>
            </div>

            <span className="feedback-status">
              {displayStatus(delivery.delivery_status)}
            </span>
          </div>

          <div className="feedback-delivery-details">
            <div>
              <span>Food</span>
              <strong>{delivery.food_name}</strong>
            </div>

            <div>
              <span>Category</span>
              <strong>{delivery.food_category}</strong>
            </div>

            <div>
              <span>Quantity</span>
              <strong>
                {delivery.quantity} {delivery.unit}
              </strong>
            </div>

            <div>
              <span>Volunteer</span>
              <strong>
                {delivery.volunteer_name || "Not available"}
              </strong>
            </div>

            <div>
              <span>Delivered At</span>
              <strong>
                {displayDate(delivery.delivered_at)}
              </strong>
            </div>

            <div>
              <span>Request</span>
              <strong>#{delivery.request_id}</strong>
            </div>
          </div>
        </section>

        {!isEligible ? (
          <section className="feedback-card feedback-not-eligible">
            <div className="feedback-not-eligible-icon">
              !
            </div>

            <h2>Feedback is not available yet</h2>

            <p>
              You can submit feedback after this delivery
              has been completed.
            </p>

            <Link
              to="/recipient"
              className="feedback-primary-button"
            >
              Back to deliveries
            </Link>
          </section>
        ) : existingFeedback ? (
          <section className="feedback-card feedback-form-card">
            <div className="feedback-section-heading">
              <p className="feedback-kicker">
                YOUR EXPERIENCE
              </p>

              <h2>Your submitted feedback</h2>

              <p>
                You have already submitted feedback for this
                delivery.
              </p>
            </div>

            <div className="feedback-submitted">
              <div className="feedback-rating-section">
                <label>Your Rating</label>

                <div
                  className="feedback-stars"
                  aria-label={`Your rating: ${existingFeedback.rating} out of 5`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`feedback-star ${
                        existingFeedback.rating >= star
                          ? "feedback-star-active"
                          : ""
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>

                <p className="feedback-rating-text">
                  {existingFeedback.rating} out of 5
                </p>
              </div>

              <div className="feedback-comment-section">
                <label>Your Comments</label>

                <div className="feedback-existing-comment">
                  {existingFeedback.comments ||
                    "No comments were provided."}
                </div>
              </div>

              <p className="feedback-success">
                Your feedback has already been submitted.
                Thank you!
              </p>

              <div className="feedback-actions">
                <Link
                  to="/recipient"
                  className="feedback-primary-button"
                >
                  Back to Deliveries
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="feedback-card feedback-form-card">
            <div className="feedback-section-heading">
              <p className="feedback-kicker">
                YOUR EXPERIENCE
              </p>

              <h2>Share your experience</h2>

              <p>
                Please rate the delivery and optionally leave
                a comment.
              </p>
            </div>

            <form onSubmit={submitFeedback}>
              <div className="feedback-rating-section">
                <label>Rating</label>

                <p className="feedback-helper">
                  Select a rating from 1 to 5 stars.
                </p>

                <div
                  className="feedback-stars"
                  role="radiogroup"
                  aria-label="Delivery rating"
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`feedback-star ${
                        rating >= star
                          ? "feedback-star-active"
                          : ""
                      }`}
                      onClick={() => setRating(star)}
                      aria-label={`${star} star${
                        star > 1 ? "s" : ""
                      }`}
                      aria-pressed={rating === star}
                    >
                      ★
                    </button>
                  ))}
                </div>

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
                  placeholder="Tell us about your delivery experience..."
                  rows={6}
                />
              </div>

              <div className="feedback-actions">
                <Link
                  to="/recipient"
                  className="feedback-secondary-button"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  className="feedback-primary-button"
                  disabled={submitting}
                >
                  {submitting
                    ? "Submitting..."
                    : "Submit Feedback"}
                </button>
              </div>

              <div
                className="feedback-message"
                aria-live="polite"
              >
                {success && (
                  <p className="feedback-success">
                    {success}
                  </p>
                )}

                {error && (
                  <p className="feedback-error">
                    {error}
                  </p>
                )}
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}