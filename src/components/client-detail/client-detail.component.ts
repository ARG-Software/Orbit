
import { Component, ChangeDetectionStrategy, inject, Signal, computed, signal, effect } from '@angular/core';
import { AsyncPipe, DecimalPipe, DatePipe, NgIf, CurrencyPipe, NgClass } from '@angular/common';
import { ActivatedRoute, RouterLink, Router, ParamMap } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { MockDataService, Client, TeamMember, Project } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, RouterLink, DecimalPipe, DatePipe, PaginationComponent, FormsModule, NgIf, CurrencyPipe, NgClass],
})
export class ClientDetailComponent {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private dataService = inject(MockDataService);

  client: Signal<Client | undefined> = toSignal(
    this.route.paramMap.pipe(
      map((params: ParamMap) => Number(params.get('id'))),
      switchMap((id: number) => this.dataService.getClientById(id))
    )
  );

  projects: Signal<Project[]> = toSignal(
    this.route.paramMap.pipe(
      map((params: ParamMap) => Number(params.get('id'))),
      switchMap((id: number) => this.dataService.getProjectsByClientId(id))
    ), { initialValue: [] }
  );

  invoices = this.dataService.getInvoices();
  meetings = this.dataService.getMeetings();
  allMembers = this.dataService.getTeamMembers();
  
  activeTab = signal<'projects' | 'invoices' | 'meetings'>('projects');

  clientStats = computed(() => {
      const c = this.client();
      if (!c) return null;
      
      const clientInvoices = this.invoices().filter(i => i.clientId === c.id);
      const totalRevenue = clientInvoices.filter(i => i.status === 'Paid').reduce((acc, i) => acc + i.total, 0);
      const outstandingAmount = clientInvoices.filter(i => i.status === 'Pending' || i.status === 'Overdue').reduce((acc, i) => acc + i.total, 0);
      
      const activeProjects = this.projects().filter(p => p.status === 'Active').length;
      
      const now = new Date();
      const upcomingMeetings = this.meetings().filter(m => m.clientId === c.id && m.startTime > now).length;

      return { totalRevenue, outstandingAmount, activeProjects, upcomingMeetings };
  });

  clientInvoicesList = computed(() => {
      const id = this.client()?.id;
      if (!id) return [];
      return this.invoices().filter(i => i.clientId === id).sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  });

  clientMeetingsList = computed(() => {
      const id = this.client()?.id;
      if (!id) return [];
      return this.meetings().filter(m => m.clientId === id).sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  });

  clientName = signal('');
  clientContact = signal('');
  clientPhone = signal('');
  clientAddress = signal('');
  clientTaxNumber = signal('');
  clientStatus = signal<'Active' | 'Paused'>('Active');
  clientTaxRate = signal(0);
  clientNotes = signal('');
  
  currentPage = signal(1);
  itemsPerPage = signal(6);

  paginatedProjects = computed(() => {
    const all = this.projects();
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    return all.slice(start, start + this.itemsPerPage());
  });

  showSuccessToast = signal(false);
  toastMessage = signal('');

  isEmailModalOpen = signal(false);
  emailSubject = signal('');
  emailBody = signal('');

  constructor() {
    effect(() => {
      const c = this.client();
      if (c) {
        this.clientName.set(c.name);
        this.clientContact.set(c.contact);
        this.clientPhone.set(c.phone);
        this.clientAddress.set(c.address);
        this.clientTaxNumber.set(c.taxNumber);
        this.clientStatus.set(c.status);
        this.clientTaxRate.set(c.defaultTaxRate || 0);
        this.clientNotes.set(c.notes || '');
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
      status: this.clientStatus(),
      defaultTaxRate: this.clientTaxRate(),
      notes: this.clientNotes(),
    };

    this.dataService.updateClient(updatedClient);
    this.triggerSuccessToast('Client details saved');
  }
  
  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  deleteClient(): void {
      const c = this.client();
      if (c && confirm('Are you sure you want to delete this client? All data will be lost.')) {
          this.dataService.deleteClient(c.id);
          this.router.navigate(['/app/clients']);
      }
  }

  toggleStatus(): void {
      const c = this.client();
      if (c) {
          const newStatus = c.status === 'Active' ? 'Paused' : 'Active';
          this.dataService.updateClient({ ...c, status: newStatus });
          this.triggerSuccessToast(`Client ${newStatus === 'Active' ? 'Resumed' : 'Paused'}`);
      }
  }

  openEmailModal(): void {
    this.emailSubject.set('');
    this.emailBody.set('');
    this.isEmailModalOpen.set(true);
  }

  closeEmailModal(): void {
    this.isEmailModalOpen.set(false);
  }

  sendEmail(): void {
    const c = this.client();
    if (!c || !this.emailSubject() || !this.emailBody()) return;

    console.log(`Sending email to ${c.contact}`, {
      subject: this.emailSubject(),
      body: this.emailBody()
    });

    this.closeEmailModal();
    this.triggerSuccessToast('Email sent successfully!');
  }

  private triggerSuccessToast(message: string) {
    this.toastMessage.set(message);
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
