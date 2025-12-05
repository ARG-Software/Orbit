
import { Component, ChangeDetectionStrategy, inject, signal, computed, Signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MockDataService, Project, Client, TeamMember } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { NgClass, CurrencyPipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ProjectModalComponent } from '../modals/project-modal/project-modal.component';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, PaginationComponent, NgClass, CurrencyPipe, ProjectModalComponent],
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

  // Modal State
  isProjectModalOpen = signal(false);

  // Filters
  filterClient = signal<number | null>(null);
  filterMember = signal<number | null>(null);
  searchTerm = signal('');

  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(5);

  showSuccessToast = signal(false);

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

  onProjectSaved() {
      this.showSuccessToast.set(true);
      setTimeout(() => this.showSuccessToast.set(false), 3000);
  }
}
