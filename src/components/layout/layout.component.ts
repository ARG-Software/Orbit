
import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgOptimizedImage],
})
export class LayoutComponent {
  router: Router = inject(Router);
  themeService = inject(ThemeService);
  authService = inject(AuthService);

  isDarkMode = this.themeService.isDarkMode;
  isMobileMenuOpen = signal(false);
  user = this.authService.currentUser;
  isAdmin = this.authService.isAdmin;
  
  // State for Accordion Menu
  activeGroup = signal<string | null>(null);

  // Grouped Navigation Structure
  navGroups = computed(() => {
      const role = this.user()?.role;
      if (role === 'ADMIN') {
          return [
            { type: 'link', path: 'dashboard', name: 'Dashboard' },
            {
              type: 'group',
              label: 'Projects',
              children: [
                { path: 'projects', name: 'All Projects' },
                { path: 'tasks', name: 'Tasks' },
                { path: 'timesheet', name: 'Timesheet' },
              ]
            },
            {
              type: 'group',
              label: 'CRM',
              children: [
                { path: 'clients', name: 'Clients' },
                { path: 'meetings', name: 'Meetings' },
                { path: 'team', name: 'Team' },
                { path: 'invoices', name: 'Invoices' },
              ]
            },
            {
              type: 'group',
              label: 'Opportunities',
              children: [
                { path: 'jobs', name: 'Job Board' },
                { path: 'estimation', name: 'Budget Planner' },
              ]
            }
          ];
      } else {
          // MEMBER View
          return [
             { type: 'link', path: 'dashboard', name: 'My Dashboard' },
             {
               type: 'group',
               label: 'Work',
               children: [
                 { path: 'projects', name: 'My Projects' },
                 { path: 'tasks', name: 'My Tasks' },
                 { path: 'timesheet', name: 'My Timesheet' },
               ]
             }
          ];
      }
  });

  toggleTheme() {
    this.themeService.toggleTheme();
  }
  
  toggleMobileMenu() {
    this.isMobileMenuOpen.update(v => !v);
  }
  
  toggleGroup(label: string) {
    this.activeGroup.update(current => current === label ? null : label);
  }
  
  closeGroup() {
    this.activeGroup.set(null);
  }

  logout() {
    this.isMobileMenuOpen.set(false);
    this.authService.logout();
  }
}
