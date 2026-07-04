# Product Requirements Document (PRD)

## 1. Introduction
- **Purpose**: The Innoworq Field Service Portal is a web and mobile hybrid application designed to track the location and activities of field engineers. It provides an Engineer Portal for reporting site visits and an Admin Dashboard for real-time tracking and monitoring.
- **Scope**: The system covers GPS tracking, ticket status workflows, geographical map visualization of engineers, and performance/productivity reporting.

## 2. Product Overview
- **Objective**: To streamline field operations by ensuring engineers check in with their physical location. To provide dispatchers/admins with a bird's-eye view of all operations.
- **Target Audience**: 
  - **Field Engineers**: Will use the Engineer Portal (mostly on mobile) to log activities.
  - **Administrators/Dispatchers**: Will use the Admin Dashboard on desktop to monitor KPIs and locations.

## 3. Features & Requirements
- **Key Features**:
  1. **Engineer Ticket Management**: Engineers can search for tickets, and log their current status with required GPS coordinates.
  2. **Background Tracking**: The app uses Capacitor's background geolocation plugin (with fallback to web geolocation) to periodically send coordinates even when the app is minimized.
  3. **Live Admin Tracking**: Admin dashboard with auto-polling every 15s for the current day's tickets.
  4. **Productivity Reports**: Excel downloads of engineer stats, completed tickets, and timeline of statuses.
- **Functional Requirements**:
  - The system must capture device IDs to prevent multi-device logins for the same ticket.
  - Engineers must provide Name, Employee ID, Project Name, and Activity Times when starting a new ticket.
  - A strict state machine for ticket statuses: Assigned -> Start Journey / Travelling -> Reached Site -> Attempted / Cancelled / Activity Completed -> Leaving the Site.
- **Non-Functional Requirements**:
  - High availability via Supabase BaaS.
  - Responsive design (Mobile-first for Engineer Portal, Desktop-optimized for Admin Dashboard).

## 4. Milestones & Timeline
- **Phase 1**: Core tracking, status updates, and basic Leaflet map visualization (Completed).
- **Phase 2**: Capacitor Native Android app integration and background geolocation tracking (Completed).
- **Phase 3**: Enhanced KPI dashboards, advanced project filtering, and Excel report generation (Completed).
