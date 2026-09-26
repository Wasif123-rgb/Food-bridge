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

type TransactionFinalRow = {
  id: number;
  action_name: string;
};

type TransactionDemo = {
  success: boolean;
  results: {
    id: number;
    operation: string;
    result: string;
  }[];
  final_rows: TransactionFinalRow[];
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

  database_features?: {
    view_name: string;
    view_description: string;
    procedure_name: string;
    procedure_description: string;
  };
};

/* =========================================================
   DELIVERY ASSIGNMENT TYPES
========================================================= */

type DeliveryRequestOption = {
  request_id: number;
  ngo_id: number;
  ngo_name: string;
  requested_qty: string;
  request_status: string;
  requested_at: string;
  donation_id: number;
  food_name: string;
  food_category: string;
  unit: string | null;
  donor_name: string;
  donor_phone: string | null;
  donor_address: string | null;
};

type AvailableVolunteer = {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string | null;
  availability_status: string;
};

type DeliveryRecipient = {
  id: number;
  ngo_id: number;
  recipient_no: number;
  full_name: string;
  address: string | null;
  phone: string | null;
  household_size: number | null;
};

type DeliveryOptionsResponse = {
  success: boolean;
  requests: DeliveryRequestOption[];
  available_volunteers: AvailableVolunteer[];
};

type RecipientsResponse = {
  success: boolean;
  request: {
    id: number;
    ngo_id: number;
    ngo_name: string;
  };
  recipients: DeliveryRecipient[];
};

function Admin() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [ngos, setNgos] = useState<Ngo[]>([]);

  const [loading, setLoading] = useState(true);

  const [ngoLoading, setNgoLoading] =
    useState<number | null>(null);

  const [error, setError] = useState("");

  const [ngoActionMessage, setNgoActionMessage] =
    useState("");

  // ======================================================
  // TRANSACTION DEMO
  // ======================================================

  const [transactionDemo, setTransactionDemo] =
    useState<TransactionDemo | null>(null);

  const [transactionLoading, setTransactionLoading] =
    useState(false);

  const [transactionError, setTransactionError] =
    useState("");

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
  // DELIVERY ASSIGNMENT
  // ======================================================

  const [deliveryRequests, setDeliveryRequests] =
    useState<DeliveryRequestOption[]>([]);

  const [availableVolunteers, setAvailableVolunteers] =
    useState<AvailableVolunteer[]>([]);

  const [deliveryRecipients, setDeliveryRecipients] =
    useState<DeliveryRecipient[]>([]);

  const [selectedRequestId, setSelectedRequestId] =
    useState("");

  const [selectedVolunteerId, setSelectedVolunteerId] =
    useState("");

  const [selectedRecipientId, setSelectedRecipientId] =
    useState("");

  const [deliveryLoading, setDeliveryLoading] =
    useState(false);

  const [recipientLoading, setRecipientLoading] =
    useState(false);

  const [assignmentLoading, setAssignmentLoading] =
    useState(false);

  const [deliveryMessage, setDeliveryMessage] =
    useState("");

  const [deliveryError, setDeliveryError] =
    useState("");

  // ======================================================
  // AUTH TOKEN
  // ======================================================

  const getToken = () => {
    return localStorage.getItem("auth_token");
  };

  // ======================================================
  // LOAD DASHBOARD
  // ======================================================

  const loadDashboard = async () => {
    const token = getToken();

    if (!token) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    const response = await fetch(
      "http://127.0.0.1:8000/api/admin/dashboard",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to load admin dashboard."
      );
    }

    setDashboard(data);
  };

  // ======================================================
  // LOAD NGOS
  // ======================================================

  const loadNgos = async () => {
    const token = getToken();

    if (!token) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    const response = await fetch(
      "http://127.0.0.1:8000/api/ngos",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to load NGOs."
      );
    }

    setNgos(data.data || []);
  };

  // ======================================================
  // LOAD DELIVERY OPTIONS
  // ======================================================

  const loadDeliveryOptions = async () => {
    const token = getToken();

    if (!token) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    try {
      setDeliveryLoading(true);
      setDeliveryError("");

      const response = await fetch(
        "http://127.0.0.1:8000/api/admin/delivery-options",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data: DeliveryOptionsResponse =
        await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error(
          (data as any).message ||
            "Unable to load delivery options."
        );
      }

      setDeliveryRequests(
        Array.isArray(data.requests)
          ? data.requests
          : []
      );

      setAvailableVolunteers(
        Array.isArray(data.available_volunteers)
          ? data.available_volunteers
          : []
      );
    } catch (err) {
      console.error(err);

      setDeliveryError(
        err instanceof Error
          ? err.message
          : "Unable to load delivery options."
      );
    } finally {
      setDeliveryLoading(false);
    }
  };

  // ======================================================
  // INITIAL LOAD
  // ======================================================

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getToken();

        if (!token) {
          navigate("/login", {
            replace: true,
          });

          return;
        }

        await Promise.all([
          loadDashboard(),
          loadNgos(),
          loadDeliveryOptions(),
        ]);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load admin dashboard."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // ======================================================
  // WHEN REQUEST CHANGES, LOAD RECIPIENTS
  // ======================================================

  useEffect(() => {
    const loadRecipients = async () => {
      if (!selectedRequestId) {
        setDeliveryRecipients([]);
        setSelectedRecipientId("");
        return;
      }

      const token = getToken();

      if (!token) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      try {
        setRecipientLoading(true);
        setDeliveryError("");

        setDeliveryRecipients([]);
        setSelectedRecipientId("");

        const response = await fetch(
          `http://127.0.0.1:8000/api/admin/food-requests/${selectedRequestId}/recipients`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data: RecipientsResponse =
          await response.json();

        if (!response.ok || data.success !== true) {
          throw new Error(
            (data as any).message ||
              "Unable to load recipients."
          );
        }

        setDeliveryRecipients(
          Array.isArray(data.recipients)
            ? data.recipients
            : []
        );
      } catch (err) {
        console.error(err);

        setDeliveryError(
          err instanceof Error
            ? err.message
            : "Unable to load recipients."
        );
      } finally {
        setRecipientLoading(false);
      }
    };

    loadRecipients();
  }, [selectedRequestId, navigate]);

  // ======================================================
  // NGO MESSAGE
  // ======================================================

  const showNgoMessage = (
    message: string
  ) => {
    setNgoActionMessage(message);

    setTimeout(() => {
      setNgoActionMessage("");
    }, 3000);
  };

  // ======================================================
  // VERIFY / UNVERIFY NGO
  // ======================================================

  const handleNgoVerification = async (
    ngoId: number,
    verify: boolean
  ) => {
    try {
      setNgoLoading(ngoId);
      setNgoActionMessage("");

      const token = getToken();

      const endpoint = verify
        ? `http://127.0.0.1:8000/api/admin/ngos/${ngoId}/verify`
        : `http://127.0.0.1:8000/api/admin/ngos/${ngoId}/unverify`;

      const response = await fetch(
        endpoint,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        showNgoMessage(
          data.message ||
            "Unable to update NGO verification."
        );

        return;
      }

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

      setDashboard(
        (currentDashboard) => {
          if (!currentDashboard) {
            return currentDashboard;
          }

          const currentVerified =
            currentDashboard.ngo_verification
              .verified;

          const currentPending =
            currentDashboard.ngo_verification
              .pending;

          return {
            ...currentDashboard,

            ngo_verification: {
              verified: verify
                ? currentVerified + 1
                : Math.max(
                    0,
                    currentVerified - 1
                  ),

              pending: verify
                ? Math.max(
                    0,
                    currentPending - 1
                  )
                : currentPending + 1,
            },
          };
        }
      );

      showNgoMessage(
        verify
          ? "NGO verified successfully."
          : "NGO verification removed."
      );
    } catch (err) {
      console.error(err);

      showNgoMessage(
        err instanceof Error
          ? err.message
          : "Unable to update NGO verification."
      );
    } finally {
      setNgoLoading(null);
    }
  };

  // ======================================================
  // ASSIGN DELIVERY
  // ======================================================

  const handleAssignDelivery = async () => {
    if (assignmentLoading) {
      return;
    }

    setDeliveryMessage("");
    setDeliveryError("");

    if (!selectedRequestId) {
      setDeliveryError(
        "Please select a food request."
      );

      return;
    }

    if (!selectedVolunteerId) {
      setDeliveryError(
        "Please select an available volunteer."
      );

      return;
    }

    if (!selectedRecipientId) {
      setDeliveryError(
        "Please select a recipient."
      );

      return;
    }

    const token = getToken();

    if (!token) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    try {
      setAssignmentLoading(true);

      const response = await fetch(
        "http://127.0.0.1:8000/api/deliveries",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            request_id: Number(
              selectedRequestId
            ),

            volunteer_id: Number(
              selectedVolunteerId
            ),

            recipient_id: Number(
              selectedRecipientId
            ),

            delivery_status: "pending",
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.message ||
            "Unable to assign delivery."
        );
      }

      setDeliveryMessage(
        "Delivery assigned successfully."
      );

      setSelectedRequestId("");
      setSelectedVolunteerId("");
      setSelectedRecipientId("");
      setDeliveryRecipients([]);

      await Promise.all([
        loadDashboard(),
        loadDeliveryOptions(),
      ]);
    } catch (err) {
      console.error(err);

      setDeliveryError(
        err instanceof Error
          ? err.message
          : "Unable to assign delivery."
      );
    } finally {
      setAssignmentLoading(false);
    }
  };

  // ======================================================
  // SELECTED REQUEST
  // ======================================================

  const selectedRequest =
    deliveryRequests.find(
      (request) =>
        String(request.request_id) ===
        selectedRequestId
    );

  // ======================================================
  // RUN RAW SQL TRANSACTION DEMO
  // ======================================================

  const runTransactionDemo = async () => {
    if (transactionLoading) {
      return;
    }

    try {
      setTransactionLoading(true);
      setTransactionError("");

      setTransactionDemo(null);

      const token = getToken();

      if (!token) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      const response = await fetch(
        "http://127.0.0.1:8000/api/admin/transactions/demo",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.message ||
            "Transaction demonstration failed."
        );
      }

      const normalizedTransactionDemo: TransactionDemo = {
        success: true,

        results: Array.isArray(data.results)
          ? data.results
          : [],

        final_rows: Array.isArray(data.final_rows)
          ? data.final_rows
          : [],
      };

      setTransactionDemo(
        normalizedTransactionDemo
      );
    } catch (err) {
      console.error(err);

      setTransactionError(
        err instanceof Error
          ? err.message
          : "Transaction demonstration failed."
      );
    } finally {
      setTransactionLoading(false);
    }
  };

  // ======================================================
  // LOGOUT
  // ======================================================

  const handleLogout = () => {
    localStorage.removeItem(
      "auth_token"
    );

    localStorage.removeItem(
      "user"
    );

    navigate("/login", {
      replace: true,
    });
  };

  // ======================================================
  // LOADING
  // ======================================================

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>

        <p>
          Loading Admin Dashboard...
        </p>
      </div>
    );
  }

  // ======================================================
  // ERROR
  // ======================================================

  if (error || !dashboard) {
    return (
      <div className="admin-error">
        <h2>
          Something went wrong
        </h2>

        <p>
          {error}
        </p>

        <button
          onClick={() =>
            window.location.reload()
          }
        >
          Try Again
        </button>
      </div>
    );
  }

  const { summary } = dashboard;

  // ======================================================
  // FILTER NGO APPLICATIONS
  // ======================================================

  const filteredNgos =
    ngos.filter((ngo) => {
      if (ngoFilter === "verified") {
        return ngo.is_verified;
      }

      if (ngoFilter === "pending") {
        return !ngo.is_verified;
      }

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
            item.food_category ===
            donationCategoryFilter
        );

  // ======================================================
  // FILTER REQUESTS BY STATUS
  // ======================================================

  const filteredRequestDetails =
    requestStatusFilter === "all"
      ? dashboard.request_details
      : dashboard.request_details.filter(
          (request) =>
            request.request_status ===
            requestStatusFilter
        );

  // ======================================================
  // FILTER DELIVERIES BY STATUS
  // ======================================================

  const filteredDeliveryStatuses =
    deliveryStatusFilter === "all"
      ? dashboard.deliveries_by_status
      : dashboard.deliveries_by_status.filter(
          (item) =>
            item.delivery_status ===
            deliveryStatusFilter
        );

  // ======================================================
  // FILTER OPTIONS
  // ======================================================

  const donationCategories =
    Array.from(
      new Set(
        dashboard.donations_by_category.map(
          (item) =>
            item.food_category
        )
      )
    );

  const requestStatuses =
    Array.from(
      new Set(
        dashboard.request_details.map(
          (item) =>
            item.request_status
        )
      )
    );

  const deliveryStatuses =
    Array.from(
      new Set(
        dashboard.deliveries_by_status.map(
          (item) =>
            item.delivery_status
        )
      )
    );

  // ======================================================
  // PAGE
  // ======================================================

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
            <h2>
              FoodBridge
            </h2>

            <span>
              Administration
            </span>
          </div>

        </div>

        <nav className="admin-nav">

          <a
            href="#dashboard"
            className="active"
          >
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

          <a href="#delivery-assignment">
            <span>➕</span>
            Assign Delivery
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

        {/* ==================================================
            HEADER
        ================================================== */}

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
              Monitor FoodBridge activity, donations,
              requests and community impact from one place.
            </p>

          </div>

          <div className="header-status">

            <span className="status-dot"></span>

            System Online

          </div>

        </header>

        {/* ==================================================
            SUMMARY
        ================================================== */}

        <section className="summary-grid">

          <div className="summary-card">

            <div className="card-icon">
              👤
            </div>

            <div>
              <span>
                Total Donors
              </span>

              <strong>
                {summary.donors}
              </strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="card-icon">
              🤝
            </div>

            <div>
              <span>
                Partner NGOs
              </span>

              <strong>
                {summary.ngos}
              </strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="card-icon">
              🍱
            </div>

            <div>
              <span>
                Food Donations
              </span>

              <strong>
                {summary.donations}
              </strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="card-icon">
              📋
            </div>

            <div>
              <span>
                Food Requests
              </span>

              <strong>
                {summary.requests}
              </strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="card-icon">
              🚚
            </div>

            <div>
              <span>
                Deliveries
              </span>

              <strong>
                {summary.deliveries}
              </strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="card-icon">
              👥
            </div>

            <div>
              <span>
                Volunteers
              </span>

              <strong>
                {summary.volunteers}
              </strong>
            </div>

          </div>

        </section>

        {/* ==================================================
            DONATIONS + NGO VERIFICATION
        ================================================== */}

        <section className="dashboard-grid">

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

              <select
                className="dashboard-filter"
                value={
                  donationCategoryFilter
                }
                onChange={(e) =>
                  setDonationCategoryFilter(
                    e.target.value
                  )
                }
              >

                <option value="all">
                  All Categories
                </option>

                {donationCategories.map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  )
                )}

              </select>

            </div>

            {dashboard
              .donations_by_category
              .length === 0 ? (

              <p className="empty-message">
                No donation data available.
              </p>

            ) : filteredDonationsByCategory.length ===
              0 ? (

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

                <span>
                  ✓
                </span>

                <div>

                  <strong>
                    {
                      dashboard
                        .ngo_verification
                        .verified
                    }
                  </strong>

                  <small>
                    Verified NGOs
                  </small>

                </div>

              </div>

              <div className="verification-box pending">

                <span>
                  !
                </span>

                <div>

                  <strong>
                    {
                      dashboard
                        .ngo_verification
                        .pending
                    }
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

            <select
              className="dashboard-filter"
              value={ngoFilter}
              onChange={(e) =>
                setNgoFilter(
                  e.target.value
                )
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

          {ngoActionMessage && (

            <div className="ngo-action-message">
              {ngoActionMessage}
            </div>

          )}

          {ngos.length === 0 ? (

            <div className="empty-state">

              <div>
                🤝
              </div>

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

                    {filteredNgos.map(
                      (ngo) => (

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
                                  ngoLoading ===
                                  ngo.id
                                }
                                onClick={() =>
                                  handleNgoVerification(
                                    ngo.id,
                                    false
                                  )
                                }
                              >

                                {ngoLoading ===
                                ngo.id
                                  ? "Updating..."
                                  : "Set Pending"}

                              </button>

                            ) : (

                              <button
                                className="ngo-action-button verify-button"
                                disabled={
                                  ngoLoading ===
                                  ngo.id
                                }
                                onClick={() =>
                                  handleNgoVerification(
                                    ngo.id,
                                    true
                                  )
                                }
                              >

                                {ngoLoading ===
                                ngo.id
                                  ? "Verifying..."
                                  : "Verify NGO"}

                              </button>

                            )}

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              )}

            </div>

          )}

        </section>

        {/* ==================================================
            DONOR ACTIVITY
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

                  <th>
                    Donor
                  </th>

                  <th>
                    Total Donations
                  </th>

                  <th>
                    Total Quantity
                  </th>

                </tr>

              </thead>

              <tbody>

                {dashboard
                  .donations_by_donor
                  .map(
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

            {dashboard.requests_by_ngo.length ===
            0 ? (

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

            {dashboard.volunteer_workload.length ===
            0 ? (

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
                            {
                              volunteer
                                .availability_status
                            }
                          </small>

                        </div>

                      </div>

                      <span className="delivery-count">
                        {
                          volunteer.total_deliveries
                        } deliveries
                      </span>

                    </div>

                  )
                )}

              </div>

            )}

          </div>

        </section>

        {/* ==================================================
            DELIVERY ASSIGNMENT
        ================================================== */}

        <section
          className="dashboard-card delivery-assignment-card"
          id="delivery-assignment"
        >

          <div className="section-heading">

            <div>

              <span className="section-label">
                DELIVERY MANAGEMENT
              </span>

              <h2>
                Assign Food Delivery
              </h2>

              <p>
                Assign an unassigned food request to an available
                volunteer and recipient.
              </p>

            </div>

            <button
              type="button"
              className="delivery-refresh-button"
              onClick={loadDeliveryOptions}
              disabled={
                deliveryLoading ||
                assignmentLoading
              }
            >
              {deliveryLoading
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

          </div>

          {deliveryMessage && (

            <div className="delivery-success-message">
              <span>✓</span>
              {deliveryMessage}
            </div>

          )}

          {deliveryError && (

            <div className="delivery-error-message">
              <span>!</span>
              {deliveryError}
            </div>

          )}

          {deliveryLoading ? (

            <div className="delivery-loading-state">

              <div className="loading-spinner"></div>

              <p>
                Loading delivery options...
              </p>

            </div>

          ) : deliveryRequests.length === 0 ? (

            <div className="delivery-empty-state">

              <div className="delivery-empty-icon">
                ✓
              </div>

              <h3>
                No food requests waiting for assignment
              </h3>

              <p>
                All currently available food requests already
                have delivery assignments, or there are no
                pending requests yet.
              </p>

            </div>

          ) : (

            <div className="delivery-assignment-content">

              {/* ==========================================
                  REQUEST
              ========================================== */}

              <div className="delivery-form-group">

                <label htmlFor="delivery-request">
                  Food Request
                </label>

                <select
                  id="delivery-request"
                  className="delivery-select"
                  value={selectedRequestId}
                  onChange={(e) => {
                    setSelectedRequestId(
                      e.target.value
                    );

                    setDeliveryMessage("");
                    setDeliveryError("");
                  }}
                  disabled={
                    assignmentLoading
                  }
                >

                  <option value="">
                    Select a food request
                  </option>

                  {deliveryRequests.map(
                    (request) => (

                      <option
                        key={request.request_id}
                        value={request.request_id}
                      >
                        #{request.request_id} —{" "}
                        {request.food_name} —{" "}
                        {request.ngo_name}
                      </option>

                    )
                  )}

                </select>

                {selectedRequest && (

                  <div className="selected-request-card">

                    <div className="selected-request-icon">
                      🍱
                    </div>

                    <div className="selected-request-details">

                      <strong>
                        {selectedRequest.food_name}
                      </strong>

                      <span>
                        NGO: {selectedRequest.ngo_name}
                      </span>

                      <span>
                        Quantity:{" "}
                        {selectedRequest.requested_qty}
                        {selectedRequest.unit
                          ? ` ${selectedRequest.unit}`
                          : ""}
                      </span>

                      <span>
                        Donor:{" "}
                        {selectedRequest.donor_name}
                      </span>

                    </div>

                    <span className="request-pending-badge">
                      {selectedRequest.request_status}
                    </span>

                  </div>

                )}

              </div>

              {/* ==========================================
                  VOLUNTEER
              ========================================== */}

              <div className="delivery-form-group">

                <label htmlFor="delivery-volunteer">
                  Available Volunteer
                </label>

                <select
                  id="delivery-volunteer"
                  className="delivery-select"
                  value={selectedVolunteerId}
                  onChange={(e) => {
                    setSelectedVolunteerId(
                      e.target.value
                    );

                    setDeliveryMessage("");
                    setDeliveryError("");
                  }}
                  disabled={
                    assignmentLoading ||
                    availableVolunteers.length === 0
                  }
                >

                  <option value="">
                    {availableVolunteers.length === 0
                      ? "No available volunteers"
                      : "Select a volunteer"}
                  </option>

                  {availableVolunteers.map(
                    (volunteer) => (

                      <option
                        key={volunteer.id}
                        value={volunteer.id}
                      >
                        {volunteer.full_name}
                        {" — "}
                        {volunteer.vehicle_type ||
                          "No vehicle specified"}
                      </option>

                    )
                  )}

                </select>

                {selectedVolunteerId && (

                  <div className="selected-volunteer-card">

                    {(() => {
                      const volunteer =
                        availableVolunteers.find(
                          (item) =>
                            String(item.id) ===
                            selectedVolunteerId
                        );

                      if (!volunteer) {
                        return null;
                      }

                      return (
                        <>
                          <div className="assignment-avatar">
                            {volunteer.full_name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>

                            <strong>
                              {volunteer.full_name}
                            </strong>

                            <span>
                              {volunteer.phone}
                            </span>

                            <span>
                              {volunteer.vehicle_type ||
                                "Vehicle not specified"}
                            </span>

                          </div>

                          <span className="available-badge">
                            Available
                          </span>
                        </>
                      );
                    })()}

                  </div>

                )}

              </div>

              {/* ==========================================
                  RECIPIENT
              ========================================== */}

              <div className="delivery-form-group">

                <label htmlFor="delivery-recipient">
                  Recipient
                </label>

                <select
                  id="delivery-recipient"
                  className="delivery-select"
                  value={selectedRecipientId}
                  onChange={(e) => {
                    setSelectedRecipientId(
                      e.target.value
                    );

                    setDeliveryMessage("");
                    setDeliveryError("");
                  }}
                  disabled={
                    assignmentLoading ||
                    !selectedRequestId ||
                    recipientLoading ||
                    deliveryRecipients.length === 0
                  }
                >

                  <option value="">
                    {!selectedRequestId
                      ? "Select a food request first"
                      : recipientLoading
                      ? "Loading recipients..."
                      : deliveryRecipients.length === 0
                      ? "No recipients found for this NGO"
                      : "Select a recipient"}
                  </option>

                  {deliveryRecipients.map(
                    (recipient) => (

                      <option
                        key={recipient.id}
                        value={recipient.id}
                      >
                        #{recipient.recipient_no} —{" "}
                        {recipient.full_name}
                      </option>

                    )
                  )}

                </select>

                {selectedRecipientId && (

                  <div className="selected-recipient-card">

                    {(() => {
                      const recipient =
                        deliveryRecipients.find(
                          (item) =>
                            String(item.id) ===
                            selectedRecipientId
                        );

                      if (!recipient) {
                        return null;
                      }

                      return (
                        <>
                          <div className="assignment-avatar recipient-avatar">
                            {recipient.full_name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>

                            <strong>
                              {recipient.full_name}
                            </strong>

                            <span>
                              Recipient #
                              {recipient.recipient_no}
                            </span>

                            <span>
                              {recipient.phone ||
                                "Phone not available"}
                            </span>

                            <span>
                              {recipient.address ||
                                "Address not available"}
                            </span>

                          </div>

                        </>
                      );
                    })()}

                  </div>

                )}

              </div>

            </div>

          )}

          {deliveryRequests.length > 0 && (

            <div className="delivery-assignment-footer">

              <div className="delivery-assignment-info">

                <span className="assignment-info-icon">
                  i
                </span>

                <p>
                  Assigning a delivery will approve the food
                  request and mark the selected volunteer as
                  <strong> Busy</strong>.
                </p>

              </div>

              <button
                type="button"
                className="assign-delivery-button"
                onClick={handleAssignDelivery}
                disabled={
                  assignmentLoading ||
                  deliveryLoading ||
                  !selectedRequestId ||
                  !selectedVolunteerId ||
                  !selectedRecipientId
                }
              >

                {assignmentLoading
                  ? "Assigning Delivery..."
                  : "🚚 Assign Delivery"}

              </button>

            </div>

          )}

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

            <select
              className="dashboard-filter"
              value={deliveryStatusFilter}
              onChange={(e) =>
                setDeliveryStatusFilter(
                  e.target.value
                )
              }
            >

              <option value="all">
                All Delivery Statuses
              </option>

              {deliveryStatuses.map(
                (status) => (

                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>

                )
              )}

            </select>

          </div>

          {dashboard
            .deliveries_by_status
            .length === 0 ? (

            <div className="empty-state">

              <div>
                🚚
              </div>

              <h3>
                No deliveries yet
              </h3>

              <p>
                Delivery statistics will appear here once
                food requests are assigned for delivery.
              </p>

            </div>

          ) : filteredDeliveryStatuses.length ===
            0 ? (

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

            <select
              className="dashboard-filter"
              value={requestStatusFilter}
              onChange={(e) =>
                setRequestStatusFilter(
                  e.target.value
                )
              }
            >

              <option value="all">
                All Request Statuses
              </option>

              {requestStatuses.map(
                (status) => (

                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>

                )
              )}

            </select>

          </div>

          {dashboard.request_details.length ===
          0 ? (

            <div className="empty-state">

              <div>
                📋
              </div>

              <h3>
                No requests yet
              </h3>

              <p>
                Food requests from NGOs will appear here.
              </p>

            </div>

          ) : filteredRequestDetails.length ===
            0 ? (

            <p className="empty-message">
              No requests match this status.
            </p>

          ) : (

            <div className="table-wrapper">

              <table>

                <thead>

                  <tr>

                    <th>
                      Donor
                    </th>

                    <th>
                      Food
                    </th>

                    <th>
                      NGO
                    </th>

                    <th>
                      Quantity
                    </th>

                    <th>
                      Status
                    </th>

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
                            {
                              request
                                .request_status
                            }
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
            DATABASE FEATURES
        ================================================== */}

        <section className="database-features-section">

          <div className="dashboard-card database-features-card">

            <div className="section-heading database-section-heading">

              <div>

                <span className="section-label">
                  DATABASE IMPLEMENTATION
                </span>

                <h2>
                  SQL View & Stored Procedure
                </h2>

                <p>
                  Live output from the database objects used
                  by the admin dashboard.
                </p>

              </div>

            </div>

            <div className="database-features-grid">

              <div className="database-feature-card database-output-card">

                <div className="database-feature-top">

                  <div className="database-feature-icon">
                    VIEW
                  </div>

                  <div className="database-feature-content">

                    <span className="database-feature-label">
                      DATABASE VIEW
                    </span>

                    <h3>
                      {
                        dashboard
                          .database_features
                          ?.view_name ||
                        "admin_donation_summary"
                      }
                    </h3>

                  </div>

                </div>

                <p className="database-feature-description">

                  {
                    dashboard
                      .database_features
                      ?.view_description ||
                    "Groups food donations by category and calculates the total donation count and quantity."
                  }

                </p>

                <div className="database-output-title">

                  <span>
                    VIEW OUTPUT
                  </span>

                  <small>
                    Live database result
                  </small>

                </div>

                {dashboard
                  .donations_by_category
                  .length > 0 ? (

                  <div className="database-output-table-wrapper">

                    <table className="database-output-table">

                      <thead>

                        <tr>

                          <th>
                            Food Category
                          </th>

                          <th>
                            Donations
                          </th>

                          <th>
                            Quantity
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {dashboard
                          .donations_by_category
                          .map(
                            (
                              item,
                              index
                            ) => (

                              <tr
                                key={`${item.food_category}-${index}`}
                              >

                                <td>

                                  <span className="database-category-name">
                                    🍽️{" "}
                                    {
                                      item.food_category
                                    }
                                  </span>

                                </td>

                                <td>
                                  {
                                    item.total_donations
                                  }
                                </td>

                                <td>
                                  {
                                    item.total_quantity
                                  }
                                </td>

                              </tr>

                            )
                          )}

                      </tbody>

                    </table>

                  </div>

                ) : (

                  <div className="database-empty">
                    No View output available.
                  </div>

                )}

                <div className="database-feature-status">

                  <span>
                    ✓
                  </span>

                  View executed successfully

                </div>

              </div>

              <div className="database-feature-card database-output-card">

                <div className="database-feature-top">

                  <div className="database-feature-icon procedure-icon">
                    SQL
                  </div>

                  <div className="database-feature-content">

                    <span className="database-feature-label">
                      STORED PROCEDURE
                    </span>

                    <h3>
                      {
                        dashboard
                          .database_features
                          ?.procedure_name ||
                        "get_admin_summary()"
                      }
                    </h3>

                  </div>

                </div>

                <p className="database-feature-description">

                  {
                    dashboard
                      .database_features
                      ?.procedure_description ||
                    "Returns the total donors, NGOs, volunteers, donations, requests, deliveries and recipients."
                  }

                </p>

                <div className="database-output-title">

                  <span>
                    PROCEDURE OUTPUT
                  </span>

                  <small>
                    Live database result
                  </small>

                </div>

                <div className="procedure-output-grid">

                  <div className="procedure-output-item">

                    <span>
                      Donors
                    </span>

                    <strong>
                      {dashboard.summary.donors}
                    </strong>

                  </div>

                  <div className="procedure-output-item">

                    <span>
                      NGOs
                    </span>

                    <strong>
                      {dashboard.summary.ngos}
                    </strong>

                  </div>

                  <div className="procedure-output-item">

                    <span>
                      Volunteers
                    </span>

                    <strong>
                      {dashboard.summary.volunteers}
                    </strong>

                  </div>

                  <div className="procedure-output-item">

                    <span>
                      Donations
                    </span>

                    <strong>
                      {dashboard.summary.donations}
                    </strong>

                  </div>

                  <div className="procedure-output-item">

                    <span>
                      Requests
                    </span>

                    <strong>
                      {dashboard.summary.requests}
                    </strong>

                  </div>

                  <div className="procedure-output-item">

                    <span>
                      Deliveries
                    </span>

                    <strong>
                      {dashboard.summary.deliveries}
                    </strong>

                  </div>

                  <div className="procedure-output-item">

                    <span>
                      Recipients
                    </span>

                    <strong>
                      {dashboard.summary.recipients}
                    </strong>

                  </div>

                </div>

                <div className="database-feature-status">

                  <span>
                    ✓
                  </span>

                  Stored procedure executed successfully

                </div>

              </div>

            </div>

          </div>

        </section>

        {/* ==================================================
            TRANSACTION DEMO
        ================================================== */}

        <section className="transaction-section">

          <div className="dashboard-card transaction-card">

            <div className="section-heading">

              <div>

                <span className="section-label">
                  DATABASE TRANSACTIONS
                </span>

                <h2>
                  Transaction & Rollback Demonstration
                </h2>

                <p>
                  Demonstrates raw SQL transaction control using
                  SAVEPOINT, partial rollback, COMMIT and full
                  ROLLBACK operations.
                </p>

              </div>

              <button
                className="transaction-run-button"
                onClick={runTransactionDemo}
                disabled={transactionLoading}
              >

                {transactionLoading
                  ? "Running..."
                  : "▶ Run Transaction Demo"}

              </button>

            </div>

            {transactionError && (

              <div className="transaction-error">
                {transactionError}
              </div>

            )}

            {transactionDemo && (

              <div className="transaction-result">

                <div className="transaction-result-header">

                  <div>

                    <span className="section-label">
                      EXECUTION RESULT
                    </span>

                    <h3>
                      Raw SQL Transaction Result
                    </h3>

                  </div>

                  {transactionDemo.success && (

                    <span className="transaction-success-badge">
                      ✓ Success
                    </span>

                  )}

                </div>

                <div className="transaction-final-result">

                  <span>
                    Final committed rows
                  </span>

                  <strong>
                    {
                      transactionDemo
                        .final_rows
                        .length
                    }
                  </strong>

                </div>

                {transactionDemo
                  .final_rows
                  .length > 0 ? (

                  <div className="transaction-final-table-wrapper">

                    <table className="transaction-final-table">

                      <thead>

                        <tr>

                          <th>
                            ID
                          </th>

                          <th>
                            Committed Data
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {transactionDemo
                          .final_rows
                          .map(
                            (row) => (

                              <tr
                                key={row.id}
                              >

                                <td>
                                  {row.id}
                                </td>

                                <td>
                                  {row.action_name}
                                </td>

                              </tr>

                            )
                          )}

                      </tbody>

                    </table>

                  </div>

                ) : (

                  <div className="transaction-empty">

                    <p>
                      No committed rows returned.
                    </p>

                  </div>

                )}

              </div>

            )}

            {!transactionDemo &&
              !transactionLoading && (

                <div className="transaction-empty">

                  <div className="transaction-empty-icon">
                    SQL
                  </div>

                  <p>
                    Run the demonstration to view the live
                    transaction execution results.
                  </p>

                </div>

              )}

          </div>

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