-- FoodBridge Volunteer delivery database features
-- Run against the configured MySQL foodbridge_db database.
-- Laravel's migration installs the same objects without DELIMITER commands.

-- ============================================================
-- 1. VIEW: one row per assigned delivery with dashboard details
-- ============================================================
CREATE OR REPLACE VIEW volunteer_delivery_details AS
SELECT
    d.id AS delivery_id,
    d.request_id,
    d.volunteer_id,
    v.user_id AS volunteer_user_id,
    v.full_name AS volunteer_name,
    v.email AS volunteer_email,
    v.phone AS volunteer_phone,
    n.id AS ngo_id,
    n.ngo_name,
    n.email AS ngo_email,
    n.phone AS ngo_phone,
    n.address AS ngo_address,
    fd.id AS donation_id,
    fd.food_name,
    fd.food_category,
    fr.requested_qty AS quantity,
    fd.unit,
    donor.donor_name AS pickup_contact,
    donor.phone AS pickup_phone,
    donor.address AS pickup_address,
    (SELECT r.full_name FROM recipients r WHERE r.ngo_id = n.id ORDER BY r.id LIMIT 1) AS recipient_name,
    (SELECT r.phone FROM recipients r WHERE r.ngo_id = n.id ORDER BY r.id LIMIT 1) AS recipient_phone,
    (SELECT r.address FROM recipients r WHERE r.ngo_id = n.id ORDER BY r.id LIMIT 1) AS destination_address,
    (SELECT r.household_size FROM recipients r WHERE r.ngo_id = n.id ORDER BY r.id LIMIT 1) AS household_size,
    d.pickup_time,
    d.delivery_status,
    d.delivered_at,
    fr.request_status,
    d.created_at,
    d.updated_at
FROM deliveries d
JOIN volunteers v ON v.id = d.volunteer_id
JOIN food_requests fr ON fr.id = d.request_id
JOIN ngos n ON n.id = fr.ngo_id
JOIN food_donations fd ON fd.id = fr.donation_id
JOIN donors donor ON donor.id = fd.donor_id;

-- ============================================================
-- 2. TRIGGER: automatic delivery status audit/history
-- ============================================================
DROP TRIGGER IF EXISTS log_volunteer_delivery_status_change;
DELIMITER $$
CREATE TRIGGER log_volunteer_delivery_status_change
AFTER UPDATE ON deliveries
FOR EACH ROW
BEGIN
    IF NOT (OLD.delivery_status <=> NEW.delivery_status) THEN
        INSERT INTO delivery_updates
            (delivery_id, update_status, update_time, location_note, updated_by, created_at, updated_at)
        VALUES
            (NEW.id, NEW.delivery_status, CURRENT_TIMESTAMP, NULL, 'volunteer', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    END IF;
END$$
DELIMITER ;

-- ============================================================
-- 3. STORED PROCEDURE + 4. REAL TRANSACTION/ROLLBACK
-- The transaction locks the delivery, validates ownership and
-- transition, updates all related rows, lets the trigger audit,
-- then commits. Any SQL exception rolls everything back.
-- ============================================================
DROP PROCEDURE IF EXISTS update_volunteer_delivery_status;
DELIMITER $$
CREATE PROCEDURE update_volunteer_delivery_status(
    IN p_delivery_id BIGINT UNSIGNED,
    IN p_volunteer_id BIGINT UNSIGNED,
    IN p_new_status VARCHAR(50)
)
BEGIN
    DECLARE v_current_status VARCHAR(50);
    DECLARE v_owner_id BIGINT UNSIGNED;
    DECLARE v_request_id BIGINT UNSIGNED;
    DECLARE v_found BOOLEAN DEFAULT TRUE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    BEGIN
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_found = FALSE;
        SELECT volunteer_id, request_id, delivery_status
          INTO v_owner_id, v_request_id, v_current_status
          FROM deliveries
         WHERE id = p_delivery_id
         FOR UPDATE;
    END;

    IF v_found = FALSE THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Delivery not found.';
    END IF;
    IF v_owner_id IS NULL OR v_owner_id <> p_volunteer_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This delivery is not assigned to the authenticated volunteer.';
    END IF;
    IF p_new_status NOT IN ('picked_up', 'in_transit', 'delivered') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unsupported delivery status.';
    END IF;
    IF NOT (
        (v_current_status = 'pending' AND p_new_status = 'picked_up') OR
        (v_current_status = 'picked_up' AND p_new_status = 'in_transit') OR
        (v_current_status = 'in_transit' AND p_new_status = 'delivered')
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid delivery status transition.';
    END IF;

    UPDATE deliveries
       SET delivery_status = p_new_status,
           pickup_time = CASE WHEN p_new_status = 'picked_up' AND pickup_time IS NULL THEN CURRENT_TIMESTAMP ELSE pickup_time END,
           delivered_at = CASE WHEN p_new_status = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = p_delivery_id;

    UPDATE food_requests
       SET request_status = CASE WHEN p_new_status = 'delivered' THEN 'completed' ELSE 'in_progress' END,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = v_request_id;

    UPDATE volunteers
       SET availability_status = CASE WHEN p_new_status = 'delivered' THEN 'Available' ELSE 'Busy' END,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = p_volunteer_id;

    COMMIT;
    SELECT p_delivery_id AS delivery_id,
           p_new_status AS delivery_status,
           'Delivery status updated successfully.' AS message;
END$$
DELIMITER ;

-- Example parameterized application call:
-- CALL update_volunteer_delivery_status(?, ?, ?);

-- Evidence / inspection commands:
-- SHOW CREATE VIEW volunteer_delivery_details;
-- SHOW CREATE PROCEDURE update_volunteer_delivery_status;
-- SHOW TRIGGERS FROM foodbridge_db;
