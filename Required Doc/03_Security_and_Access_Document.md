# Security & Access Document

## 1. Authentication & Authorization
- **Roles & Permissions**:
  - **Engineer**: No formal login required. The app locks the session using the device's generated `deviceId` (`eng_deviceId` stored in `localStorage`). This ensures an engineer cannot start a ticket on one phone and finish it on another.
  - **Admin**: Protected via a simple password challenge (currently `"Loki@1312"`). A successful login stores `admin_auth` in `sessionStorage`.
- **Authentication Mechanisms**: Session-based auth for Admins, Device-locking for Engineers.

## 2. Data Security
- **Data in Transit**: All data communicates over HTTPS/WSS via Supabase API endpoints.
- **Data at Rest**: Data is stored securely in Supabase PostgreSQL databases.

## 3. Audit & Logging
- **System Logs**: All status changes are appended to the `status_history` JSON column in the database, acting as an immutable audit trail for the ticket.
- **User Activity Logs**: Time, Date, GPS coordinates, and manual remarks are strictly enforced for every status update.

## 4. Vulnerability Management
- **Security Policies**: 
  - Device lock validation prevents tampering with another engineer's active ticket.
  - Expiry logic implemented: if a ticket was created > 24 hours ago, it expires, forcing a new session to prevent stale data.
