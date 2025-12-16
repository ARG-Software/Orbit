
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { publicGuard } from './guards/public.guard';
import { adminGuard } from './guards/admin.guard';

export const APP_ROUTES: Routes = [
  // Root redirects to Login
  { 
    path: '', 
    redirectTo: 'login',
    pathMatch: 'full'
  },
  
  // Auth Routes
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(c => c.LoginComponent),
    canActivate: [publicGuard],
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register.component').then(c => c.RegisterComponent),
    canActivate: [publicGuard],
  },
  // Authenticated App Routes (Moved to /app)
  {
    path: 'app',
    loadComponent: () => import('./components/layout/layout.component').then(c => c.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        loadComponent: () => import('./components/dashboard/dashboard.component').then(c => c.DashboardComponent) 
      },
      {
        path: 'projects',
        loadComponent: () => import('./components/projects/projects.component').then(c => c.ProjectsComponent)
      },
      {
        path: 'projects/:id',
        loadComponent: () => import('./components/project-detail/project-detail.component').then(c => c.ProjectDetailComponent)
      },
      {
        path: 'timesheet',
        children: [
            { path: '', redirectTo: 'log', pathMatch: 'full' },
            {
                path: 'log',
                loadComponent: () => import('./components/timesheet/timesheet.component').then(c => c.TimesheetComponent),
                data: { tab: 'log' }
            },
            {
                path: 'history',
                loadComponent: () => import('./components/timesheet/timesheet.component').then(c => c.TimesheetComponent),
                data: { tab: 'history' }
            }
        ]
      },
      // Admin Only Routes
      { 
        path: 'clients', 
        loadComponent: () => import('./components/clients/clients.component').then(c => c.ClientsComponent),
        canActivate: [adminGuard]
      },
      { 
        path: 'clients/:id', 
        loadComponent: () => import('./components/client-detail/client-detail.component').then(c => c.ClientDetailComponent),
        canActivate: [adminGuard] 
      },
      { 
        path: 'invoices', 
        loadComponent: () => import('./components/invoices/invoices.component').then(c => c.InvoicesComponent),
        canActivate: [adminGuard] 
      },
      {
        path: 'expenses',
        loadComponent: () => import('./components/payments/payments.component').then(c => c.PaymentsComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'estimation',
        loadComponent: () => import('./components/estimation/estimation.component').then(c => c.EstimationComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'meetings',
        loadComponent: () => import('./components/meetings/meetings.component').then(c => c.MeetingsComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'team',
        loadComponent: () => import('./components/team/team.component').then(c => c.TeamComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'team/:id',
        loadComponent: () => import('./components/team-member-detail/team-member-detail.component').then(c => c.TeamMemberDetailComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'jobs',
        loadComponent: () => import('./components/job-search/job-search.component').then(c => c.JobSearchComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'settings',
        loadComponent: () => import('./components/settings/settings.component').then(c => c.SettingsComponent),
        canActivate: [adminGuard]
      }
    ]
  },
  // Catch all - Redirect to Login
  { path: '**', redirectTo: 'login' }
];
