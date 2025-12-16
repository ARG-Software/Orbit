
import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { NgOptimizedImage, TitleCasePipe, NgStyle, NgClass } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { MockDataService } from '../../services/mock-data.service';
import { TranslationService } from '../../services/translation.service';
import { filter } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgOptimizedImage, TitleCasePipe, FormsModule, NgStyle, NgClass],
})
export class LayoutComponent {
  router: Router = inject(Router);
  themeService = inject(ThemeService);
  authService = inject(AuthService);
  dataService = inject(MockDataService);
  translationService = inject(TranslationService);

  isDarkMode = this.themeService.isDarkMode;
  isMobileMenuOpen = signal(false);
  
  // Sidebar State
  isSidebarCollapsed = signal(false);
  showLabels = computed(() => !this.isSidebarCollapsed());

  user = this.authService.currentUser;
  isAdmin = this.authService.isAdmin;
  allProjects = this.dataService.getProjects();
  
  // State for Accordion Menu
  activeGroup = signal<string | null>(null);

  // Data Signals for Badges
  activeProjectsCount = computed(() => this.dataService.getProjects()().filter(p => p.status === 'Active').length);
  activeTasksCount = computed(() => this.dataService.getAllTasks()().filter(t => t.status !== 'Completed').length);

  // --- Search State ---
  searchQuery = signal('');
  
  searchablePages = [
      { name: 'Dashboard', path: '/app/dashboard' },
      { name: 'Projects', path: '/app/projects' },
      { name: 'Tasks', path: '/app/tasks' },
      { name: 'Timesheet', path: '/app/timesheet/log' },
      { name: 'Timesheet History', path: '/app/timesheet/history' },
      { name: 'Clients', path: '/app/clients' },
      { name: 'Team', path: '/app/team' },
      { name: 'Invoices', path: '/app/invoices' },
      { name: 'Invoice History', path: '/app/invoices?tab=history' },
      { name: 'Expenses', path: '/app/expenses' },
      { name: 'Meetings', path: '/app/meetings' },
      { name: 'Meeting History', path: '/app/meetings?tab=history' },
      { name: 'Job Board', path: '/app/jobs' },
      { name: 'Saved Jobs', path: '/app/jobs?tab=saved' },
      { name: 'Budget Planner', path: '/app/estimation' },
      { name: 'Budget History', path: '/app/estimation?tab=history' },
      { name: 'Settings', path: '/app/settings' },
  ];

  filteredPages = computed(() => {
      const q = this.searchQuery().toLowerCase().trim();
      if (!q) return [];
      return this.searchablePages.filter(p => p.name.toLowerCase().includes(q));
  });

  onSearchEnter() {
      const results = this.filteredPages();
      if (results.length > 0) {
          this.navigateTo(results[0].path);
      }
  }

  navigateTo(path: string) {
      this.router.navigateByUrl(path);
      this.searchQuery.set('');
  }

  // Route tracking for styling updates
  currentUrl = toSignal(
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)), 
    { initialValue: null }
  );

  // Module Detection for Background Styling
  activeModule = computed(() => {
    this.currentUrl(); // Trigger dependency
    const url = this.router.url;
    
    if (url.includes('/app/projects') || url.includes('/app/timesheet') || url.includes('/app/tasks')) {
      return 'workspace';
    }
    if (url.includes('/app/team') || url.includes('/app/clients') || url.includes('/app/meetings') || url.includes('/app/invoices') || url.includes('/app/expenses')) {
      return 'business';
    }
    if (url.includes('/app/jobs') || url.includes('/app/estimation') || url.includes('/app/settings')) {
      return 'growth';
    }
    return 'dashboard';
  });

  moduleAccentColor = computed(() => {
    const module = this.activeModule();
    switch (module) {
      case 'workspace': return '#d1c1d7'; 
      case 'business': return '#f6cbd1';
      case 'growth': return '#b4e9d6';
      default: return 'transparent';
    }
  });

  backgroundStyle = computed(() => ({}));
  mainBackgroundClass = computed(() => 'flex-grow transition-all duration-700 ease-in-out bg-base-200');

  // Grouped Navigation Structure
  navGroups = computed(() => {
      this.translationService.currentLang();
      const t = (key: string) => this.translationService.translate(key);

      const role = this.user()?.role;
      let groups: any[] = [];

      if (role === 'ADMIN') {
          groups = [
            { 
                type: 'link', 
                path: 'dashboard', 
                name: t('Dashboard'),
                icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' 
            },
            {
              type: 'group',
              label: t('Workspace'),
              icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
              children: [
                { 
                    type: 'link',
                    path: 'projects',
                    name: t('Projects'),
                    icon: 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z',
                    badge: this.activeProjectsCount()
                },
                { 
                    name: t('Timesheet'),
                    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
                    children: [
                        { path: 'timesheet/log', name: t('Log Time'), icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { path: 'timesheet/history', name: t('History'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }
                    ]
                },
              ]
            },
            {
              type: 'group',
              label: t('Business Hub'),
              icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4-4 2 2 0 014 4z',
              children: [
                { path: 'team', name: t('Team'), icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
                { path: 'clients', name: t('Clients'), icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                { path: 'meetings', name: t('Meetings'), icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                { path: 'invoices', name: t('Invoices'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                { path: 'expenses', name: t('Expenses'), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01' },
              ]
            },
            {
              type: 'group',
              label: t('Growth'),
              icon: 'M13 10V3L4 14h7v7l9-11h-7z',
              children: [
                { path: 'jobs', name: t('Job Board'), icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                { path: 'estimation', name: t('Budget Planner'), icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
              ]
            }
          ];
      } else {
          groups = [
             { 
                 type: 'link', 
                 path: 'dashboard', 
                 name: t('My Dashboard'),
                 icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
             },
             {
               type: 'group',
               label: t('Workspace'),
               icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
               children: [
                 { 
                    type: 'link',
                    path: 'projects',
                    name: t('My Projects'),
                    icon: 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z',
                    badge: this.activeProjectsCount()
                 },
                 { 
                    name: t('My Timesheet'),
                    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
                    children: [
                        { path: 'timesheet/log', name: t('Log Time'), icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { path: 'timesheet/history', name: t('History'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }
                    ]
                 },
               ]
             }
          ];
      }

      // Append Favorites if any
      const pinned = this.allProjects().filter(p => p.isPinned);
      if (pinned.length > 0) {
          groups.push({
              type: 'group',
              label: t('Favorites'),
              icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
              children: pinned.map(p => ({
                  path: `projects/${p.id}`,
                  name: p.name,
                  icon: 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z',
                  isPinned: true,
                  id: p.id
              }))
          });
      }

      return groups;
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

  unpinProject(id: number) {
      this.dataService.toggleProjectPin(id);
  }

  toggleSidebar() {
      this.isSidebarCollapsed.update(v => !v);
  }
}
