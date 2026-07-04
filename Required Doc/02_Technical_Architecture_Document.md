# Technical Architecture Document

## 1. System Overview
- **High-level Architecture**: The application follows a Client-Server architecture utilizing a Backend-as-a-Service (BaaS) approach. The client is a React Single Page Application (SPA), deployable as a web app and as an Android native app via Capacitor. Supabase acts as the backend for database operations.

## 2. Components
- **Frontend**: 
  - Framework: React 19 with Vite.
  - Styling: Tailwind CSS for utility-first styling.
  - Routing: React Router (`HashRouter` used for Capacitor compatibility).
  - UI Icons: Lucide-React.
- **Mobile/Hybrid**: 
  - Capacitor Core & `@capacitor/android` for converting the web app into a mobile APK.
  - `@capacitor-community/background-geolocation` for native background GPS tracking.
- **Backend & Database**: 
  - Supabase (PostgreSQL).
  - Main Table: `ticket_tracking` (Contains ticket info, device id, lat/lng, status, and JSON `status_history`).

## 3. Data Flow
- **Data Models**:
  - `ticket_tracking`: 
    - `id` (UUID/Int)
    - `ticket_id` (String)
    - `employee_id`, `engineer_name`
    - `latest_lat`, `latest_lng`, `latest_city`
    - `current_status`
    - `status_history` (JSON object holding timestamps, lat/lng, and remarks for each status transition).
- **API Interfaces**:
  - `supabase-js` client is used for all CRUD operations.
  - OpenStreetMap Nominatim API is used for Reverse Geocoding (Lat/Lng to City name).

## 4. Infrastructure & Deployment
- **Hosting**: The web frontend is hosted on standard static hosting (e.g., Vercel, Netlify).
- **Mobile Deployment**: Compiled locally to Android APK using Android Studio and Capacitor CLI (`npx cap sync android`).
- **CI/CD Pipeline**: Can be integrated with GitHub Actions to automate Vite builds and Supabase schema updates.
