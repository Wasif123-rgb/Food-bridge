import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./NgoPage.css";

const API_URL = "http://127.0.0.1:8000/api";

type NgoProfile = {
  id: number;
  ngo_name: string;
  registration_no: string;
  email: string;
  phone: string;
  address: string | null;
  is_verified: boolean;
};

type Donor = {
  id: number;
  donor_name?: string;
  donor_type?: string;
  email?: string;
  phone?: string;
  address?: string | null;
};

type FoodDonation = {
  id: number;
  food_name: string;
  food_category: string;
  quantity: number | string;
  unit: string;
  prepared_at: string | null;
  expiry_at: string;
  availability_status: string;
  donation_status: string;
  remaining_qty: number | string;
  donor?: Donor;
};

type FoodRequest = {
  id: number;
  ngo_id: number;
  donation_id: number;
  requested_qty: number | string;
  requested_at: string;
  request_status: string;

  donation?: FoodDonation;
};

function NgoPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<NgoProfile | null>(null);

  const [donations, setDonations] = useState<FoodDonation[]>([]);

  const [requests, setRequests] = useState<FoodRequest[]>([]);

  const [quantities, setQuantities] = useState<
    Record<number, string>
  >({});

  const [loading, setLoading] = useState(true);

  const [requestingId, setRequestingId] =
    useState<number | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const getToken = () => {
    return localStorage.getItem("auth_token");
  };

  const logoutLocally = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    localStorage.removeItem("user_role");

    navigate("/login", {
      replace: true,
    });
  };

  const getErrorMessage = (data: unknown) => {
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data
    ) {
      const message = (data as { message?: unknown }).message;

      if (typeof message === "string") {
        return message;
      }
    }

    return "Something went wrong. Please try again.";
  };

  const authHeaders = () => {
    const token = getToken();

    return {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const loadProfile = async () => {
    const response = await fetch(
      `${API_URL}/ngo/profile`,
      {
        headers: authHeaders(),
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      logoutLocally();
      return;
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(data));
    }

    setProfile(data.data);
  };

  const loadDonations = async () => {
    const response = await fetch(
      `${API_URL}/ngo/available-donations`,
      {
        headers: authHeaders(),
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      logoutLocally();
      return;
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(data));
    }

    setDonations(data.data || []);
  };

  const loadRequests = async () => {
    const response = await fetch(
      `${API_URL}/ngo/requests`,
      {
        headers: authHeaders(),
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      logoutLocally();
      return;
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(data));
    }

    setRequests(data.data || []);
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      await loadProfile();

      await Promise.all([
        loadDonations(),
        loadRequests(),
      ]);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Unable to load the NGO dashboard."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getToken();

    if (!token) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    loadDashboard();
  }, []);

  const updateQuantity = (
    donationId: number,
    value: string
  ) => {
    setQuantities((current) => ({
      ...current,
      [donationId]: value,
    }));
  };

  const hasActiveRequest = (
    donationId: number
  ) => {
    return requests.some(
      (request) =>
        request.donation_id === donationId &&
        ["pending", "approved"].includes(
          request.request_status.toLowerCase()
        )
    );
  };

  const handleRequestFood = async (
    donation: FoodDonation
  ) => {
    const requestedQuantity =
      quantities[donation.id];

    if (
      !requestedQuantity ||
      Number(requestedQuantity) <= 0
    ) {
      setError(
        "Please enter a valid requested quantity."
      );

      setSuccess("");

      return;
    }

    const remainingQuantity = Number(
      donation.remaining_qty
    );

    if (
      Number(requestedQuantity) >
      remainingQuantity
    ) {
      setError(
        `You can request maximum ${remainingQuantity} ${donation.unit}.`
      );

      setSuccess("");

      return;
    }

    try {
      setRequestingId(donation.id);

      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/ngo/requests`,
        {
          method: "POST",

          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            donation_id: donation.id,
            requested_qty:
              Number(requestedQuantity),
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        logoutLocally();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data)
        );
      }

      setSuccess(
        `Request for ${donation.food_name} submitted successfully.`
      );

      setQuantities((current) => ({
        ...current,
        [donation.id]: "",
      }));

      await Promise.all([
        loadDonations(),
        loadRequests(),
      ]);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Unable to submit food request."
        );
      }
    } finally {
      setRequestingId(null);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);

      const token = getToken();

      if (token) {
        await fetch(`${API_URL}/logout`, {
          method: "POST",

          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } finally {
      logoutLocally();

      setLoggingOut(false);
    }
  };

  const formatDate = (
    value: string | null | undefined
  ) => {
    if (!value) {
      return "Not provided";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  };

  const pendingRequests = requests.filter(
    (request) =>
      request.request_status.toLowerCase() ===
      "pending"
  ).length;

  if (loading) {
    return (
      <div className="ngo-page">
        <div className="ngo-state">
          <div className="ngo-spinner" />

          <h2>Loading NGO Dashboard</h2>

          <p>
            Loading available food and your
            requests...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ngo-page">
      <header className="ngo-header">
        <div className="ngo-header-inner">
          <Link
            to="/"
            className="ngo-brand"
          >
            <span className="ngo-logo">
              🌿
            </span>

            <span>
              <strong>FoodBridge</strong>

              <small>
                Food · People · Impact
              </small>
            </span>
          </Link>

          <div className="ngo-header-actions">
            <Link to="/recipients" className="ngo-recipients-link">
              Recipients
            </Link>
            <button
              type="button"
              className="ngo-logout"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut
                ? "Logging out..."
                : "Log out"}
            </button>
          </div>
        </div>
      </header>

      <main className="ngo-main">
        <section className="ngo-hero">
          <p className="ngo-kicker">
            NGO FOOD SUPPORT CENTER
          </p>

          <h1>
            {profile
              ? `Welcome, ${profile.ngo_name}`
              : "NGO Dashboard"}
          </h1>

          <p>
            Find available food donations,
            request the quantity your
            organization needs, and track your
            food requests.
          </p>
        </section>

        {error && (
          <div className="ngo-error">
            {error}
          </div>
        )}

        {success && (
          <div className="ngo-success">
            {success}
          </div>
        )}

        {profile && (
          <section className="ngo-profile-summary">
            <div>
              <p className="ngo-kicker">
                ORGANIZATION
              </p>

              <h2>{profile.ngo_name}</h2>

              <p>
                Registration:{" "}
                {profile.registration_no}
              </p>

              <p>{profile.email}</p>

              {profile.address && (
                <p>{profile.address}</p>
              )}
            </div>

            <span
              className={
                profile.is_verified
                  ? "ngo-status ngo-status-verified"
                  : "ngo-status ngo-status-pending"
              }
            >
              {profile.is_verified
                ? "✓ Verified NGO"
                : "Pending verification"}
            </span>
          </section>
        )}

        <section className="ngo-stats">
          <div className="ngo-stat-card">
            <strong>
              {donations.length}
            </strong>

            <span>
              Available Donations
            </span>
          </div>

          <div className="ngo-stat-card">
            <strong>
              {requests.length}
            </strong>

            <span>
              Total Requests
            </span>
          </div>

          <div className="ngo-stat-card">
            <strong>
              {pendingRequests}
            </strong>

            <span>
              Pending Requests
            </span>
          </div>
        </section>

        <section className="ngo-dashboard-section">
          <div className="ngo-section-heading">
            <div>
              <p className="ngo-kicker">
                AVAILABLE FOOD
              </p>

              <h2>
                Available Food Donations
              </h2>
            </div>

            <button
              type="button"
              className="ngo-refresh-button"
              onClick={loadDashboard}
            >
              Refresh
            </button>
          </div>

          {donations.length === 0 ? (
            <div className="ngo-empty">
              <h3>
                No food donations available
              </h3>

              <p>
                New active food donations will
                appear here.
              </p>
            </div>
          ) : (
            <div className="ngo-donation-grid">
              {donations.map(
                (donation) => {
                  const activeRequest =
                    hasActiveRequest(
                      donation.id
                    );

                  return (
                    <article
                      className="ngo-donation-card"
                      key={donation.id}
                    >
                      <div className="ngo-donation-top">
                        <span className="ngo-food-category">
                          {
                            donation.food_category
                          }
                        </span>

                        <span className="ngo-available-badge">
                          Available
                        </span>
                      </div>

                      <h3>
                        {donation.food_name}
                      </h3>

                      <div className="ngo-donation-details">
                        <p>
                          <strong>
                            Available:
                          </strong>{" "}
                          {
                            donation.remaining_qty
                          }{" "}
                          {donation.unit}
                        </p>

                        <p>
                          <strong>
                            Original quantity:
                          </strong>{" "}
                          {donation.quantity}{" "}
                          {donation.unit}
                        </p>

                        <p>
                          <strong>
                            Expires:
                          </strong>{" "}
                          {formatDate(
                            donation.expiry_at
                          )}
                        </p>

                        {donation.donor
                          ?.donor_name && (
                          <p>
                            <strong>
                              Donor:
                            </strong>{" "}
                            {
                              donation.donor
                                .donor_name
                            }
                          </p>
                        )}
                      </div>

                      {activeRequest ? (
                        <div className="ngo-requested-note">
                          You already have an
                          active request for this
                          donation.
                        </div>
                      ) : (
                        <div className="ngo-request-box">
                          <label
                            htmlFor={`quantity-${donation.id}`}
                          >
                            Quantity needed (
                            {donation.unit})
                          </label>

                          <input
                            id={`quantity-${donation.id}`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={Number(
                              donation.remaining_qty
                            )}
                            value={
                              quantities[
                                donation.id
                              ] || ""
                            }
                            onChange={(
                              event
                            ) =>
                              updateQuantity(
                                donation.id,
                                event.target
                                  .value
                              )
                            }
                            placeholder="Enter quantity"
                          />

                          <button
                            type="button"
                            className="ngo-primary-button"
                            onClick={() =>
                              handleRequestFood(
                                donation
                              )
                            }
                            disabled={
                              requestingId ===
                              donation.id
                            }
                          >
                            {requestingId ===
                            donation.id
                              ? "Submitting..."
                              : "Request Food"}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        <section className="ngo-dashboard-section">
          <div className="ngo-section-heading">
            <div>
              <p className="ngo-kicker">
                REQUEST HISTORY
              </p>

              <h2>My Food Requests</h2>
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="ngo-empty">
              <h3>
                No requests submitted yet
              </h3>

              <p>
                Choose an available food
                donation above to submit your
                first request.
              </p>
            </div>
          ) : (
            <div className="ngo-request-list">
              {requests.map(
                (foodRequest) => (
                  <article
                    className="ngo-request-card"
                    key={foodRequest.id}
                  >
                    <div>
                      <h3>
                        {foodRequest.donation
                          ?.food_name ||
                          `Donation #${foodRequest.donation_id}`}
                      </h3>

                      <p>
                        Requested:{" "}
                        <strong>
                          {
                            foodRequest.requested_qty
                          }{" "}
                          {foodRequest
                            .donation?.unit ||
                            ""}
                        </strong>
                      </p>

                      <p>
                        Requested on:{" "}
                        {formatDate(
                          foodRequest.requested_at
                        )}
                      </p>

                      {foodRequest.donation
                        ?.donor
                        ?.donor_name && (
                        <p>
                          Donor:{" "}
                          {
                            foodRequest
                              .donation.donor
                              .donor_name
                          }
                        </p>
                      )}
                    </div>

                    <span
                      className={`ngo-request-status ngo-request-status-${foodRequest.request_status.toLowerCase()}`}
                    >
                      {
                        foodRequest.request_status
                      }
                    </span>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default NgoPage;
