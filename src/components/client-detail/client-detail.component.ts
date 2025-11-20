
import { Component, ChangeDetectionStrategy, inject, Signal, computed, signal, effect } from '@angular/core';
import { AsyncPipe, DecimalPipe, DatePipe, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { MockDataService, Client, TeamMember, Project } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, RouterLink, DecimalPipe, DatePipe, PaginationComponent, FormsModule, NgIf],
})
export class ClientDetailComponent {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private dataService = inject(MockDataService);

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

  allMembers = this.dataService.getTeamMembers();
  
  // Form state signals for Client Details
  clientName = signal('');
  clientContact = signal('');
  clientPhone = signal('');
  clientAddress = signal('');
  clientTaxNumber = signal('');
  clientColor = signal('#6366f1');
  clientStatus = signal<'Active' | 'Paused'>('Active');
  clientTaxRate = signal(0);
  
  // Pagination for Projects
  currentPage = signal(1);
  itemsPerPage = signal(5);

  paginatedProjects = computed(() => {
    const all = this.projects();
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    return all.slice(start, start + this.itemsPerPage());
  });

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
  
  onPageChange(page: number) {
    this.currentPage.set(page);
  }

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
