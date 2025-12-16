
import { Component, ChangeDetectionStrategy, inject, signal, computed, Signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MockDataService, Project, Client, TeamMember } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { NgClass, CurrencyPipe, DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ProjectModalComponent } from '../modals/project-modal/project-modal.component';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, PaginationComponent, NgClass, CurrencyPipe, ProjectModalComponent, DatePipe],
})
export class ProjectsComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);
  public translationService = inject(TranslationService);

  projects = this.dataService.getProjects();
  clients = this.dataService.getClients();
  members = this.dataService.getTeamMembers();

  isAdmin = this.authService.isAdmin;
  user = this.authService.currentUser;

  // View Mode: 'active' or 'closed' (Local State)
  activeTab = signal<'active' | 'closed'>('active');

  // State
  isProjectModalOpen = signal(false);
  projectToEdit = signal<Project | null>(null);

  // Filters
  filterClient = signal<number | null>(null);
  filterMember = signal<number | null>(null);
  searchTerm = signal('');
  filterStartDate = signal('');
  filterEndDate = signal('');

  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(10);

  showSuccessToast = signal(false);
  toastMessage = signal('');

  // Filtered List based on Mode
  filteredProjects = computed(() => {
    const mode = this.activeTab();
    const term = this.searchTerm().toLowerCase();
    const cId = this.filterClient();
    const mId = this.filterMember();
    const startDate = this.filterStartDate();
    const filterEndDate = this.filterEndDate();
    
    // Role-based filtering (Admin sees all, Member sees assigned)
    let projects = this.projects();
    if (!this.isAdmin()) {
        const myTeamId = this.user()?.teamMemberId;
        if (myTeamId) {
            projects = projects.filter(p => p.allocatedTeamMemberIds.includes(myTeamId));
        } else {
            return [];
        }
    }

    // Filter by Mode (Active vs Closed/Archived)
    if (mode === 'active') {
        // Active view shows Active and Paused
        projects = projects.filter(p => p.status === 'Active' || p.status === 'Paused');
    } else {
        // Closed view shows Completed and Archived
        projects = projects.filter(p => p.status === 'Archived' || p.status === 'Completed');
    }

    return projects.filter(p => {
      const matchesClient = !cId || p.clientId === cId;
      const matchesMember = !mId || p.allocatedTeamMemberIds.includes(mId);
      const matchesSearch = !term || p.name.toLowerCase().includes(term);
      
      let matchesDate = true;
      if (startDate) {
          matchesDate = matchesDate && new Date(p.createdAt) >= new Date(startDate);
      }
      if (filterEndDate) {
          const end = new Date(filterEndDate);
          end.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && new Date(p.createdAt) <= end;
      }

      return matchesClient && matchesMember && matchesSearch && matchesDate;
    }).sort((a, b) => b.id - a.id); // Newest first
  });

  // Paginated List
  paginatedProjects = computed(() => {
    const projects = this.filteredProjects();
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    return projects.slice(startIndex, startIndex + this.itemsPerPage());
  });

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  onFilterChange() {
      this.currentPage.set(1);
  }

  // Helpers
  getClient(clientId: number) {
    return this.clients().find(c => c.id === clientId);
  }

  getMember(memberId: number) {
    return this.members().find(m => m.id === memberId);
  }

  // Actions
  openNewProjectModal() {
      this.projectToEdit.set(null);
      this.isProjectModalOpen.set(true);
  }

  editProject(project: Project) {
      this.projectToEdit.set(project);
      this.isProjectModalOpen.set(true);
  }

  archiveProject(project: Project) {
      this.dataService.updateProject({ ...project, status: 'Archived' });
      this.triggerToast('Project archived.');
  }

  restoreProject(project: Project) {
      this.dataService.updateProject({ ...project, status: 'Active' });
      this.triggerToast('Project restored.');
  }

  deleteProject(id: number) {
      if (confirm('Are you sure you want to delete this project?')) {
          this.dataService.deleteProject(id);
          this.triggerToast('Project deleted.');
      }
  }

  onProjectSaved() {
      this.triggerToast('Project saved successfully.');
  }

  private triggerToast(msg: string) {
      this.toastMessage.set(msg);
      this.showSuccessToast.set(true);
      setTimeout(() => this.showSuccessToast.set(false), 3000);
  }
}
