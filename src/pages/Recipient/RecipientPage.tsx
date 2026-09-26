import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./RecipientPage.css";

type Recipient = {
  recipient_id: number;
  ngo_id: number;
  recipient_no: number;
  full_name: string;
  address: string;
  phone: string;
  household_size: number;
  ngo_name: string;
  delivery_count: number;
  latest_delivery_status: string | null;
};

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

type RecipientForm = {
  ngo_id: string;
  full_name: string;
  address: string;
  phone: string;
  household_size: string;
};

type NgoOption = { id: number; ngo_name: string; address: string | null };

const API_URL = "http://127.0.0.1:8000/api";
const emptyForm: RecipientForm = { ngo_id: "", full_name: "", address: "", phone: "", household_size: "" };

const apiError = (data: { message?: string; errors?: Record<string, string[]> }) =>
  (data.errors && Object.values(data.errors).flat()[0]) || data.message || "Something went wrong.";

const displayStatus = (status: string | null) =>
  status ? status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "No deliveries";

const displayDate = (value: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export default function RecipientPage() {
  const navigate = useNavigate();
  const isRecipientAccount = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null")?.role === "recipient";
    } catch {
      return false;
    }
  })();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [ngos, setNgos] = useState<NgoOption[]>([]);
  const [form, setForm] = useState<RecipientForm>(emptyForm);
  const [editingNumber, setEditingNumber] = useState<number | null>(null);
  const [expandedNumber, setExpandedNumber] = useState<number | null>(null);
  const [deliveries, setDeliveries] = useState<Record<number, Delivery[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const headers = (json = false) => ({
    ...(json ? { "Content-Type": "application/json" } : {}),
    Accept: "application/json",
    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
  });

  const loadRecipients = async () => {
    const endpoint = isRecipientAccount ? "/recipient/profile" : "/ngo/recipients";
    const response = await fetch(`${API_URL}${endpoint}`, { headers: headers() });
    if (response.status === 401) {
      localStorage.clear();
      navigate("/login", { replace: true });
      return;
    }
    const data = await response.json();
    if (!response.ok) throw new Error(apiError(data));
    if (isRecipientAccount) {
      setRecipients(data.data ? [data.data] : []);
      if (data.data) {
        setForm({
          ngo_id: String(data.data.ngo_id),
          full_name: data.data.full_name,
          address: data.data.address,
          phone: data.data.phone,
          household_size: String(data.data.household_size),
        });
      } else {
        setForm((current) => ({
          ...current,
          full_name: current.full_name || data.user?.name || "",
          phone: current.phone || data.user?.phone || "",
        }));
      }
    } else {
      setRecipients(data.data);
    }
  };

  useEffect(() => {
    const initialLoad = async () => {
      await loadRecipients();
      if (isRecipientAccount) {
        const response = await fetch(`${API_URL}/recipient/ngos`, { headers: headers() });
        const data = await response.json();
        if (!response.ok) throw new Error(apiError(data));
        setNgos(data.data);
      }
    };

    initialLoad()
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load recipients."))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const hasRecipientProfile = isRecipientAccount && recipients.length > 0;
      const url = isRecipientAccount
        ? `${API_URL}/recipient/profile`
        : editingNumber
          ? `${API_URL}/ngo/recipients/${editingNumber}`
          : `${API_URL}/ngo/recipients`;
      const payload = {
        full_name: form.full_name,
        address: form.address,
        phone: form.phone,
        household_size: Number(form.household_size),
        ...((isRecipientAccount && !hasRecipientProfile) ? { ngo_id: Number(form.ngo_id) } : {}),
      };
      const response = await fetch(url, {
        method: isRecipientAccount ? (hasRecipientProfile ? "PATCH" : "POST") : editingNumber ? "PATCH" : "POST",
        headers: headers(true),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(apiError(data));

      setSuccess(data.message);
      setEditingNumber(null);
      if (!isRecipientAccount) setForm(emptyForm);
      await loadRecipients();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save recipient.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (recipient: Recipient) => {
    setEditingNumber(recipient.recipient_no);
    setForm({
      ngo_id: String(recipient.ngo_id),
      full_name: recipient.full_name,
      address: recipient.address,
      phone: recipient.phone,
      household_size: String(recipient.household_size),
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleDeliveries = async (recipientNo: number) => {
    if (expandedNumber === recipientNo) {
      setExpandedNumber(null);
      return;
    }

    setExpandedNumber(recipientNo);
    if (deliveries[recipientNo]) return;

    setDeliveryLoading(recipientNo);
    setError("");
    try {
      const endpoint = isRecipientAccount
        ? "/recipient/deliveries"
        : `/ngo/recipients/${recipientNo}/deliveries`;
      const response = await fetch(`${API_URL}${endpoint}`, { headers: headers() });
      const data = await response.json();
      if (!response.ok) throw new Error(apiError(data));
      setDeliveries((current) => ({ ...current, [recipientNo]: data.data }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load deliveries.");
    } finally {
      setDeliveryLoading(null);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/logout`, { method: "POST", headers: headers() });
    } finally {
      localStorage.clear();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="recipient-page">
      <header className="recipient-header">
        <Link to="/" className="recipient-brand">FoodBridge</Link>
        <button type="button" onClick={logout}>Log out</button>
      </header>

      <main className="recipient-main">
        <section className="recipient-intro">
          <p className="recipient-kicker">{isRecipientAccount ? "YOUR RECIPIENT PROFILE" : "NGO RECIPIENT REGISTRY"}</p>
          <h1>Recipient Management</h1>
          <p>{isRecipientAccount ? "Complete your profile and review deliveries associated with your account." : "Register food recipients, maintain their details, and review the deliveries associated with them."}</p>
        </section>

        <section className="recipient-form-card">
          <div className="recipient-section-heading">
            <div>
              <p className="recipient-kicker">{editingNumber ? `EDIT RECIPIENT #${editingNumber}` : isRecipientAccount ? "PROFILE COMPLETION" : "REGISTER A RECIPIENT"}</p>
              <h2>{editingNumber || (isRecipientAccount && recipients.length > 0) ? "Update recipient details" : isRecipientAccount ? "Complete your recipient profile" : "Add someone to your registry"}</h2>
            </div>
            {editingNumber && !isRecipientAccount && <button className="recipient-secondary" type="button" onClick={() => { setEditingNumber(null); setForm(emptyForm); }}>Cancel edit</button>}
          </div>

          <form onSubmit={submit}>
            <div className="recipient-form-grid">
              {isRecipientAccount && recipients.length === 0 && (
                <label className="recipient-wide">Verified NGO
                  <select value={form.ngo_id} onChange={(e) => setForm({ ...form, ngo_id: e.target.value })} required>
                    <option value="">Select the NGO supporting you</option>
                    {ngos.map((ngo) => <option key={ngo.id} value={ngo.id}>{ngo.ngo_name}{ngo.address ? ` — ${ngo.address}` : ""}</option>)}
                  </select>
                </label>
              )}
              <label>Full name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
              <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></label>
              <label className="recipient-wide">Address<textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></label>
              <label>Household size<input type="number" min="1" step="1" value={form.household_size} onChange={(e) => setForm({ ...form, household_size: e.target.value })} required /></label>
            </div>
            <div className="recipient-actions">
              <button className="recipient-primary" type="submit" disabled={saving}>{saving ? "Saving..." : editingNumber || (isRecipientAccount && recipients.length > 0) ? "Save changes" : isRecipientAccount ? "Complete profile" : "Register recipient"}</button>
              <div aria-live="polite">{success && <p className="recipient-success">{success}</p>}{error && <p className="recipient-error">{error}</p>}</div>
            </div>
          </form>
        </section>

        <section className="recipient-list-section">
          <div className="recipient-list-heading">
            <div><p className="recipient-kicker">YOUR COMMUNITY</p><h2>Registered Recipients</h2></div>
            <p>{recipients.length} {recipients.length === 1 ? "recipient" : "recipients"}</p>
          </div>

          {loading ? (
            <div className="recipient-state">Loading recipients…</div>
          ) : recipients.length === 0 ? (
            <div className="recipient-state"><h3>No recipients registered yet</h3><p>Use the form above to register your first recipient.</p></div>
          ) : (
            <div className="recipient-grid">
              {recipients.map((recipient) => (
                <article className="recipient-card" key={recipient.recipient_id}>
                  <div className="recipient-card-title"><div><span>Recipient #{recipient.recipient_no}</span><h3>{recipient.full_name}</h3></div><span className="recipient-status">{displayStatus(recipient.latest_delivery_status)}</span></div>
                  <dl>
                    <div><dt>Phone</dt><dd>{recipient.phone}</dd></div>
                    <div><dt>Household</dt><dd>{recipient.household_size} people</dd></div>
                    <div className="recipient-wide"><dt>Address</dt><dd>{recipient.address}</dd></div>
                    <div><dt>NGO</dt><dd>{recipient.ngo_name}</dd></div>
                    <div><dt>Deliveries</dt><dd>{recipient.delivery_count}</dd></div>
                  </dl>
                  <div className="recipient-card-actions">
                    <button type="button" onClick={() => startEdit(recipient)}>Edit</button>
                    <button type="button" onClick={() => toggleDeliveries(recipient.recipient_no)}>{expandedNumber === recipient.recipient_no ? "Hide deliveries" : "View deliveries"}</button>
                  </div>

                  {expandedNumber === recipient.recipient_no && (
                    <div className="recipient-deliveries">
                      {deliveryLoading === recipient.recipient_no ? <p>Loading deliveries…</p> : (deliveries[recipient.recipient_no] || []).length === 0 ? <p>No deliveries are linked to this recipient yet.</p> : deliveries[recipient.recipient_no].map((delivery) => (
                        <div className="recipient-delivery" key={delivery.delivery_id}>
                          <div><strong>Delivery #{delivery.delivery_id}</strong><span>{displayStatus(delivery.delivery_status)}</span></div>
                          <p>{delivery.food_name} · {delivery.quantity} {delivery.unit}</p>
                          <small>Request #{delivery.request_id} · Volunteer: {delivery.volunteer_name || "Not assigned"}</small>
                          <small>Pickup: {displayDate(delivery.pickup_time)} · Delivered: {displayDate(delivery.delivered_at)}</small>
                          {Boolean(delivery.can_submit_feedback) && (
                            <Link
                              className="recipient-feedback-button"
                              to={`/feedback/${delivery.delivery_id}`}
                            >
                              Give Feedback
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
