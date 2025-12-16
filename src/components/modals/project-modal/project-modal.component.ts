
import { Component, ChangeDetectionStrategy, inject, signal, computed, output, input, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { MockDataService, Project } from '../../../services/mock-data.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';

@Component({
  selector: 'app-project-modal',
  templateUrl: './project-modal.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PaginationComponent, CurrencyPipe]
})
export class ProjectModalComponent {
  private dataService = inject(MockDataService);

  // Inputs/Outputs
  projectToEdit = input<Project | null>(null);
  close = output<void>();
  saved = output<void>();

  // Data
  clients = this.dataService.getClients();
  members = this.dataService.getTeamMembers();

  // Form State
  isEditMode = signal(false);
  editingProjectId = signal<number | null>(null);

  newProjectName = signal('');
  newProjectClientId = signal<number | null>(null);
  newProjectStatus = signal<'Active' | 'Completed' | 'Paused' | 'Archived'>('Active');
  newProjectBillingType = signal<'hourly' | 'fixed'>('hourly');
  newProjectFixedPrice = signal<number | undefined>(undefined);
  newProjectDefaultRate = signal<number | undefined>(undefined);
  newProjectDescription = signal('');
  newProjectMembers = signal<number[]>([]);
  newProjectRates = signal<{ [memberId: number]: number }>({});

  // Team Allocation Search & Pagination
  newProjectMemberSearch = signal('');
  newProjectMemberPage = signal(1);
  newProjectMemberPerPage = signal(5);

  constructor() {
    effect(() => {
      const p = this.projectToEdit();
      if (p) {
        this.isEditMode.set(true);
        this.editingProjectId.set(p.id);
        this.newProjectName.set(p.name);
        this.newProjectClientId.set(p.clientId);
        this.newProjectStatus.set(p.status);
        this.newProjectBillingType.set(p.billingType);
        this.newProjectFixedPrice.set(p.fixedPrice);
        this.newProjectDefaultRate.set(p.defaultRate);
        this.newProjectDescription.set(p.description || '');
        this.newProjectMembers.set([...p.allocatedTeamMemberIds]);
        this.newProjectRates.set({ ...p.memberRates });
      } else {
        this.isEditMode.set(false);
        this.editingProjectId.set(null);
        this.newProjectName.set('');
        this.newProjectClientId.set(null);
        this.newProjectStatus.set('Active');
        this.newProjectBillingType.set('hourly');
        this.newProjectFixedPrice.set(undefined);
        this.newProjectDefaultRate.set(undefined);
        this.newProjectDescription.set('');
        this.newProjectMembers.set([]);
        this.newProjectRates.set({});
      }
    }, { allowSignalWrites: true });
  }

  filteredNewProjectMembers = computed(() => {
    const term = this.newProjectMemberSearch().toLowerCase();
    const allMembers = this.members();
    if (!term) return allMembers;
    return allMembers.filter(m => 
        m.name.toLowerCase().includes(term) || 
        m.role.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term)
    );
  });

  paginatedNewProjectMembers = computed(() => {
      const members = this.filteredNewProjectMembers();
      const startIndex = (this.newProjectMemberPage() - 1) * this.newProjectMemberPerPage();
      return members.slice(startIndex, startIndex + this.newProjectMemberPerPage());
  });

  onNewProjectMemberPageChange(page: number) {
      this.newProjectMemberPage.set(page);
  }
  
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

          if (this.isEditMode() && this.editingProjectId()) {
              const original = this.projectToEdit();
              if (original) {
                  this.dataService.updateProject({
                      ...original,
                      name: this.newProjectName(),
                      clientId: this.newProjectClientId()!,
                      description: this.newProjectDescription(),
                      status: this.newProjectStatus(),
                      billingType: this.newProjectBillingType(),
                      fixedPrice: this.newProjectBillingType() === 'fixed' ? this.newProjectFixedPrice() : undefined,
                      defaultRate: this.newProjectBillingType() === 'hourly' ? this.newProjectDefaultRate() : undefined,
                      allocatedTeamMemberIds: this.newProjectMembers(),
                      memberRates: rates
                  });
              }
          } else {
              this.dataService.addProject({
                  clientId: this.newProjectClientId()!,
                  name: this.newProjectName(),
                  description: this.newProjectDescription(),
                  status: this.newProjectStatus(),
                  billingType: this.newProjectBillingType(),
                  fixedPrice: this.newProjectBillingType() === 'fixed' ? this.newProjectFixedPrice() : undefined,
                  defaultRate: this.newProjectBillingType() === 'hourly' ? this.newProjectDefaultRate() : undefined,
                  allocatedTeamMemberIds: this.newProjectMembers(),
                  memberRates: rates
              });
          }
          
          this.saved.emit();
          this.close.emit();
      }
  }
}
