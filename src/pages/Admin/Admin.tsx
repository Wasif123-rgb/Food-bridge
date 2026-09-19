import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Admin.css";

type Summary = {
  donors: number;
  ngos: number;
  volunteers: number;
  donations: number;
  requests: number;
  deliveries: number;
  recipients: number;
};

type NgoVerification = {
  verified: number;
  pending: number;
};

type Ngo = {
  id: number;
  ngo_name: string;
  registration_no: string;
  email: string;
  phone: string;
  address: string | null;
  is_verified: boolean;
};

type DonationCategory = {
  food_category: string;
  total_donations: number;
  total_quantity: string;
};

type DonationByDonor = {
  id: number;
  donor_name: string;
  total_donations: number;
  total_quantity: string;
};

type RequestByNgo = {
  id: number;
  ngo_name: string;
  total_requests: number;
};

type StatusData = {
  request_status?: string;
  delivery_status?: string;
  total: number;
};

type VolunteerWorkload = {
  id: number;
  full_name: string;
  availability_status: string;
  total_deliveries: number;
};

type RequestDetail = {
  id: number;
  donor_name: string;
  food_name: string;
  food_category: string;
  ngo_name: string;
  requested_qty: string;
  request_status: string;
  requested_at: string;
};

type DashboardData = {
  success: boolean;
  summary: Summary;
  ngo_verification: NgoVerification;
  donations_by_category: DonationCategory[];
  donations_by_donor: DonationByDonor[];
  requests_by_ngo: RequestByNgo[];
  requests_by_status: StatusData[];
  deliveries_by_status: StatusData[];
  volunteer_workload: VolunteerWorkload[];
  recipients_by_ngo: {
    id: number;
    ngo_name: string;
    total_recipients: number;
    total_household_size: string;
  }[];
  request_details: RequestDetail[];
  recent_deliveries: {
    id: number;
    food_name: string;
    ngo_name: string;
    volunteer_name: string | null;
    pickup_time: string | null;
    delivered_at: string | null;
    delivery_status: string;
  }[];
};

function Admin() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [loading, setLoading] = useState(true);
  const [ngoLoading, setNgoLoading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [ngoError, setNgoError] = useState("");

  // ======================================================
  // DASHBOARD FILTERS
  // ======================================================

  const [ngoFilter, setNgoFilter] = useState("all");
  const [donationCategoryFilter, setDonationCategoryFilter] =
    useState("all");
  const [requestStatusFilter, setRequestStatusFilter] =
    useState("all");
  const [deliveryStatusFilter, setDeliveryStatusFilter] =
    useState("all");

  // ======================================================
  // LOAD DASHBOARD + NGOs
  // ======================================================

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("auth_token");

        if (!token) {
          navigate("/login", { replace: true });
          return;
        }

        // -----------------------------
        // Dashboard
        // -----------------------------

        const dashboardResponse = await fetch(
          "http://127.0.0.1:8000/api/admin/dashboard",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!dashboardResponse.ok) {
          throw new Error("Failed to load admin dashboard");
        }

        const dashboardData: DashboardData =
          await dashboardResponse.json();

        setDashboard(dashboardData);

        // -----------------------------
        // NGOs
        // -----------------------------

        const ngoResponse = await fetch(
          "http://127.0.0.1:8000/api/ngos",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!ngoResponse.ok) {
          throw new Error("Failed to load NGOs");
        }

        const ngoData = await ngoResponse.json();

        setNgos(ngoData.data || []);
      } catch (err) {
        console.error(err);
        setError("Unable to load admin dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // ======================================================
  // VERIFY / UNVERIFY NGO
  // ======================================================

  const handleNgoVerification = async (
    ngoId: number,
    verify: boolean
  ) => {
    try {
      setNgoLoading(ngoId);
      setNgoError("");

      const token = localStorage.getItem("auth_token");

      const endpoint = verify
        ? `http://127.0.0.1:8000/api/admin/ngos/${ngoId}/verify`
        : `http://127.0.0.1:8000/api/admin/ngos/${ngoId}/unverify`;

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update NGO verification."
        );
      }

      // Update NGO immediately on screen
      setNgos((currentNgos) =>
        currentNgos.map((ngo) =>
          ngo.id === ngoId
            ? {
                ...ngo,
                is_verified: verify,
              }
            : ngo
        )
      );

      // Update verification counts immediately
      setDashboard((currentDashboard) => {
        if (!currentDashboard) return currentDashboard;

        const currentVerified =
          currentDashboard.ngo_verification.verified;

        const currentPending =
          currentDashboard.ngo_verification.pending;

        return {
          ...currentDashboard,
          ngo_verification: {
            verified: verify
              ? currentVerified + 1
              : Math.max(0, currentVerified - 1),

            pending: verify
              ? Math.max(0, currentPending - 1)
              : currentPending + 1,
          },
        };
      });
    } catch (err) {
      console.error(err);

      setNgoError(
        err instanceof Error
          ? err.message
          : "Unable to update NGO verification."
      );
    } finally {
      setNgoLoading(null);
    }
  };

  // ======================================================
  // LOGOUT
  // ======================================================

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");

    navigate("/login", { replace: true });
  };

  // ======================================================
  // LOADING
  // ======================================================

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading Admin Dashboard...</p>
      </div>
    );
  }

  // ======================================================
  // ERROR
  // ======================================================

  if (error || !dashboard) {
    return (
      <div className="admin-error">
        <h2>Something went wrong</h2>

        <p>{error}</p>

        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  const { summary } = dashboard;

  // ======================================================
  // FILTER NGO APPLICATIONS
  // ======================================================

  const filteredNgos = ngos.filter((ngo) => {
    if (ngoFilter === "verified") return ngo.is_verified;
    if (ngoFilter === "pending") return !ngo.is_verified;

    return true;
  });

  // ======================================================
  // FILTER DONATIONS BY CATEGORY
  // ======================================================

  const filteredDonationsByCategory =
    donationCategoryFilter === "all"
      ? dashboard.donations_by_category
      : dashboard.donations_by_category.filter(
          (item) =>
            item.food_category === donationCategoryFilter
        );

  // ======================================================
  // FILTER REQUESTS BY STATUS
  // ======================================================

  const filteredRequestDetails =
    requestStatusFilter === "all"
      ? dashboard.request_details
      : dashboard.request_details.filter(
          (request) =>
            request.request_status === requestStatusFilter
        );

  // ======================================================
  // FILTER DELIVERIES BY STATUS
  // ======================================================

  const filteredDeliveryStatuses =
    deliveryStatusFilter === "all"
      ? dashboard.deliveries_by_status
      : dashboard.deliveries_by_status.filter(
          (item) =>
            item.delivery_status === deliveryStatusFilter
        );

  // ======================================================
  // FILTER OPTIONS
  // ======================================================

  const donationCategories = Array.from(
    new Set(
      dashboard.donations_by_category.map(
        (item) => item.food_category
      )
    )
  );

  const requestStatuses = Array.from(
    new Set(
      dashboard.request_details.map(
        (item) => item.request_status
      )
    )
  );

  const deliveryStatuses = Array.from(
    new Set(
      dashboard.deliveries_by_status.map(
        (item) => item.delivery_status
      )
    )
  );

  return (
    <div className="admin-page">

      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <aside className="admin-sidebar">

        <div className="admin-logo">

          <div className="logo-icon">
            🌿
          </div>

          <div>
            <h2>FoodBridge</h2>
            <span>Administration</span>
          </div>

        </div>

        <nav className="admin-nav">

          <a href="#dashboard" className="active">
            <span>▦</span>
            Dashboard
          </a>

          <a href="#donations">
            <span>🍱</span>
            Donations
          </a>

          <a href="#requests">
            <span>📋</span>
            Requests
          </a>

          <a href="#ngos">
            <span>🤝</span>
            NGOs
          </a>

          <a href="#deliveries">
            <span>🚚</span>
            Deliveries
          </a>

          <a href="#volunteers">
            <span>👥</span>
            Volunteers
          </a>

        </nav>

        {/* SIDEBAR BOTTOM */}

        <div className="admin-sidebar-bottom">

          <div className="admin-profile">

            <div className="admin-avatar">
              A
            </div>

            <div className="admin-profile-info">

              <strong>
                FoodBridge Admin
              </strong>

              <span>
                Administrator
              </span>

            </div>

          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            <span>↪</span>
            Logout
          </button>

        </div>

      </aside>

      {/* ==================================================
          MAIN
      ================================================== */}

      <main className="admin-main">

        {/* HEADER */}

        <header
          className="admin-header"
          id="dashboard"
        >

          <div className="header-content">

            <p className="header-label">
              ADMINISTRATION
            </p>

            <h1>
              Dashboard Overview
            </h1>

            <p className="header-description">
              Monitor FoodBridge activity, donations, requests
              and community impact from one place.
            </p>

          </div>

          <div className="header-status">

            <span className="status-dot"></span>

            System Online

          </div>

        </header>

        {/* ==================================================
            SUMMARY CARDS
        ================================================== */}

        <section className="summary-grid">

          <div className="summary-card">

            <div className="card-icon">
              👤
            </div>

            <div>
              <span>Total Donors</span>
              <strong>{summary.donors}</strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="card-icon">
              🤝
            </div>

            <div>
              <span>Partner NGOs</span>
              <strong>{summary.ngos}</strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="card-icon">
              🍱
            </div>

            <div>
              <span>Food Donations</span>
              <strong>{summary.donations}</strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="card-icon">
              📋
            </div>

            <div>
              <span>Food Requests</span>
              <strong>{summary.requests}</strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="card-icon">
              🚚
            </div>

            <div>
              <span>Deliveries</span>
              <strong>{summary.deliveries}</strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="card-icon">
              👥
            </div>

            <div>
              <span>Volunteers</span>
              <strong>{summary.volunteers}</strong>
            </div>

          </div>

        </section>

        {/* ==================================================
            DONATIONS + NGO VERIFICATION SUMMARY
        ================================================== */}

        <section className="dashboard-grid">

          {/* DONATIONS */}

          <div
            className="dashboard-card"
            id="donations"
          >

            <div className="section-heading">

              <div>

                <span className="section-label">
                  DONATIONS
                </span>

                <h2>
                  Food by Category
                </h2>

                <p>
                  Overview of donated food types
                </p>

              </div>

              {/* DONATION CATEGORY FILTER */}

              <select
                className="dashboard-filter"
                value={donationCategoryFilter}
                onChange={(e) =>
                  setDonationCategoryFilter(e.target.value)
                }
              >

                <option value="all">
                  All Categories
                </option>

                {donationCategories.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}

              </select>

            </div>

            {dashboard.donations_by_category.length === 0 ? (

              <p className="empty-message">
                No donation data available.
              </p>

            ) : filteredDonationsByCategory.length === 0 ? (

              <p className="empty-message">
                No donations match this category.
              </p>

            ) : (

              <div className="category-list">

                {filteredDonationsByCategory.map(
                  (item) => (

                    <div
                      className="category-row"
                      key={item.food_category}
                    >

                      <div className="category-left">

                        <div className="category-icon">
                          🍽️
                        </div>

                        <div className="category-info">

                          <span>
                            {item.food_category}
                          </span>

                          <small>
                            {item.total_donations} donation
                            {item.total_donations !== 1
                              ? "s"
                              : ""}
                          </small>

                        </div>

                      </div>

                      <div className="category-quantity">
                        {item.total_quantity}
                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </div>

          {/* NGO VERIFICATION SUMMARY */}

          <div
            className="dashboard-card"
            id="ngos"
          >

            <div className="section-heading">

              <div>

                <span className="section-label">
                  NGO MANAGEMENT
                </span>

                <h2>
                  Verification Status
                </h2>

                <p>
                  Review and manage NGO verification
                </p>

              </div>

            </div>

            <div className="verification-container">

              <div className="verification-box verified">

                <span>✓</span>

                <div>

                  <strong>
                    {dashboard.ngo_verification.verified}
                  </strong>

                  <small>
                    Verified NGOs
                  </small>

                </div>

              </div>

              <div className="verification-box pending">

                <span>!</span>

                <div>

                  <strong>
                    {dashboard.ngo_verification.pending}
                  </strong>

                  <small>
                    Pending Review
                  </small>

                </div>

              </div>

            </div>

          </div>

        </section>

        {/* ==================================================
            NGO MANAGEMENT
        ================================================== */}

        <section className="dashboard-card ngo-management-card">

          <div className="section-heading">

            <div>

              <span className="section-label">
                NGO MANAGEMENT
              </span>

              <h2>
                NGO Applications
              </h2>

              <p>
                Review NGO registration details and manage
                verification status.
              </p>

            </div>

            {/* NGO FILTER */}

            <select
              className="dashboard-filter"
              value={ngoFilter}
              onChange={(e) =>
                setNgoFilter(e.target.value)
              }
            >

              <option value="all">
                All NGOs
              </option>

              <option value="verified">
                Verified NGOs
              </option>

              <option value="pending">
                Pending NGOs
              </option>

            </select>

          </div>

          {ngoError && (

            <div className="ngo-error">
              {ngoError}
            </div>

          )}

          {ngos.length === 0 ? (

            <div className="empty-state">

              <div>🤝</div>

              <h3>
                No NGOs registered
              </h3>

              <p>
                NGO applications will appear here when
                organizations register with FoodBridge.
              </p>

            </div>

          ) : (

            <div className="ngo-table-wrapper">

              {filteredNgos.length === 0 ? (

                <p className="empty-message">
                  No NGOs match this filter.
                </p>

              ) : (

                <table className="ngo-table">

                  <thead>

                    <tr>

                      <th>NGO</th>
                      <th>Registration</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Action</th>

                    </tr>

                  </thead>

                  <tbody>

                    {filteredNgos.map((ngo) => (

                      <tr key={ngo.id}>

                        <td>

                          <div className="ngo-name-cell">

                            <div className="ngo-table-avatar">
                              {ngo.ngo_name
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>

                              <strong>
                                {ngo.ngo_name}
                              </strong>

                              <small>
                                {ngo.phone}
                              </small>

                            </div>

                          </div>

                        </td>

                        <td>
                          {ngo.registration_no}
                        </td>

                        <td>
                          {ngo.email}
                        </td>

                        <td>

                          {ngo.is_verified ? (

                            <span className="ngo-status verified-status">
                              ✓ Verified
                            </span>

                          ) : (

                            <span className="ngo-status pending-status">
                              ! Pending
                            </span>

                          )}

                        </td>

                        <td>

                          {ngo.is_verified ? (

                            <button
                              className="ngo-action-button unverify-button"
                              disabled={
                                ngoLoading === ngo.id
                              }
                              onClick={() =>
                                handleNgoVerification(
                                  ngo.id,
                                  false
                                )
                              }
                            >

                              {ngoLoading === ngo.id
                                ? "Updating..."
                                : "Set Pending"}

                            </button>

                          ) : (

                            <button
                              className="ngo-action-button verify-button"
                              disabled={
                                ngoLoading === ngo.id
                              }
                              onClick={() =>
                                handleNgoVerification(
                                  ngo.id,
                                  true
                                )
                              }
                            >

                              {ngoLoading === ngo.id
                                ? "Verifying..."
                                : "Verify NGO"}

                            </button>

                          )}

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              )}

            </div>

          )}

        </section>

        {/* ==================================================
            DONATIONS BY DONOR
        ================================================== */}

        <section className="dashboard-card">

          <div className="section-heading">

            <div>

              <span className="section-label">
                DONOR ACTIVITY
              </span>

              <h2>
                Donation Contributions
              </h2>

              <p>
                Food donation activity grouped by donor
              </p>

            </div>

          </div>

          <div className="table-wrapper">

            <table>

              <thead>

                <tr>
                  <th>Donor</th>
                  <th>Total Donations</th>
                  <th>Total Quantity</th>
                </tr>

              </thead>

              <tbody>

                {dashboard.donations_by_donor.map(
                  (donor) => (

                    <tr key={donor.id}>

                      <td className="strong-cell">
                        {donor.donor_name}
                      </td>

                      <td>

                        <span className="number-badge">
                          {donor.total_donations}
                        </span>

                      </td>

                      <td>
                        {donor.total_quantity}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        </section>

        {/* ==================================================
            REQUESTS + VOLUNTEERS
        ================================================== */}

        <section className="dashboard-grid">

          {/* REQUESTS */}

          <div
            className="dashboard-card"
            id="requests"
          >

            <div className="section-heading">

              <div>

                <span className="section-label">
                  REQUEST ACTIVITY
                </span>

                <h2>
                  Requests by NGO
                </h2>

                <p>
                  Requests received from partner NGOs
                </p>

              </div>

            </div>

            {dashboard.requests_by_ngo.length === 0 ? (

              <p className="empty-message">
                No NGO requests available.
              </p>

            ) : (

              <div className="simple-list">

                {dashboard.requests_by_ngo.map(
                  (ngo) => (

                    <div
                      className="list-row"
                      key={ngo.id}
                    >

                      <div className="list-main">

                        <span className="list-icon">
                          🤝
                        </span>

                        <span>
                          {ngo.ngo_name}
                        </span>

                      </div>

                      <strong>
                        {ngo.total_requests}
                      </strong>

                    </div>

                  )
                )}

              </div>

            )}

          </div>

          {/* VOLUNTEERS */}

          <div
            className="dashboard-card"
            id="volunteers"
          >

            <div className="section-heading">

              <div>

                <span className="section-label">
                  VOLUNTEER ACTIVITY
                </span>

                <h2>
                  Volunteer Workload
                </h2>

                <p>
                  Delivery assignments by volunteer
                </p>

              </div>

            </div>

            {dashboard.volunteer_workload.length === 0 ? (

              <p className="empty-message">
                No volunteer activity available.
              </p>

            ) : (

              <div className="simple-list">

                {dashboard.volunteer_workload.map(
                  (volunteer) => (

                    <div
                      className="list-row volunteer-row"
                      key={volunteer.id}
                    >

                      <div className="volunteer-info">

                        <div className="volunteer-avatar">

                          {volunteer.full_name
                            .charAt(0)
                            .toUpperCase()}

                        </div>

                        <div>

                          <strong>
                            {volunteer.full_name}
                          </strong>

                          <small>
                            {volunteer.availability_status}
                          </small>

                        </div>

                      </div>

                      <span className="delivery-count">
                        {volunteer.total_deliveries} deliveries
                      </span>

                    </div>

                  )
                )}

              </div>

            )}

          </div>

        </section>

        {/* ==================================================
            DELIVERY STATUS
        ================================================== */}

        <section
          className="dashboard-card"
          id="deliveries"
        >

          <div className="section-heading">

            <div>

              <span className="section-label">
                DELIVERY MONITORING
              </span>

              <h2>
                Delivery Status
              </h2>

              <p>
                Current status of food deliveries
              </p>

            </div>

            {/* DELIVERY FILTER */}

            <select
              className="dashboard-filter"
              value={deliveryStatusFilter}
              onChange={(e) =>
                setDeliveryStatusFilter(e.target.value)
              }
            >

              <option value="all">
                All Delivery Statuses
              </option>

              {deliveryStatuses.map((status) => (

                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>

              ))}

            </select>

          </div>

          {dashboard.deliveries_by_status.length === 0 ? (

            <div className="empty-state">

              <div>🚚</div>

              <h3>
                No deliveries yet
              </h3>

              <p>
                Delivery statistics will appear here once
                food requests are assigned for delivery.
              </p>

            </div>

          ) : filteredDeliveryStatuses.length === 0 ? (

            <p className="empty-message">
              No deliveries match this status.
            </p>

          ) : (

            <div className="status-grid">

              {filteredDeliveryStatuses.map(
                (item, index) => (

                  <div
                    className="status-card"
                    key={index}
                  >

                    <div>

                      <span className="status-card-label">
                        DELIVERY STATUS
                      </span>

                      <strong>
                        {item.delivery_status}
                      </strong>

                    </div>

                    <span className="status-number">
                      {item.total}
                    </span>

                  </div>

                )
              )}

            </div>

          )}

        </section>

        {/* ==================================================
            RECENT REQUESTS
        ================================================== */}

        <section className="dashboard-card">

          <div className="section-heading">

            <div>

              <span className="section-label">
                RECENT ACTIVITY
              </span>

              <h2>
                Recent Food Requests
              </h2>

              <p>
                Latest requests submitted through FoodBridge
              </p>

            </div>

            {/* REQUEST STATUS FILTER */}

            <select
              className="dashboard-filter"
              value={requestStatusFilter}
              onChange={(e) =>
                setRequestStatusFilter(e.target.value)
              }
            >

              <option value="all">
                All Request Statuses
              </option>

              {requestStatuses.map((status) => (

                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>

              ))}

            </select>

          </div>

          {dashboard.request_details.length === 0 ? (

            <div className="empty-state">

              <div>📋</div>

              <h3>
                No requests yet
              </h3>

              <p>
                Food requests from NGOs will appear here.
              </p>

            </div>

          ) : filteredRequestDetails.length === 0 ? (

            <p className="empty-message">
              No requests match this status.
            </p>

          ) : (

            <div className="table-wrapper">

              <table>

                <thead>

                  <tr>
                    <th>Donor</th>
                    <th>Food</th>
                    <th>NGO</th>
                    <th>Quantity</th>
                    <th>Status</th>
                  </tr>

                </thead>

                <tbody>

                  {filteredRequestDetails.map(
                    (request) => (

                      <tr key={request.id}>

                        <td>
                          {request.donor_name}
                        </td>

                        <td className="strong-cell">
                          {request.food_name}
                        </td>

                        <td>
                          {request.ngo_name}
                        </td>

                        <td>
                          {request.requested_qty}
                        </td>

                        <td>

                          <span className="badge">
                            {request.request_status}
                          </span>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>

        {/* ==================================================
            FOOTER
        ================================================== */}

        <footer className="admin-footer">

          <span>
            © FoodBridge Administration
          </span>

          <span>
            Food · People · Impact
          </span>

        </footer>

      </main>

    </div>
  );
}

export default Admin;