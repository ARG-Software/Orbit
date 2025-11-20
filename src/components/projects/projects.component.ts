import { Component, ChangeDetectionStrategy, inject, signal, computed, Signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MockDataService, Project, Client, TeamMember } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { NgClass } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, PaginationComponent, NgClass],
})
export class ProjectsComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);
  private router = inject(Router);

  projects = this.dataService.getProjects();
  clients = this.dataService.getClients();
  members = this.dataService.getTeamMembers();

  isAdmin = this.authService.isAdmin;
  user = this.authService.currentUser;

  // Tab State
  activeTab = signal<'list' | 'add'>('list');

  // Filters
  filterClient = signal<number | null>(null);
  filterMember = signal<number | null>(null);
  searchTerm = signal('');

  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(5);

  // Add Project Form State
  newProjectName = signal('');
  newProjectClientId = signal<number | null>(null);
  newProjectStatus = signal<'Active' | 'Completed' | 'On Hold'>('Active');
  newProjectDescription = signal('');
  newProjectMembers = signal<number[]>([]);
  newProjectRates = signal<{ [memberId: number]: number }>({});

  filteredProjects = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const cId = this.filterClient();
    const mId = this.filterMember();
    
    // Role-based filtering
    let projects = this.projects();
    if (!this.isAdmin()) {
        const myTeamId = this.user()?.teamMemberId;
        if (myTeamId) {
            projects = projects.filter(p => p.allocatedTeamMemberIds.includes(myTeamId));
        } else {
            projects = [];
        }
    }

    return projects.filter(p => {
      const matchesClient = !cId || p.clientId === cId;
      const matchesMember = !mId || p.allocatedTeamMemberIds.includes(mId);
      const matchesSearch = !term || p.name.toLowerCase().includes(term);
      return matchesClient && matchesMember && matchesSearch;
    }).sort((a, b) => b.id - a.id); // Newest first
  });

  paginatedProjects = computed(() => {
    const projects = this.filteredProjects();
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    return projects.slice(startIndex, startIndex + this.itemsPerPage());
  });

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  // Helper to get data for display
  getClient(clientId: number) {
    return this.clients().find(c => c.id === clientId);
  }

  getMember(memberId: number) {
    return this.members().find(m => m.id === memberId);
  }

  // --- Add Project Logic ---
  
  toggleMemberSelection(memberId: number, isChecked: boolean) {
    this.newProjectMembers.update(ids => {
      if (isChecked) return [...ids, memberId];
      return ids.filter(id => id !== memberId);
    });
  }

  updateMemberRate(memberId: number, rate: number) {
      this.newProjectRates.update(rates => ({
          ...rates,
          [memberId]: rate
      }));
  }

  saveProject() {
      if (this.newProjectName() && this.newProjectClientId()) {
          
          // Build member rates map for selected members
          const rates: { [id: number]: number } = {};
          this.newProjectMembers().forEach(id => {
              const member = this.members().find(m => m.id === id);
              rates[id] = this.newProjectRates()[id] || member?.defaultHourlyRate || 0;
          });

          this.dataService.addProject({
              clientId: this.newProjectClientId()!,
              name: this.newProjectName(),
              description: this.newProjectDescription(),
              status: this.newProjectStatus(),
              allocatedTeamMemberIds: this.newProjectMembers(),
              memberRates: rates
          });
          
          // Reset and switch to list
          this.resetForm();
          this.activeTab.set('list');
      }
  }

  resetForm() {
    this.newProjectName.set('');
    this.newProjectClientId.set(null);
    this.newProjectStatus.set('Active');
    this.newProjectDescription.set('');
    this.newProjectMembers.set([]);
    this.newProjectRates.set({});
  }
}