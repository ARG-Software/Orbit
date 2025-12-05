
import { Component, ChangeDetectionStrategy, inject, Signal, effect, signal, computed } from '@angular/core';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { MockDataService, Project, TeamMember, Client } from '../../services/mock-data.service';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, NgClass, DatePipe } from '@angular/common';
import { PaginationComponent } from '../shared/pagination/pagination.component';

@Component({
  selector: 'app-project-detail',
  templateUrl: './project-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DecimalPipe, NgClass, DatePipe, PaginationComponent],
})
export class ProjectDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;

  project: Signal<Project | undefined> = toSignal(
    this.route.paramMap.pipe(
      map((params: ParamMap) => Number(params.get('id'))),
      switchMap(id => this.dataService.getProjectById(id))
    )
  );

  clients = this.dataService.getClients();
  allMembers = this.dataService.getTeamMembers();

  // Editable Fields
  projectName = signal('');
  projectDescription = signal('');
  projectStatus = signal<'Active' | 'Completed' | 'Paused'>('Active');
  projectClientId = signal<number | null>(null);
  allocatedMemberIds = signal<number[]>([]);
  memberRates = signal<{ [id: number]: number }>({});
  projectFixedPrice = signal<number | undefined>(undefined);
  projectDefaultRate = signal<number | undefined>(undefined);

  // Comments & Files
  newComment = signal('');
  isUploading = signal(false);

  // Add Member Modal State
  showAddMemberModal = signal(false);
  addMemberPage = signal(1);
  addMemberPerPage = signal(5);

  showSuccessToast = signal(false);

  constructor() {
    effect(() => {
      const p = this.project();
      if (p) {
        this.projectName.set(p.name);
        this.projectDescription.set(p.description || '');
        this.projectStatus.set(p.status);
        this.projectClientId.set(p.clientId);
        this.projectFixedPrice.set(p.fixedPrice);
        this.projectDefaultRate.set(p.defaultRate);
        this.allocatedMemberIds.set([...p.allocatedTeamMemberIds]);
        this.memberRates.set({ ...p.memberRates });
      }
    }, { allowSignalWrites: true });
  }

  // Helpers
  getClient(id: number | null) {
    return this.clients().find(c => c.id === id);
  }

  getMember(id: number) {
    return this.allMembers().find(m => m.id === id);
  }

  // --- Team Management ---

  // List of members NOT currently allocated (for the modal)
  availableMembersToAdd = computed(() => {
      const all = this.allMembers();
      const currentIds = this.allocatedMemberIds();
      return all.filter(m => !currentIds.includes(m.id));
  });

  paginatedAvailableMembers = computed(() => {
      const members = this.availableMembersToAdd();
      const start = (this.addMemberPage() - 1) * this.addMemberPerPage();
      return members.slice(start, start + this.addMemberPerPage());
  });

  onAddMemberPageChange(page: number) {
      this.addMemberPage.set(page);
  }

  openAddMemberModal() {
      this.addMemberPage.set(1);
      this.showAddMemberModal.set(true);
  }

  closeAddMemberModal() {
      this.showAddMemberModal.set(false);
  }

  addMemberToProject(member: TeamMember) {
      this.allocatedMemberIds.update(ids => [...ids, member.id]);
      // Use project default rate if available, else member default
      const rate = this.projectDefaultRate() ?? member.defaultHourlyRate;
      this.memberRates.update(rates => ({ ...rates, [member.id]: rate }));
  }

  removeMemberFromProject(memberId: number) {
      this.allocatedMemberIds.update(ids => ids.filter(id => id !== memberId));
      this.memberRates.update(rates => {
          const { [memberId]: removed, ...rest } = rates;
          return rest;
      });
  }

  updateRate(memberId: number, rate: number) {
    this.memberRates.update(rates => ({ ...rates, [memberId]: rate }));
  }

  saveChanges() {
    const p = this.project();
    if (!p || !this.projectName() || !this.projectClientId()) return;

    // Rebuild rates object only for allocated members
    const finalRates: { [id: number]: number } = {};
    this.allocatedMemberIds().forEach(id => {
        const member = this.getMember(id);
        finalRates[id] = this.memberRates()[id] ?? this.projectDefaultRate() ?? member?.defaultHourlyRate ?? 0;
    });

    const updatedProject: Project = {
        ...p,
        name: this.projectName(),
        description: this.projectDescription(),
        status: this.projectStatus(),
        clientId: this.projectClientId()!,
        fixedPrice: this.projectFixedPrice(),
        defaultRate: this.projectDefaultRate(),
        allocatedTeamMemberIds: this.allocatedMemberIds(),
        memberRates: finalRates
    };

    this.dataService.updateProject(updatedProject);
    this.triggerSuccessToast();
  }

  deleteProject() {
    if (confirm('Are you sure you want to delete this project? All associated boards and tasks will also be deleted.')) {
        const p = this.project();
        if (p) {
            this.dataService.deleteProject(p.id);
            this.router.navigate(['/projects']);
        }
    }
  }
  
  addComment() {
      const p = this.project();
      const text = this.newComment();
      const user = this.currentUser();
      
      if (!p || !text.trim()) return;
      
      this.dataService.addProjectComment(p.id, {
          text,
          authorId: user ? user.id : 0
      });
      this.newComment.set('');
  }

  triggerFileUpload(fileInput: HTMLInputElement) {
      fileInput.click();
  }

  onFileSelected(event: Event) {
      const p = this.project();
      const user = this.currentUser();
      const input = event.target as HTMLInputElement;
      
      if (!p || !input.files || input.files.length === 0) return;
      
      const file = input.files[0];
      this.isUploading.set(true);

      // Simulate upload delay
      setTimeout(() => {
          this.dataService.addProjectFile(p.id, {
              name: file.name,
              url: '#', // Mock URL
              uploadedBy: user ? user.id : 0
          });
          this.isUploading.set(false);
          input.value = ''; // Reset input
      }, 1000);
  }

  projectActivity = computed(() => {
      const p = this.project();
      if (!p) return [];

      const comments = (p.comments || []).map(c => ({
          type: 'comment',
          id: c.id,
          date: c.createdAt,
          content: c.text,
          user: this.getMember(c.authorId)
      }));

      const files = (p.files || []).map(f => ({
          type: 'file',
          id: f.id,
          date: f.uploadedAt,
          content: f.name,
          user: this.getMember(f.uploadedBy),
          url: f.url
      }));

      return [...comments, ...files].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  private triggerSuccessToast() {
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 3000);
  }
}
