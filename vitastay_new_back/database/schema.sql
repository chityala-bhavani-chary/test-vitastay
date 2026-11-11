-- Vita Stay Hostel Management ERP - Complete Database Schema
-- MySQL 8.0+

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS nivas_hostel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nivas_hostel;

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'owner', 'supervisor', 'tenant', 'staff', 'seeker') NOT NULL DEFAULT 'tenant',
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  avatar VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  is_locked BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login DATETIME,
  password_changed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  INDEX idx_users_role (role),
  INDEX idx_users_email (email),
  INDEX idx_users_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(500) NOT NULL UNIQUE,
  device_info VARCHAR(500),
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at DATETIME NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id),
  INDEX idx_refresh_token (token),
  INDEX idx_refresh_expires (expires_at)
) ENGINE=InnoDB;

CREATE TABLE login_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  ip_address VARCHAR(45),
  device_info VARCHAR(500),
  user_agent TEXT,
  status ENUM('success', 'failed', 'locked') NOT NULL,
  failure_reason VARCHAR(255),
  login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_login_user (user_id),
  INDEX idx_login_at (login_at)
) ENGINE=InnoDB;

CREATE TABLE otp_verifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  otp VARCHAR(10) NOT NULL,
  type ENUM('password_reset', 'email_verify', 'login', 'phone_verify') NOT NULL,
  expires_at DATETIME NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_email (email),
  INDEX idx_otp_phone (phone),
  INDEX idx_otp_expires (expires_at)
) ENGINE=InnoDB;

-- =====================================================
-- PERMISSIONS
-- =====================================================

CREATE TABLE permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role ENUM('super_admin', 'owner', 'supervisor', 'tenant', 'staff', 'seeker') NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE KEY uk_role_permission (role, permission_id)
) ENGINE=InnoDB;

-- =====================================================
-- HOSTELS
-- =====================================================

CREATE TABLE hostels (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  description TEXT,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  area VARCHAR(120),
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  country VARCHAR(100) DEFAULT 'India',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  total_floors INT DEFAULT 1,
  capacity INT DEFAULT 0,
  amenities JSON,
  features JSON,
  electricity_charge DECIMAL(10, 2) DEFAULT 0,
  water_charge DECIMAL(10, 2) DEFAULT 0,
  security_deposit DECIMAL(10, 2) DEFAULT 0,
  notice_period_months INT DEFAULT 1,
  images JSON,
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  database_name VARCHAR(64),
  gender_policy ENUM('male', 'female', 'unisex') NOT NULL DEFAULT 'unisex',
  status ENUM('pending_approval', 'active', 'inactive', 'maintenance', 'on_hold', 'rejected') DEFAULT 'pending_approval',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  INDEX idx_hostel_owner (owner_id),
  INDEX idx_hostel_status (status),
  INDEX idx_hostel_city (city)
) ENGINE=InnoDB;

CREATE TABLE hostel_blocks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  total_floors INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  INDEX idx_block_hostel (hostel_id)
) ENGINE=InnoDB;

-- =====================================================
-- PROPERTY MEDIA (master DB listing gallery)
-- =====================================================
-- room_id is not a FK: occupancy rooms may live only in isolated hostel DBs.
-- room_number is denormalised for public listing cards.
-- cover_flag is a stand-in for a partial unique index (one live cover per hostel).
-- It does not reference hostel_id: MariaDB forbids FK columns in GENERATED ALWAYS AS.

CREATE TABLE property_media (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  category ENUM('exterior','interior_common','room','floor','panorama_360') NOT NULL,
  capture_kind ENUM('photo','panorama_360') NOT NULL DEFAULT 'photo',
  room_id INT UNSIGNED NULL,
  room_number VARCHAR(20) NULL,
  floor_number INT NULL,
  title VARCHAR(150) NULL,
  caption VARCHAR(200) NULL,
  file_path VARCHAR(500) NOT NULL,
  thumb_path VARCHAR(500) NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by INT UNSIGNED NOT NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cover_flag TINYINT UNSIGNED GENERATED ALWAYS AS (
    IF(is_cover = 1 AND deleted_at IS NULL, 1, NULL)
  ) VIRTUAL,
  INDEX idx_media_hostel_cat (hostel_id, category, deleted_at),
  INDEX idx_media_room (room_id),
  UNIQUE KEY uk_property_media_one_cover (hostel_id, cover_flag),
  UNIQUE KEY uk_property_media_hostel_path (hostel_id, file_path),
  CONSTRAINT fk_media_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  CONSTRAINT chk_property_media_room CHECK (category <> 'room' OR room_id IS NOT NULL),
  CONSTRAINT chk_property_media_floor CHECK (category <> 'floor' OR floor_number IS NOT NULL),
  CONSTRAINT chk_property_media_360 CHECK (category <> 'panorama_360' OR capture_kind = 'panorama_360')
) ENGINE=InnoDB;

-- =====================================================
-- ROOMS & BEDS
-- =====================================================

CREATE TABLE rooms (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  block_id INT UNSIGNED,
  room_number VARCHAR(20) NOT NULL,
  floor INT NOT NULL DEFAULT 1,
  room_type ENUM('single', 'double', 'triple', 'dormitory') NOT NULL,
  sharing_type INT DEFAULT 1,
  is_ac BOOLEAN DEFAULT FALSE,
  rent DECIMAL(10, 2) NOT NULL,
  status ENUM('occupied', 'vacant', 'maintenance', 'reserved') DEFAULT 'vacant',
  cleaning_status ENUM('clean', 'dirty', 'in_progress') DEFAULT 'clean',
  maintenance_status ENUM('none', 'pending', 'in_progress', 'completed') DEFAULT 'none',
  images JSON,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  FOREIGN KEY (block_id) REFERENCES hostel_blocks(id) ON DELETE SET NULL,
  UNIQUE KEY uk_room_hostel_number (hostel_id, room_number),
  INDEX idx_room_hostel (hostel_id),
  INDEX idx_room_status (status),
  INDEX idx_room_floor (floor)
) ENGINE=InnoDB;

CREATE TABLE beds (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id INT UNSIGNED NOT NULL,
  bed_number VARCHAR(10) NOT NULL,
  status ENUM('vacant', 'occupied', 'reserved', 'maintenance') DEFAULT 'vacant',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  UNIQUE KEY uk_bed_room_number (room_id, bed_number),
  INDEX idx_bed_room (room_id),
  INDEX idx_bed_status (status)
) ENGINE=InnoDB;

CREATE TABLE bed_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bed_id INT UNSIGNED NOT NULL,
  tenant_id INT UNSIGNED NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vacated_at DATETIME,
  status ENUM('active', 'vacated', 'transferred') DEFAULT 'active',
  notes TEXT,
  assigned_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bed_id) REFERENCES beds(id),
  INDEX idx_assignment_bed (bed_id),
  INDEX idx_assignment_tenant (tenant_id),
  INDEX idx_assignment_status (status)
) ENGINE=InnoDB;

-- =====================================================
-- TENANTS
-- =====================================================

CREATE TABLE tenants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  hostel_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED,
  bed_id INT UNSIGNED,
  employee_id VARCHAR(50),
  full_name VARCHAR(255),
  photo VARCHAR(500),
  date_of_birth DATE,
  gender ENUM('male', 'female', 'other'),
  blood_group VARCHAR(10),
  nationality VARCHAR(100) DEFAULT 'Indian',
  marital_status ENUM('single', 'married', 'divorced', 'widowed', 'other'),
  alternate_phone VARCHAR(20),
  permanent_address TEXT,
  current_address TEXT,
  same_as_permanent BOOLEAN DEFAULT TRUE,
  aadhar VARCHAR(20),
  pan VARCHAR(20),
  passport VARCHAR(20),
  driving_license VARCHAR(20),
  voter_id VARCHAR(30),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relation VARCHAR(50),
  emergency_contact_alternate VARCHAR(20),
  emergency_contact_address TEXT,
  guardian_name VARCHAR(100),
  guardian_phone VARCHAR(20),
  guardian_email VARCHAR(255),
  guardian_occupation VARCHAR(100),
  guardian_address TEXT,
  is_student BOOLEAN DEFAULT FALSE,
  company VARCHAR(255),
  college VARCHAR(255),
  medical_conditions TEXT,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  move_in_date DATE,
  move_out_date DATE,
  deposit_amount DECIMAL(10, 2) DEFAULT 0,
  advance_amount DECIMAL(10, 2) DEFAULT 0,
  monthly_rent DECIMAL(10, 2) DEFAULT 0,
  status ENUM('active', 'inactive', 'moved_out', 'pending') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE SET NULL,
  INDEX idx_tenant_hostel (hostel_id),
  INDEX idx_tenant_room (room_id),
  INDEX idx_tenant_status (status)
) ENGINE=InnoDB;

CREATE TABLE tenant_documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED NOT NULL,
  document_type ENUM('aadhar', 'pan', 'passport', 'driving_license', 'voter_id', 'rent_agreement', 'other') NOT NULL,
  title VARCHAR(255) NOT NULL,
  id_number VARCHAR(100),
  file_path VARCHAR(500) NOT NULL,
  back_file_path VARCHAR(500),
  expiry_date DATE,
  file_size INT,
  mime_type VARCHAR(100),
  uploaded_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tdoc_tenant (tenant_id)
) ENGINE=InnoDB;

-- Tenant holiday leave_requests was removed from the product (IMP-007 / most PGs do not use it).
-- Do not confuse with staff_leaves below.

-- =====================================================
-- STAFF
-- =====================================================

CREATE TABLE staff (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  hostel_id INT UNSIGNED NOT NULL,
  staff_role ENUM('reception', 'cleaner', 'security', 'cook', 'maintenance', 'other') NOT NULL,
  employee_id VARCHAR(50),
  salary DECIMAL(10, 2) DEFAULT 0,
  join_date DATE,
  address TEXT,
  emergency_contact VARCHAR(20),
  status ENUM('active', 'inactive', 'terminated') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  INDEX idx_staff_hostel (hostel_id),
  INDEX idx_staff_role (staff_role)
) ENGINE=InnoDB;

CREATE TABLE staff_attendance (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_id INT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status ENUM('present', 'absent', 'late', 'half_day', 'leave') DEFAULT 'present',
  late_minutes INT DEFAULT 0,
  remarks TEXT,
  marked_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  UNIQUE KEY uk_staff_date (staff_id, date),
  INDEX idx_attendance_date (date)
) ENGINE=InnoDB;

CREATE TABLE staff_leaves (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_id INT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type ENUM('casual', 'sick', 'earned', 'unpaid') DEFAULT 'casual',
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approved_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  INDEX idx_sleave_staff (staff_id)
) ENGINE=InnoDB;

-- =====================================================
-- FINANCE
-- =====================================================

CREATE TABLE rent_payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED NOT NULL,
  hostel_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED,
  amount DECIMAL(10, 2) NOT NULL,
  advance_amount DECIMAL(10, 2) DEFAULT 0,
  deposit_amount DECIMAL(10, 2) DEFAULT 0,
  penalty_amount DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) DEFAULT 0,
  due_date DATE NOT NULL,
  paid_date DATE,
  payment_method ENUM('cash', 'upi', 'card', 'bank', 'online') DEFAULT 'cash',
  payment_reference VARCHAR(255),
  status ENUM('pending', 'partial', 'paid', 'overdue', 'cancelled') DEFAULT 'pending',
  receipt_number VARCHAR(50) UNIQUE,
  invoice_number VARCHAR(50) UNIQUE,
  month_year VARCHAR(7) NOT NULL,
  notes TEXT,
  collected_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  INDEX idx_rent_tenant (tenant_id),
  INDEX idx_rent_hostel (hostel_id),
  INDEX idx_rent_status (status),
  INDEX idx_rent_due_date (due_date),
  INDEX idx_rent_month (month_year)
) ENGINE=InnoDB;

CREATE TABLE payment_orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rent_payment_id INT UNSIGNED NOT NULL,
  tenant_id INT UNSIGNED NOT NULL,
  hostel_id INT UNSIGNED NOT NULL,
  provider VARCHAR(32) NOT NULL,
  gateway_order_id VARCHAR(64) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'INR',
  status ENUM('created', 'paid', 'failed', 'cancelled') DEFAULT 'created',
  gateway_payment_id VARCHAR(64) NULL,
  payment_method VARCHAR(32) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_orders_gateway (gateway_order_id),
  INDEX idx_payment_orders_invoice (rent_payment_id),
  INDEX idx_payment_orders_status (status)
) ENGINE=InnoDB;

CREATE TABLE payment_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  provider_event_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(64) NULL,
  rent_payment_id INT UNSIGNED NULL,
  payload TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_events_provider (provider, provider_event_id)
) ENGINE=InnoDB;

CREATE TABLE expenses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  category ENUM('electricity', 'water', 'internet', 'food', 'maintenance', 'salary', 'fuel', 'cleaning', 'purchase', 'other') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  bill_path VARCHAR(500),
  expense_date DATE NOT NULL,
  vendor VARCHAR(255),
  payment_method ENUM('cash', 'upi', 'card', 'bank', 'cheque') DEFAULT 'cash',
  reference_number VARCHAR(100),
  created_by INT UNSIGNED NOT NULL,
  approved_by INT UNSIGNED,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  INDEX idx_expense_hostel (hostel_id),
  INDEX idx_expense_category (category),
  INDEX idx_expense_date (expense_date)
) ENGINE=InnoDB;

CREATE TABLE finance_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  type ENUM('income', 'expense') NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  reference_id INT UNSIGNED,
  reference_type VARCHAR(50),
  transaction_date DATE NOT NULL,
  description TEXT,
  created_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  INDEX idx_finance_hostel (hostel_id),
  INDEX idx_finance_type (type),
  INDEX idx_finance_date (transaction_date)
) ENGINE=InnoDB;

-- =====================================================
-- VISITORS
-- =====================================================

CREATE TABLE visitors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  tenant_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  id_proof_type ENUM('aadhar', 'pan', 'passport', 'driving_license', 'voter_id', 'other') NOT NULL,
  id_proof_number VARCHAR(50) NOT NULL,
  photo VARCHAR(500),
  purpose TEXT NOT NULL,
  in_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  out_time DATETIME,
  status ENUM('pending', 'approved', 'rejected', 'checked_in', 'checked_out') DEFAULT 'pending',
  approved_by INT UNSIGNED,
  approved_at DATETIME,
  created_by INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX idx_visitor_hostel (hostel_id),
  INDEX idx_visitor_tenant (tenant_id),
  INDEX idx_visitor_status (status),
  INDEX idx_visitor_in_time (in_time)
) ENGINE=InnoDB;

-- =====================================================
-- COMPLAINTS
-- =====================================================

CREATE TABLE complaints (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  tenant_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category ENUM('room', 'electric', 'plumbing', 'cleaning', 'food', 'security', 'other') DEFAULT 'other',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  status ENUM('open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected') DEFAULT 'open',
  assigned_to INT UNSIGNED,
  images JSON,
  resolution TEXT,
  resolved_at DATETIME,
  resolved_by INT UNSIGNED,
  rating INT,
  feedback TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  INDEX idx_complaint_hostel (hostel_id),
  INDEX idx_complaint_tenant (tenant_id),
  INDEX idx_complaint_status (status),
  INDEX idx_complaint_priority (priority)
) ENGINE=InnoDB;

CREATE TABLE complaint_timeline (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT UNSIGNED NOT NULL,
  action VARCHAR(100) NOT NULL,
  performed_by INT UNSIGNED,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_ctimeline_complaint (complaint_id)
) ENGINE=InnoDB;

-- =====================================================
-- MAINTENANCE
-- =====================================================

CREATE TABLE maintenance (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED,
  type ENUM('room_repair', 'electric', 'plumbing', 'painting', 'furniture', 'other') NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('pending', 'scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  vendor VARCHAR(255),
  cost DECIMAL(10, 2) DEFAULT 0,
  scheduled_date DATE,
  completed_date DATE,
  images JSON,
  notes TEXT,
  created_by INT UNSIGNED NOT NULL,
  assigned_to INT UNSIGNED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  INDEX idx_maint_hostel (hostel_id),
  INDEX idx_maint_status (status),
  INDEX idx_maint_type (type)
) ENGINE=InnoDB;

-- =====================================================
-- NOTICES
-- =====================================================

CREATE TABLE notices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('announcement', 'emergency', 'event', 'festival', 'general') DEFAULT 'general',
  is_emergency BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  event_date DATE,
  expires_at DATETIME,
  target_roles JSON,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE SET NULL,
  INDEX idx_notice_hostel (hostel_id),
  INDEX idx_notice_type (type),
  INDEX idx_notice_emergency (is_emergency)
) ENGINE=InnoDB;

-- =====================================================
-- INVENTORY
-- =====================================================

CREATE TABLE inventory_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  category ENUM('beds', 'mattress', 'chairs', 'fans', 'ac', 'tables', 'buckets', 'cleaning', 'other') NOT NULL,
  quantity INT DEFAULT 0,
  min_stock INT DEFAULT 5,
  unit VARCHAR(20) DEFAULT 'pcs',
  unit_price DECIMAL(10, 2) DEFAULT 0,
  location VARCHAR(255),
  status ENUM('available', 'low_stock', 'out_of_stock') DEFAULT 'available',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  INDEX idx_inventory_hostel (hostel_id),
  INDEX idx_inventory_category (category)
) ENGINE=InnoDB;

CREATE TABLE inventory_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  type ENUM('in', 'out', 'adjustment', 'damage') NOT NULL,
  quantity INT NOT NULL,
  previous_quantity INT,
  new_quantity INT,
  remarks TEXT,
  performed_by INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  INDEX idx_invtrans_item (item_id)
) ENGINE=InnoDB;

-- =====================================================
-- DOCUMENTS
-- =====================================================

CREATE TABLE documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('tenant', 'staff', 'hostel', 'contract', 'rent_agreement', 'other') NOT NULL,
  entity_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  file_size INT,
  description TEXT,
  uploaded_by INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_doc_entity (entity_type, entity_id)
) ENGINE=InnoDB;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'success', 'warning', 'error', 'rent', 'complaint', 'visitor', 'maintenance', 'announcement') DEFAULT 'info',
  channel ENUM('in_app', 'email', 'sms', 'whatsapp', 'push') DEFAULT 'in_app',
  is_read BOOLEAN DEFAULT FALSE,
  data JSON,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_read (is_read),
  INDEX idx_notif_created (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- SETTINGS & AUDIT
-- =====================================================

CREATE TABLE settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED,
  `group` VARCHAR(50) NOT NULL DEFAULT 'general',
  `key` VARCHAR(100) NOT NULL,
  value TEXT,
  type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_setting (hostel_id, `group`, `key`),
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT UNSIGNED,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

-- Supervisor-Hostel mapping
CREATE TABLE supervisor_hostels (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supervisor_id INT UNSIGNED NOT NULL,
  hostel_id INT UNSIGNED NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  UNIQUE KEY uk_supervisor_hostel (supervisor_id, hostel_id)
) ENGINE=InnoDB;

CREATE TABLE listing_projections (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  area VARCHAR(120),
  state VARCHAR(100),
  amenities JSON,
  occupancy_types JSON,
  gender_policy ENUM('male', 'female', 'unisex') NOT NULL DEFAULT 'unisex',
  stay_modes JSON,
  min_rent DECIMAL(10, 2),
  max_rent DECIMAL(10, 2),
  daily_rent DECIMAL(10, 2),
  beds_available INT UNSIGNED NOT NULL DEFAULT 0,
  rating_avg DECIMAL(3, 2),
  rating_count INT UNSIGNED NOT NULL DEFAULT 0,
  cover_url VARCHAR(500),
  cover_thumb_url VARCHAR(500),
  plan ENUM('regular', 'silver', 'gold') NOT NULL DEFAULT 'regular',
  marketplace_ok TINYINT(1) NOT NULL DEFAULT 0,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  refreshed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_listing_projections_hostel (hostel_id),
  INDEX idx_listing_public_city (is_public, city),
  INDEX idx_listing_public_rent (is_public, min_rent),
  INDEX idx_listing_market_city (marketplace_ok, is_public, city),
  INDEX idx_listing_city (city)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
