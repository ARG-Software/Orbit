
import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { NgOptimizedImage, TitleCasePipe } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { MockDataService } from '../../services/mock-data.service';
import { filter } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgOptimizedImage, TitleCasePipe],
})
export class LayoutComponent {
  router: Router = inject(Router);
  themeService = inject(ThemeService);
  authService = inject(AuthService);
  dataService = inject(MockDataService);

  isDarkMode = this.themeService.isDarkMode;
  isMobileMenuOpen = signal(false);
  user = this.authService.currentUser;
  isAdmin = this.authService.isAdmin;
  
  // Data signals for breadcrumb resolution
  clients = this.dataService.getClients();
  projects = this.dataService.getProjects();
  members = this.dataService.getTeamMembers();
  
  // State for Accordion Menu
  activeGroup = signal<string | null>(null);

  // Breadcrumbs Logic
  currentUrl = toSignal(
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)), 
    { initialValue: null }
  );

  breadcrumbs = computed(() => {
    this.currentUrl(); // Dependency
    const url = this.router.url;
    const parts = url.split('/').filter(p => p && p !== 'app');
    
    let path = '/app';
    return parts.map((part, index) => {
      path += `/${part}`;
      let name = part.replace(/-/g, ' ');

      if (/^\d+$/.test(part)) {
        const id = parseInt(part, 10);
        const context = parts[index - 1]; 

        if (context === 'clients') {
            const client = this.clients().find(c => c.id === id);
            if (client) name = client.name;
        } else if (context === 'projects') {
            const project = this.projects().find(p => p.id === id);
            if (project) name = project.name;
        } else if (context === 'team') {
            const member = this.members().find(m => m.id === id);
            if (member) name = member.name;
        } else {
            name = `#${part}`;
        }
      }

      return { name, path };
    });
  });

  // Grouped Navigation Structure
  navGroups = computed(() => {
      const role = this.user()?.role;
      if (role === 'ADMIN') {
          return [
            { 
                type: 'link', 
                path: 'dashboard', 
                name: 'Dashboard',
                icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' 
            },
            {
              type: 'group',
              label: 'Projects',
              icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
              children: [
                { path: 'projects', name: 'Projects' },
                { path: 'tasks', name: 'Tasks' },
                { path: 'timesheet', name: 'Timesheet' },
              ]
            },
            {
              type: 'group',
              label: 'CRM',
              icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4-4 2 2 0 014 4z',
              children: [
                { path: 'team', name: 'Team' },
                { path: 'clients', name: 'Clients' },
                { path: 'meetings', name: 'Meetings' },
                { path: 'invoices', name: 'Invoices' },
                { path: 'expenses', name: 'Expenses' },
              ]
            },
            {
              type: 'group',
              label: 'Opportunities',
              icon: 'M13 10V3L4 14h7v7l9-11h-7z',
              children: [
                { path: 'jobs', name: 'Job Board' },
                { path: 'estimation', name: 'Budget Planner' },
              ]
            }
          ];
      } else {
          // MEMBER View
          return [
             { 
                 type: 'link', 
                 path: 'dashboard', 
                 name: 'My Dashboard',
                 icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
             },
             {
               type: 'group',
               label: 'Work',
               icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
               children: [
                 { path: 'projects', name: 'My Projects' },
                 { path: 'tasks', name: 'My Tasks' },
                 { path: 'timesheet', name: 'My Timesheet' },
               ]
             }
          ];
      }
  });

  toggleTheme(event: any) {
    if (event.target.checked) {
        if (!this.isDarkMode()) this.themeService.toggleTheme();
    } else {
        if (this.isDarkMode()) this.themeService.toggleTheme();
    }
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

  closeUserDropdown() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  logout() {
    this.isMobileMenuOpen.set(false);
    this.authService.logout();
  }
}
