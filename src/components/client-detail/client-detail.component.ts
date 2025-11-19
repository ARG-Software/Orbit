
import { Component, ChangeDetectionStrategy, inject, Signal, computed, signal, effect, WritableSignal } from '@angular/core';
import { AsyncPipe, DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { MockDataService, Client, TeamMember, Project } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, RouterLink, DecimalPipe, DatePipe, PaginationComponent, FormsModule],
})
export class ClientDetailComponent {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private dataService = inject(MockDataService);

  private clientId: Signal<number> = toSignal(
      this.route.paramMap.pipe(map(params => Number(params.get('id')))),
      { initialValue: 0}
  );

  client: Signal<Client | undefined> = toSignal(
    this.route.paramMap.pipe(
      map(params => Number(params.get('id'))),
      switchMap(id => this.dataService.getClientById(id))
    )
  );

  projects: Signal<Project[]> = toSignal(
    this.route.paramMap.pipe(
      map(params => Number(params.get('id'))),
      switchMap(id => this.dataService.getProjectsByClientId(id))
    ), { initialValue: [] }
  );

  allMembers: Signal<TeamMember[]> = toSignal(this.dataService.getTeamMembers(), { initialValue: [] });
  
  // Form state signals for Client Details
  clientName = signal('');
  clientContact = signal('');
  clientPhone = signal('');
  clientAddress = signal('');
  clientTaxNumber = signal('');
  clientColor = signal('#6366f1');
  clientStatus = signal<'Active' | 'Paused'>('Active');
  clientTaxRate = signal(0);
  
  // Modal state signals for Project
  isProjectModalOpen = signal(false);
  editingProject: WritableSignal<Project | null> = signal(null);
  projectName = signal('');
  projectStatus = signal<'Active' | 'Completed' | 'On Hold'>('Active');
  projectAllocatedMemberIds = signal<number[]>([]);
  projectMemberRates = signal<{ [memberId: number]: number }>({});


  showSuccessToast = signal(false);

  constructor() {
    effect(() => {
      const c = this.client();
      if (c) {
        this.clientName.set(c.name);
        this.clientContact.set(c.contact);
        this.clientPhone.set(c.phone);
        this.clientAddress.set(c.address);
        this.clientTaxNumber.set(c.taxNumber);
        this.clientColor.set(c.color || '#6366f1');
        this.clientStatus.set(c.status);
        this.clientTaxRate.set(c.defaultTaxRate || 0);
      }
    }, { allowSignalWrites: true });
  }

  saveClientDetails(): void {
    const currentClient = this.client();
    if (!currentClient) return;

    const updatedClient: Client = {
      ...currentClient,
      name: this.clientName(),
      contact: this.clientContact(),
      phone: this.clientPhone(),
      address: this.clientAddress(),
      taxNumber: this.clientTaxNumber(),
      color: this.clientColor(),
      status: this.clientStatus(),
      defaultTaxRate: this.clientTaxRate(),
    };

    this.dataService.updateClient(updatedClient);
    this.triggerSuccessToast('Client details saved');
  }

  // --- Project Modal Logic ---

  private resetProjectForm(): void {
    this.editingProject.set(null);
    this.projectName.set('');
    this.projectStatus.set('Active');
    this.projectAllocatedMemberIds.set([]);
    this.projectMemberRates.set({});
  }

  openAddProjectModal(): void {
    this.resetProjectForm();
    this.isProjectModalOpen.set(true);
  }

  openEditProjectModal(project: Project): void {
    this.editingProject.set(project);
    this.projectName.set(project.name);
    this.projectStatus.set(project.status);
    this.projectAllocatedMemberIds.set([...project.allocatedTeamMemberIds]);
    this.projectMemberRates.set({ ...project.memberRates });
    this.isProjectModalOpen.set(true);
  }

  closeProjectModal(): void {
    this.isProjectModalOpen.set(false);
    this.resetProjectForm();
  }

  onMemberSelectionChange(memberId: number, isChecked: boolean): void {
    this.projectAllocatedMemberIds.update(ids => {
      if (isChecked) {
        return [...ids, memberId];
      } else {
        return ids.filter(id => id !== memberId);
      }
    });
  }

  updateProjectMemberRate(memberId: number, rate: number): void {
    this.projectMemberRates.update(rates => ({
      ...rates,
      [memberId]: rate || 0
    }));
  }

  saveProject(): void {
    const projToEdit = this.editingProject();
    
    const memberRates: { [memberId: number]: number } = {};
    this.projectAllocatedMemberIds().forEach(id => {
      const member = this.allMembers().find(m => m.id === id);
      if (member) {
        memberRates[id] = this.projectMemberRates()[id] ?? member.defaultHourlyRate;
      }
    });

    if (projToEdit) { // Editing existing project
      const updatedProject: Project = {
        ...projToEdit,
        name: this.projectName(),
        status: this.projectStatus(),
        allocatedTeamMemberIds: this.projectAllocatedMemberIds(),
        memberRates: memberRates,
      };
      this.dataService.updateProject(updatedProject);
    } else { // Adding new project
      this.dataService.addProject({
        clientId: this.clientId(),
        name: this.projectName(),
        status: this.projectStatus(),
        allocatedTeamMemberIds: this.projectAllocatedMemberIds(),
        memberRates: memberRates,
      });
    }
    
    this.triggerSuccessToast(projToEdit ? 'Project updated' : 'Project added');
    this.closeProjectModal();
  }
  
  // --- General ---

  private triggerSuccessToast(message: string) {
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 3000);
  }

  getMemberById(id: number): TeamMember | undefined {
    return this.allMembers().find(m => m.id === id);
  }

  getStatusClass(status: 'Active' | 'Completed' | 'On Hold'): string {
    switch (status) {
      case 'Active':
      case 'Completed': return 'badge-success';
      case 'On Hold': return 'badge-warning';
      default: return 'badge';
    }
  }
}
