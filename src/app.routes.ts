
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { publicGuard } from './guards/public.guard';

export const APP_ROUTES: Routes = [
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
  {
    path: '',
    loadComponent: () => import('./components/layout/layout.component').then(c => c.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        loadComponent: () => import('./components/dashboard/dashboard.component').then(c => c.DashboardComponent) 
      },
      {
        path: 'timesheet',
        loadComponent: () => import('./components/timesheet/timesheet.component').then(c => c.TimesheetComponent)
      },
      { 
        path: 'clients', 
        loadComponent: () => import('./components/clients/clients.component').then(c => c.ClientsComponent) 
      },
      { 
        path: 'clients/:id', 
        loadComponent: () => import('./components/client-detail/client-detail.component').then(c => c.ClientDetailComponent) 
      },
      { 
        path: 'invoices', 
        loadComponent: () => import('./components/invoices/invoices.component').then(c => c.InvoicesComponent) 
      },
      {
        path: 'estimation',
        loadComponent: () => import('./components/estimation/estimation.component').then(c => c.EstimationComponent)
      },
      {
        path: 'meetings',
        loadComponent: () => import('./components/meetings/meetings.component').then(c => c.MeetingsComponent)
      },
      {
        path: 'team',
        loadComponent: () => import('./components/team/team.component').then(c => c.TeamComponent)
      },
      {
        path: 'team/:id',
        loadComponent: () => import('./components/team-member-detail/team-member-detail.component').then(c => c.TeamMemberDetailComponent)
      },
      {
        path: 'tasks',
        loadComponent: () => import('./components/tasks/tasks.component').then(c => c.TasksComponent)
      },
      {
        path: 'jobs',
        loadComponent: () => import('./components/job-search/job-search.component').then(c => c.JobSearchComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./components/settings/settings.component').then(c => c.SettingsComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];