import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./VolunteerPage.css";

type VolunteerProfile = {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  availability_status: "Available" | "Busy" | "Offline";
  vehicle_type: "None" | "Bicycle" | "Motorcycle" | "Car" | "Van";
};

type Delivery = {
  delivery_id: number;
  request_id: number;
  volunteer_id: number;
  ngo_id: number;
  ngo_name: string;
  ngo_email: string;
  ngo_phone: string;
  ngo_address: string | null;
  food_name: string;
  food_category: string;
  quantity: string | number;
  unit: string;
  pickup_contact: string;
  pickup_phone: string;
  pickup_address: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  destination_address: string | null;
  household_size: number | null;
  pickup_time: string | null;
  delivered_at: string | null;
  delivery_status: "pending" | "picked_up" | "in_transit" | "delivered";
  request_status: string;
};

const API_URL = "http://127.0.0.1:8000/api";

const isCompleteProfile = (value: unknown): value is VolunteerProfile => {
  if (!value || typeof value !== "object") return false;

  const profile = value as Partial<VolunteerProfile>;
  return typeof profile.id === "number"
    && typeof profile.full_name === "string"
    && typeof profile.email === "string"
    && typeof profile.phone === "string"
    && typeof profile.availability_status === "string"
    && typeof profile.vehicle_type === "string";
};

const formatDate = (value: string | null) => {
  if (!value) return "Not scheduled";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

const firstApiError = (data: { message?: string; errors?: Record<string, string[]> }) => {
  const validationError = data.errors
    ? Object.values(data.errors).flat().at(0)
    : null;

  return validationError || data.message || "Something went wrong. Please try again.";
};

const nextDeliveryStatus = (status: Delivery["delivery_status"]) => {
  if (status === "pending") return { value: "picked_up", label: "Mark as picked up" };
  if (status === "picked_up") return { value: "in_transit", label: "Start delivery" };
  if (status === "in_transit") return { value: "delivered", label: "Mark as delivered" };
  return null;
};

const humanizeStatus = (status: string) =>
  status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function VolunteerPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState<number | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      const token = localStorage.getItem("auth_token");
      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };

      try {
        const [profileResponse, deliveriesResponse, volunteersResponse] = await Promise.all([
          fetch(`${API_URL}/volunteer/profile`, { headers }),
          fetch(`${API_URL}/volunteer/deliveries`, { headers }),
          fetch(`${API_URL}/volunteers`, { headers }),
        ]);

        if (profileResponse.status === 401 || deliveriesResponse.status === 401 || volunteersResponse.status === 401) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user");
          localStorage.removeItem("user_role");
          navigate("/login", { replace: true });
          return;
        }

        const profileData = await profileResponse.json();
        const deliveriesData = await deliveriesResponse.json();
        const volunteersData = await volunteersResponse.json();

        if (!profileResponse.ok) {
          throw new Error(firstApiError(profileData));
        }

        if (!deliveriesResponse.ok) {
          throw new Error(firstApiError(deliveriesData));
        }

        if (!volunteersResponse.ok) {
          throw new Error(firstApiError(volunteersData));
        }

        setProfile(profileData.data);
        setDeliveries(deliveriesData.data);
        setVolunteers(volunteersData.data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Cannot connect to the FoodBridge service.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate]);

  const updateField = <K extends keyof VolunteerProfile>(
    field: K,
    value: VolunteerProfile[K],
  ) => {
    setProfile((current) => current ? { ...current, [field]: value } : current);
    setError("");
    setSuccess("");
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/volunteer/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          availability_status: profile.availability_status,
          vehicle_type: profile.vehicle_type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(firstApiError(data));
      }

      let confirmedProfile = data.data;

      if (!isCompleteProfile(confirmedProfile)) {
        const profileResponse = await fetch(`${API_URL}/volunteer/profile`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        });
        const profileData = await profileResponse.json();

        if (!profileResponse.ok || !isCompleteProfile(profileData.data)) {
          throw new Error("Profile saved, but the confirmed profile could not be refreshed.");
        }

        confirmedProfile = profileData.data;
      }

      setProfile(confirmedProfile);
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }
      setSuccess(data.message || "Profile updated successfully.");

      try {
        const volunteersResponse = await fetch(`${API_URL}/volunteers`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        });
        const volunteersData = await volunteersResponse.json();

        if (!volunteersResponse.ok) {
          throw new Error(firstApiError(volunteersData));
        }

        setVolunteers(volunteersData.data);
      } catch {
        setError("Profile saved, but the registered Volunteer list could not be refreshed.");
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update your profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      localStorage.removeItem("user_role");
      navigate("/login", { replace: true });
    }
  };

  const handleStatusUpdate = async (delivery: Delivery) => {
    const nextStatus = nextDeliveryStatus(delivery.delivery_status);
    if (!nextStatus) return;

    setUpdatingDeliveryId(delivery.delivery_id);
    setDeliveryMessage("");
    setDeliveryError("");

    try {
      const response = await fetch(
        `${API_URL}/volunteer/deliveries/${delivery.delivery_id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({ delivery_status: nextStatus.value }),
        },
      );
      const data = await response.json();

      if (!response.ok) throw new Error(firstApiError(data));

      const refreshedResponse = await fetch(`${API_URL}/volunteer/deliveries`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      const refreshedData = await refreshedResponse.json();

      if (!refreshedResponse.ok) throw new Error(firstApiError(refreshedData));

      setDeliveries(refreshedData.data);
      setDeliveryMessage(data.message || "Delivery status updated successfully.");
    } catch (updateError) {
      setDeliveryError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update the delivery status.",
      );
    } finally {
      setUpdatingDeliveryId(null);
    }
  };

  return (
    <div className="volunteer-page">
      <header className="volunteer-header">
        <div className="volunteer-header-inner">
          <Link className="volunteer-brand" to="/" aria-label="FoodBridge home">
            <span className="volunteer-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5.1 18 2 18 2c1 5.5-.2 10.8-4.7 13.4" />
                <path d="M2 21c0-4.5 4-9 14-9" />
              </svg>
            </span>
            <span>
              <strong>FoodBridge</strong>
              <small>Food · People · Impact</small>
            </span>
          </Link>

          <button className="volunteer-logout" type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </header>

      <main className="volunteer-main">
        <section className="volunteer-shell volunteer-hero" aria-labelledby="volunteer-title">
          <p className="volunteer-kicker">DELIVER FOOD. CREATE IMPACT.</p>
          <h1 id="volunteer-title">Volunteer Delivery Hub</h1>
          <p>Manage your availability, keep your details current, and view the deliveries entrusted to you.</p>
        </section>

        <div className="volunteer-shell">
          {loading ? (
            <div className="volunteer-state" role="status">
              <span className="volunteer-spinner" aria-hidden="true" />
              <h2>Loading your dashboard</h2>
              <p>We’re getting your profile and assigned deliveries ready.</p>
            </div>
          ) : profile ? (
            <>
              <section id="volunteer-profile-form" className="volunteer-profile-card" aria-labelledby="profile-heading">
                <div className="volunteer-section-heading">
                  <div>
                    <p className="volunteer-kicker">YOUR VOLUNTEER PROFILE</p>
                    <h2 id="profile-heading">Welcome, {profile.full_name}</h2>
                  </div>
                  <span className={`volunteer-status volunteer-status-${profile.availability_status.toLowerCase()}`}>
                    {profile.availability_status}
                  </span>
                </div>

                <form onSubmit={handleSave}>
                  <div className="volunteer-form-grid">
                    <div className="volunteer-field">
                      <label htmlFor="volunteer-id">Volunteer ID</label>
                      <input id="volunteer-id" value={profile.id} readOnly aria-readonly="true" />
                    </div>
                    <div className="volunteer-field">
                      <label htmlFor="full-name">Full Name</label>
                      <input id="full-name" value={profile.full_name} onChange={(event) => updateField("full_name", event.target.value)} required />
                    </div>
                    <div className="volunteer-field">
                      <label htmlFor="email">Email</label>
                      <input id="email" type="email" value={profile.email} onChange={(event) => updateField("email", event.target.value)} required />
                    </div>
                    <div className="volunteer-field">
                      <label htmlFor="phone">Phone</label>
                      <input id="phone" type="tel" value={profile.phone} onChange={(event) => updateField("phone", event.target.value)} required />
                    </div>
                    <div className="volunteer-field">
                      <label htmlFor="availability">Availability Status</label>
                      <select id="availability" value={profile.availability_status} onChange={(event) => updateField("availability_status", event.target.value as VolunteerProfile["availability_status"])}>
                        <option value="Available">Available</option>
                        <option value="Busy">Busy</option>
                        <option value="Offline">Offline</option>
                      </select>
                    </div>
                    <div className="volunteer-field">
                      <label htmlFor="vehicle">Vehicle Type</label>
                      <select id="vehicle" value={profile.vehicle_type} onChange={(event) => updateField("vehicle_type", event.target.value as VolunteerProfile["vehicle_type"])}>
                        <option value="None">None</option>
                        <option value="Bicycle">Bicycle</option>
                        <option value="Motorcycle">Motorcycle</option>
                        <option value="Car">Car</option>
                        <option value="Van">Van</option>
                      </select>
                    </div>
                  </div>

                  <div className="volunteer-form-actions">
                    <button className="volunteer-primary-button" type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save Profile"}
                    </button>
                    <div className="volunteer-messages" aria-live="polite">
                      {success && <p className="volunteer-success">{success}</p>}
                      {error && <p className="volunteer-error">{error}</p>}
                    </div>
                  </div>
                </form>
              </section>

              <section className="volunteer-registered" aria-labelledby="registered-volunteers-heading">
                  <div className="volunteer-registered-heading">
                    <div>
                      <p className="volunteer-kicker">FOODBRIDGE COMMUNITY</p>
                      <h2 id="registered-volunteers-heading">Registered Volunteers</h2>
                    </div>
                    <p>{volunteers.length} {volunteers.length === 1 ? "volunteer" : "volunteers"}</p>
                  </div>

                  <div className="volunteer-registered-grid">
                    {volunteers.map((volunteer) => {
                      const isCurrentVolunteer = volunteer.id === profile.id;

                      return (
                        <article className={`volunteer-registered-card${isCurrentVolunteer ? " volunteer-registered-card-current" : ""}`} key={volunteer.id}>
                          <div className="volunteer-registered-card-header">
                            <div>
                              <span>Volunteer</span>
                              <h3>Volunteer #{volunteer.id}</h3>
                            </div>
                            {isCurrentVolunteer && <span className="volunteer-profile-badge">Your profile</span>}
                          </div>
                          <dl>
                            <div><dt>Volunteer ID</dt><dd>#{volunteer.id}</dd></div>
                            <div><dt>Full Name</dt><dd>{volunteer.full_name}</dd></div>
                            <div><dt>Email</dt><dd>{volunteer.email}</dd></div>
                            <div><dt>Phone</dt><dd>{volunteer.phone}</dd></div>
                            <div><dt>Availability Status</dt><dd>{volunteer.availability_status}</dd></div>
                            <div><dt>Vehicle Type</dt><dd>{volunteer.vehicle_type}</dd></div>
                          </dl>
                          {isCurrentVolunteer && (
                            <button
                              className="volunteer-edit-profile-button"
                              type="button"
                              onClick={() => document.getElementById("volunteer-profile-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                            >
                              Edit profile
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>

              <section className="volunteer-deliveries" aria-labelledby="deliveries-heading">
                <div className="volunteer-deliveries-heading">
                  <div>
                    <p className="volunteer-kicker">YOUR ROUTES</p>
                    <h2 id="deliveries-heading">Assigned deliveries</h2>
                  </div>
                  <p>{deliveries.length} {deliveries.length === 1 ? "delivery" : "deliveries"}</p>
                </div>

                <div className="volunteer-delivery-messages" aria-live="polite">
                  {deliveryMessage && <p className="volunteer-success">{deliveryMessage}</p>}
                  {deliveryError && <p className="volunteer-error">{deliveryError}</p>}
                </div>

                {deliveries.length === 0 ? (
                  <div className="volunteer-empty-state">
                    <div className="volunteer-empty-icon" aria-hidden="true">✓</div>
                    <h3>No deliveries assigned</h3>
                    <p>You’re all caught up. New assignments will appear here when they’re ready.</p>
                  </div>
                ) : (
                  <div className="volunteer-delivery-grid">
                    {deliveries.map((delivery) => (
                      <article className="volunteer-delivery-card" key={delivery.delivery_id}>
                        <div className="volunteer-delivery-card-header">
                          <div>
                            <span>Delivery</span>
                            <h3>#{delivery.delivery_id}</h3>
                          </div>
                          <span className="volunteer-delivery-status">{humanizeStatus(delivery.delivery_status)}</span>
                        </div>
                        <dl>
                          <div><dt>Request ID</dt><dd>#{delivery.request_id}</dd></div>
                          <div><dt>Food</dt><dd>{delivery.food_name} ({delivery.food_category})</dd></div>
                          <div><dt>Quantity</dt><dd>{delivery.quantity} {delivery.unit}</dd></div>
                          <div><dt>NGO</dt><dd>{delivery.ngo_name}</dd></div>
                          <div><dt>NGO Contact</dt><dd>{delivery.ngo_phone || delivery.ngo_email}</dd></div>
                          <div><dt>Recipient</dt><dd>{delivery.recipient_name || "Assigned by NGO"}</dd></div>
                          <div><dt>Recipient Phone</dt><dd>{delivery.recipient_phone || "Unavailable"}</dd></div>
                          <div className="volunteer-detail-wide"><dt>Pickup</dt><dd>{delivery.pickup_contact} · {delivery.pickup_phone}<br />{delivery.pickup_address || "Address unavailable"}</dd></div>
                          <div className="volunteer-detail-wide"><dt>Destination</dt><dd>{delivery.destination_address || delivery.ngo_address || "Address unavailable"}</dd></div>
                          <div className="volunteer-detail-wide"><dt>Pickup Time</dt><dd>{formatDate(delivery.pickup_time)}</dd></div>
                          <div className="volunteer-detail-wide"><dt>Delivered At</dt><dd>{formatDate(delivery.delivered_at)}</dd></div>
                        </dl>
                        {nextDeliveryStatus(delivery.delivery_status) && (
                          <button
                            className="volunteer-delivery-action"
                            type="button"
                            disabled={updatingDeliveryId === delivery.delivery_id}
                            onClick={() => handleStatusUpdate(delivery)}
                          >
                            {updatingDeliveryId === delivery.delivery_id
                              ? "Updating..."
                              : nextDeliveryStatus(delivery.delivery_status)?.label}
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="volunteer-state volunteer-state-error" role="alert">
              <h2>We couldn’t load your dashboard</h2>
              <p>{error || "Your Volunteer profile is not available."}</p>
              <button className="volunteer-primary-button" type="button" onClick={() => window.location.reload()}>Try again</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default VolunteerPage;
