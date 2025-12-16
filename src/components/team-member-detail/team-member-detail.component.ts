
import { Component, ChangeDetectionStrategy, inject, signal, effect, Signal, computed } from '@angular/core';
import { DecimalPipe, DatePipe, NgClass } from '@angular/common';
import { ActivatedRoute, ParamMap, RouterLink, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { MockDataService, TeamMember, Project, Task } from '../../services/mock-data.service';
import { FormsModule } from '@angular/forms';
import { PaginationComponent } from '../shared/pagination/pagination.component';

interface LoggedHourEntry {
  date: Date;
  project: string;
  projectId: number;
  clientId: number;
  hours: number;
  description: string;
}

@Component({
  selector: 'app-team-member-detail',
  templateUrl: './team-member-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DecimalPipe, DatePipe, NgClass, PaginationComponent],
})
export class TeamMemberDetailComponent {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private dataService = inject(MockDataService);

  member: Signal<TeamMember | undefined> = toSignal(
    this.route.paramMap.pipe(
      map((params: ParamMap) => Number(params.get('id'))),
      switchMap((id: number) => this.dataService.getTeamMemberById(id))
    )
  );
  
  allProjects = this.dataService.getProjects();
  allTasks = this.dataService.getAllTasks();
  clients = this.dataService.getClients();

  // --- Computed Data & Pagination ---

  // 1. Assigned Projects
  projectSearch = signal('');
  projectFilterClient = signal<number | null>(null);
  projectFilterDate = signal<string>('');
  projectsPage = signal(1);
  projectsPerPage = signal(4);

  assignedProjects = computed(() => {
      const m = this.member();
      if (!m) return [];
      return this.allProjects().filter(p => p.allocatedTeamMemberIds.includes(m.id));
  });

  filteredProjects = computed(() => {
      const term = this.projectSearch().toLowerCase();
      const clientId = this.projectFilterClient();
      const dateStr = this.projectFilterDate();
      
      let projects = this.assignedProjects().filter(p => p.name.toLowerCase().includes(term));
      
      if (clientId) {
          projects = projects.filter(p => p.clientId === clientId);
      }
      
      if (dateStr) {
          projects = projects.filter(p => p.status === 'Active');
      }

      return projects;
  });

  paginatedProjects = computed(() => {
      const projects = this.filteredProjects();
      const start = (this.projectsPage() - 1) * this.projectsPerPage();
      return projects.slice(start, start + this.projectsPerPage());
  });

  onProjectsPageChange(page: number) {
      this.projectsPage.set(page);
  }

  // 2. Tasks
  taskSearch = signal('');
  taskFilterProject = signal<number | null>(null);
  taskFilterClient = signal<number | null>(null);
  tasksPage = signal(1);
  tasksPerPage = signal(5); // Synced with History

  memberTasks = computed(() => {
      const m = this.member();
      if (!m) return [];
      return this.allTasks()
        .filter(t => t.assignedMemberId === m.id && t.status !== 'Completed')
        .sort((a, b) => {
            const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
  });

  filteredTasks = computed(() => {
      const term = this.taskSearch().toLowerCase();
      const projectId = this.taskFilterProject();
      const clientId = this.taskFilterClient();

      let tasks = this.memberTasks().filter(t => t.title.toLowerCase().includes(term));

      if (projectId) {
          tasks = tasks.filter(t => t.projectId === projectId);
      }
      if (clientId) {
          const clientProjectIds = this.allProjects().filter(p => p.clientId === clientId).map(p => p.id);
          tasks = tasks.filter(t => clientProjectIds.includes(t.projectId));
      }

      return tasks;
  });

  paginatedTasks = computed(() => {
      const tasks = this.filteredTasks();
      const start = (this.tasksPage() - 1) * this.tasksPerPage();
      return tasks.slice(start, start + this.tasksPerPage());
  });

  onTasksPageChange(page: number) {
      this.tasksPage.set(page);
  }

  // 3. History
  historySearch = signal('');
  historyFilterProject = signal<number | null>(null);
  historyFilterClient = signal<number | null>(null);
  historyPage = signal(1);
  historyPerPage = signal(5); // Synced with Tasks

  loggedHoursHistory = computed<LoggedHourEntry[]>(() => {
      const m = this.member();
      if (!m) return [];
      
      const history: LoggedHourEntry[] = [];

      this.allProjects().forEach(p => {
          Object.entries(p.hours).forEach(([weekId, days]) => {
              Object.entries(days).forEach(([dayName, entry]: [string, any]) => {
                  if (entry.memberId === m.id) {
                      const [year, week] = weekId.split('-W').map(Number);
                      const simpleDate = new Date(year, 0, (week - 1) * 7 + 4); 
                      const dayOffset = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dayName);
                      if (dayOffset !== -1) {
                          simpleDate.setDate(simpleDate.getDate() + dayOffset);
                      }

                      history.push({
                          date: simpleDate,
                          project: p.name,
                          projectId: p.id,
                          clientId: p.clientId,
                          hours: entry.hours,
                          description: entry.description
                      });
                  }
              });
          });
      });

      return history.sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  filteredHistory = computed(() => {
      const term = this.historySearch().toLowerCase();
      const projectId = this.historyFilterProject();
      const clientId = this.historyFilterClient();

      let history = this.loggedHoursHistory().filter(h => 
          h.project.toLowerCase().includes(term) || 
          h.description.toLowerCase().includes(term)
      );

      if (projectId) {
          history = history.filter(h => h.projectId === projectId);
      }
      if (clientId) {
          history = history.filter(h => h.clientId === clientId);
      }

      return history;
  });

  paginatedHistory = computed(() => {
      const history = this.filteredHistory();
      const start = (this.historyPage() - 1) * this.historyPerPage();
      return history.slice(start, start + this.historyPerPage());
  });

  onHistoryPageChange(page: number) {
      this.historyPage.set(page);
  }

  // Form state signals
  memberName = signal('');
  memberEmail = signal('');
  memberRole = signal('');
  memberAvatarUrl = signal('');
  memberDefaultRate = signal(0);
  
  showSuccessToast = signal(false);
  toastMessage = signal('');

  // Email Modal
  isEmailModalOpen = signal(false);
  emailSubject = signal('');
  emailBody = signal('');

  constructor() {
    effect(() => {
      const m = this.member();
      if (m) {
        this.memberName.set(m.name);
        this.memberEmail.set(m.email);
        this.memberRole.set(m.role);
        this.memberAvatarUrl.set(m.avatarUrl);
        this.memberDefaultRate.set(m.defaultHourlyRate);
      }
    }, { allowSignalWrites: true });
  }

  saveMemberDetails(): void {
    const currentMember = this.member();
    if (!currentMember) return;

    const updatedMember: TeamMember = {
      ...currentMember,
      name: this.memberName(),
      email: this.memberEmail(),
      role: this.memberRole(),
      avatarUrl: this.memberAvatarUrl(),
      defaultHourlyRate: this.memberDefaultRate(),
    };

    this.dataService.updateTeamMember(updatedMember);
    this.triggerSuccessToast('Member details saved.');
  }
  
  deleteMember(): void {
      const m = this.member();
      if (m && confirm('Delete this member?')) {
          this.dataService.deleteTeamMember(m.id);
          this.router.navigate(['/app/team']);
      }
  }

  deactivateMember(): void {
      const m = this.member();
      if (m) {
          const newStatus = m.status === 'Active' ? 'Inactive' : 'Active';
          this.dataService.updateTeamMember({ ...m, status: newStatus });
          this.triggerSuccessToast(`Member ${newStatus === 'Active' ? 'Activated' : 'Deactivated'}`);
      }
  }

  // --- Email Logic ---
  openEmailModal(): void {
    this.emailSubject.set('');
    this.emailBody.set('');
    this.isEmailModalOpen.set(true);
  }

  closeEmailModal(): void {
    this.isEmailModalOpen.set(false);
  }

  sendEmail(): void {
    const m = this.member();
    if (!m || !this.emailSubject() || !this.emailBody()) return;

    console.log(`Sending email to ${m.email}`, {
      subject: this.emailSubject(),
      body: this.emailBody()
    });

    this.closeEmailModal();
    this.triggerSuccessToast('Email sent successfully!');
  }

  onAvatarFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          this.memberAvatarUrl.set(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  private triggerSuccessToast(message: string) {
    this.toastMessage.set(message);
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 3000);
  }
}
