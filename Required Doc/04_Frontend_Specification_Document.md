# Frontend Specification Document

## 1. UI/UX Guidelines
- **Design System**: A custom "Glassmorphism" design system utilizing bright gradients, shadow effects, and rounded UI components to create a premium, modern feel.
- **Themes & Styling**: 
  - Main Colors: Indigo, Emerald, Amber, and Red to indicate different states.
  - Tailwind CSS handles layout, spacing, typography, and responsive breakpoints.

## 2. Views & Components
- **Core Layouts**:
  - `/` (Engineer Portal): Mobile-first, card-based layout centered on the screen. Features a status update form that conditionally renders based on the ticket's current state.
  - `/admin` (Admin Dashboard): Desktop-first, grid-based layout. Contains a top navigation bar, KPI summary cards, a ticket directory sidebar, an active ticket timeline viewer, and an interactive map.
- **Reusable Components**:
  - `MapComponent.jsx`: Wraps `react-leaflet` to display multiple engineer markers on an OpenStreetMap tile layer. Uses custom SVGs for different statuses.

## 3. State Management & API Integration
- **State Management Approach**: Local component state (`useState`) handles form data and UI toggles. `useEffect` is heavily used in the Admin dashboard for data polling (every 15 seconds) to refresh the map.
- **API Endpoints**: 
  - `supabase.from('ticket_tracking').select()` and `.insert()`/`.update()`.

## 4. Performance & Accessibility
- **Performance Goals**: 
  - GPS caching is optimized (maximumAge 60000) to prevent battery drain.
  - Background tracking throttles Supabase updates to a minimum of 30 seconds to reduce network calls.
- **Accessibility Standards (a11y)**: Clear contrast ratios for status pills, semantic HTML5 elements (header, nav).
