
<div align="center">
  <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+PHBhdGggZD0iTTEyIDIxYTkgOSAwIDEgMC05LTljMCAxLjQ4LjM2IDIuODguOTkgNC4xMiIHN0cm9rZT0iIzdjM2FlZCIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMuNSIgZmlsbD0iIzdjM2FlZCIvPjxjaXJjbGUgY3g9IjIwLjQiIGN5PSI4LjYiIHI9IjIuNSIgZmlsbD0iIzBlYTVlOSIvPjwvc3ZnPg==" alt="Orbit Logo" width="120" height="120">
  
  # Orbit
  
  **The Operating System for Freelancers & Agencies**
  
  Manage clients, projects, invoices, and your time in one unified, gravitational interface.
</div>

---

## 🪐 Overview

Orbit is a modern Single Page Application (SPA) built with **Angular v18+** that consolidates the fragmented toolset of freelancers into one cohesive platform. It replaces the need for separate apps for CRM, Project Management, Time Tracking, and Invoicing.

## 🚀 Features

### 📊 Dashboard
*   **Financial Command Center**: Real-time views of revenue, hourly rates, and active project values.
*   **Insights**: Visual breakdowns of client value and team performance.

### 🤝 Client Management (CRM)
*   **Client Profiles**: Store contact info, tax details, and branding colors.
*   **Communication**: Quick email triggers and communication history.

### ✅ Project & Task Tracking
*   **Kanban Boards**: Visual drag-and-drop task management.
*   **Lists & Filters**: Powerful filtering by client, project, and status.
*   **Team Allocation**: Assign members to specific projects with custom rates.

### ⏱️ Time & Money
*   **Timesheets**: Visual weekly and monthly calendars for logging work.
*   **Smart Invoicing**: Generate PDF-ready invoices from logged time or custom items.
*   **Budget Planner**: Create detailed project estimates with a multi-step builder.

### 📅 Scheduling
*   **Meeting Manager**: Schedule calls with clients or guests.
*   **Integrations**: Mock integration with Google Meet and Zoom for link generation.

### 🔍 Discovery
*   **Job Board**: Find new opportunities tailored to your skills and preferences.

## 🛠️ Technology Stack

*   **Framework**: Angular (Standalone Components, Signals, Zoneless)
*   **Styling**: TailwindCSS + DaisyUI
*   **State Management**: Angular Signals
*   **Routing**: Angular Router (Hash Strategy)
*   **Persistence**: LocalStorage (Mock Backend)

## 📂 Project Structure

```
src/
├── app.routes.ts           # Route definitions
├── main.ts                 # Entry point
├── components/
│   ├── dashboard/          # Analytics view
│   ├── clients/            # CRM features
│   ├── projects/           # Project management
│   ├── tasks/              # Kanban boards
│   ├── timesheet/          # Time tracking
│   ├── invoices/           # Billing system
│   ├── estimation/         # Proposal builder
│   └── ...
├── services/
│   ├── auth.service.ts     # User management & persistence
│   └── mock-data.service.ts# Data store
└── guards/                 # Route protection
```

## ⚡ Getting Started

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Start the App**
    ```bash
    npm start
    ```

3.  **Access**
    Open `http://localhost:4200` in your browser.

## 🔐 Access & Auth

The application uses a local mock authentication system.

*   **Admin User**: `admin@example.com` / `password123`
*   **Team Member**: `member@example.com` / `password123`

_Note: All data is persisted in your browser's LocalStorage._

---

<div align="center">
  <sub>Built with Angular & TailwindCSS</sub>
</div>
