# FreelanceOS - Freelancer CRM

FreelanceOS is a comprehensive, single-page application (SPA) designed to help freelancers and small agencies manage their entire business operation. From client relationships and project management to time tracking, invoicing, and financial forecasting, this application provides a unified interface for daily operations.

Built with **Angular (v18+)**, **TypeScript**, and **TailwindCSS**, it leverages modern web development practices including Signals, Standalone Components, and zoneless change detection.

![FreelanceOS Dashboard](https://picsum.photos/seed/dashboard/800/400)

## 🚀 Features

### 📊 Dashboard
*   **Financial Overview**: Real-time calculation of total earnings, average hourly rates, and revenue distribution.
*   **Client Insights**: Visual breakdown of top-performing clients and project values.
*   **Team Performance**: Leaderboards for team hours and revenue generation.
*   **Recent Activity**: Quick view of recent task updates and board activity.

### 🤝 CRM (Client Relationship Management)
*   **Client Directory**: specific profiles with contact info, tax details, and custom branding colors.
*   **Project Management**: Create and manage projects specific to clients.
*   **Communication**: Quick actions to email clients directly from the app.

### ✅ Task Management
*   **Kanban Board**: Drag-and-drop interface for managing task status (To Do, In Progress, On Hold, Completed).
*   **List View**: Detailed tabular view for bulk management.
*   **Comments**: Threaded discussions within tasks for team collaboration.

### ⏱️ Time Tracking
*   **Timesheet**: Weekly and Monthly calendar views to log hours.
*   **Granular Logging**: Assign time to specific projects and team members with descriptions.
*   **Visual Summaries**: Daily totals and project breakdowns.

### 💰 Invoicing
*   **Invoice Builder**: Automatically generate invoices based on logged hours and custom line items.
*   **Payment Integrations**: Toggleable support for PayPal and Stripe (simulation).
*   **History**: Track paid, pending, and overdue invoices with filtering capabilities.

### 📅 Meetings
*   **Scheduler**: Schedule meetings with clients or external guests.
*   **Integrations**: Simulated link generation for **Google Meet** and **Zoom**.
*   **Calendar**: View upcoming and past meetings.

### 💼 Opportunities
*   **Job Board**: Find freelance gigs based on your skill preferences and location.
*   **Budget Planner**: Create detailed project estimates and proposals with a multi-step builder.

## 🛠️ Tech Stack

*   **Framework**: Angular (Latest version)
    *   Standalone Components
    *   Signals for State Management
    *   Zoneless Change Detection
*   **Styling**: TailwindCSS & DaisyUI
*   **Routing**: Angular Router (Hash Location Strategy)
*   **Data Persistence**: Local Storage (via MockDataService & AuthService)
*   **Icons**: Heroicons (via SVG)

## 📂 Project Structure

```
src/
├── app.routes.ts           # Application routing configuration
├── main.ts                 # Application entry point
├── components/
│   ├── dashboard/          # Analytics and widgets
│   ├── clients/            # Client list and CRUD
│   ├── client-detail/      # Specific client view & projects
│   ├── tasks/              # Kanban board
│   ├── timesheet/          # Time logging calendar
│   ├── invoices/           # Invoice generation
│   ├── meetings/           # Meeting scheduler
│   ├── estimation/         # Budget planner
│   ├── settings/           # User profile & integrations
│   └── ...
├── services/
│   ├── auth.service.ts     # User session & local storage sync
│   ├── mock-data.service.ts# Central data store (Signals)
│   └── theme.service.ts    # Dark/Light mode handling
└── guards/                 # Route protection (AuthGuard)
```

## ⚡ Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   npm or yarn

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/freelance-os.git
    cd freelance-os
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the development server**:
    ```bash
    npm start
    ```

4.  **Open in Browser**:
    Navigate to `http://localhost:4200/`.

## 🔐 Authentication & Data

This application uses a **mock backend**.
*   **Register**: You can create a new account on the registration page.
*   **Login**: Use the credentials created during registration.
*   **Persistence**: All data (clients, tasks, settings) is stored in your browser's `localStorage`. Clearing your cache will reset the app to its default state.

## 🎨 Customization

*   **Theming**: The app supports Light and Dark modes, toggled via the navbar.
*   **Tailwind Config**: Design tokens can be modified in the Tailwind configuration script in `index.html`.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
