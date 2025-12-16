
import { Component, ChangeDetectionStrategy, inject, signal, Signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MockDataService, Client } from '../../services/mock-data.service';
import { FormsModule } from '@angular/forms';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { NgOptimizedImage, CurrencyPipe, DecimalPipe } from '@angular/common';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, PaginationComponent, CurrencyPipe, DecimalPipe],
})
export class ClientsComponent {
  private dataService = inject(MockDataService);
  private router: Router = inject(Router);
  public translationService = inject(TranslationService);

  clients = this.dataService.getClients();
  invoices = this.dataService.getInvoices();
  projects = this.dataService.getProjects();
  
  // Filters
  searchTerm = signal('');
  filterStatus = signal<'All' | 'Active' | 'Paused'>('All');
  sortBy = signal<'Name' | 'Revenue'>('Name');
  minRevenue = signal<number | null>(null);

  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(12);

  // Helper to get total revenue for a client
  private getRevenue(clientId: number): number {
      return this.invoices()
          .filter(i => i.clientId === clientId && i.status === 'Paid')
          .reduce((sum, inv) => sum + inv.total, 0);
  }

  filteredClients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.filterStatus();
    const sort = this.sortBy();
    const minRev = this.minRevenue();
    
    // 1. Filter
    let result = this.clients().filter(client => {
      const matchesSearch = 
        client.name.toLowerCase().includes(term) || 
        client.contact.toLowerCase().includes(term) ||
        client.taxNumber.toLowerCase().includes(term);
      
      const matchesStatus = status === 'All' || client.status === status;
      
      let matchesRevenue = true;
      if (minRev !== null) {
          matchesRevenue = this.getRevenue(client.id) >= minRev;
      }

      return matchesSearch && matchesStatus && matchesRevenue;
    });

    // 2. Sort
    if (sort === 'Name') {
        result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'Revenue') {
        result.sort((a, b) => this.getRevenue(b.id) - this.getRevenue(a.id)); // Descending
    }

    return result;
  });

  paginatedClients = computed(() => {
    const clients = this.filteredClients();
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return clients.slice(startIndex, startIndex + this.itemsPerPage());
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }
  
  onFilterChange(): void {
    this.currentPage.set(1);
  }

  getClientStats(clientId: number) {
      const totalRevenue = this.getRevenue(clientId);
      const activeProjects = this.projects().filter(p => p.clientId === clientId && p.status === 'Active').length;
      return { totalRevenue, activeProjects };
  }

  isModalOpen = signal(false);

  clientName = signal('');
  clientContact = signal('');
  clientPhone = signal('');
  clientAddress = signal('');
  clientTaxNumber = signal('');
  clientLogoUrl = signal('');
  clientTaxRate = signal<number>(0);
  clientNotes = signal('');

  isEmailModalOpen = signal(false);
  selectedClientForEmail = signal<Client | null>(null);
  emailSubject = signal('');
  emailBody = signal('');
  
  showSuccessToast = signal(false);
  toastMessage = signal('');

  private resetForm(): void {
    this.clientName.set('');
    this.clientContact.set('');
    this.clientPhone.set('');
    this.clientAddress.set('');
    this.clientTaxNumber.set('');
    this.clientLogoUrl.set('');
    this.clientTaxRate.set(0);
    this.clientNotes.set('');
  }

  openAddModal(): void {
    this.resetForm();
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.resetForm();
  }

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          this.clientLogoUrl.set(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  saveClient(): void {
    if(!this.clientName() || !this.clientContact()) {
      return;
    }

    const clientData = {
        name: this.clientName(),
        contact: this.clientContact(),
        phone: this.clientPhone(),
        address: this.clientAddress(),
        taxNumber: this.clientTaxNumber(),
        logoUrl: this.clientLogoUrl(),
        defaultTaxRate: this.clientTaxRate(),
        notes: this.clientNotes(),
    };

    this.dataService.addClient(clientData);
    this.triggerSuccessToast('Client added successfully!');
    this.closeModal();
  }

  deleteClient(clientId: number): void {
    if (confirm('Are you sure you want to delete this client? All associated projects and data will be affected.')) {
      this.dataService.deleteClient(clientId);
      this.triggerSuccessToast('Client deleted.');
    }
  }

  toggleStatus(client: Client): void {
    const newStatus = client.status === 'Active' ? 'Paused' : 'Active';
    this.dataService.updateClient({ ...client, status: newStatus });
    this.triggerSuccessToast(`Client ${newStatus === 'Active' ? 'Resumed' : 'Paused'}`);
  }

  navigateToClient(clientId: number): void {
    this.router.navigate(['/app/clients', clientId]);
  }

  openEmailModal(client: Client): void {
    this.selectedClientForEmail.set(client);
    this.emailSubject.set('');
    this.emailBody.set('');
    this.isEmailModalOpen.set(true);
  }

  closeEmailModal(): void {
    this.isEmailModalOpen.set(false);
    this.selectedClientForEmail.set(null);
  }

  sendEmail(): void {
    const client = this.selectedClientForEmail();
    if (!client || !this.emailSubject() || !this.emailBody()) return;

    console.log(`Sending email to ${client.contact}`, {
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
}
