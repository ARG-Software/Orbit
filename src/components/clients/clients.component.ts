import { Component, ChangeDetectionStrategy, inject, signal, Signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MockDataService, Client } from '../../services/mock-data.service';
import { FormsModule } from '@angular/forms';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, PaginationComponent],
})
export class ClientsComponent {
  private dataService = inject(MockDataService);
  private router = inject(Router);

  clients = this.dataService.getClients();
  
  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(8);

  paginatedClients = computed(() => {
    const clients = this.clients();
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return clients.slice(startIndex, endIndex);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  // --- Add Client Modal State ---
  isModalOpen = signal(false);

  // Form fields for adding a client
  clientName = signal('');
  clientContact = signal('');
  clientPhone = signal('');
  clientAddress = signal('');
  clientTaxNumber = signal('');
  clientLogoUrl = signal(''); // Will hold data URL or string
  clientColor = signal('#6366f1'); // Default color
  clientTaxRate = signal<number>(0);

  // --- Email Modal State ---
  isEmailModalOpen = signal(false);
  selectedClientForEmail = signal<Client | null>(null);
  emailSubject = signal('');
  emailBody = signal('');
  showSuccessToast = signal(false);

  private resetForm(): void {
    this.clientName.set('');
    this.clientContact.set('');
    this.clientPhone.set('');
    this.clientAddress.set('');
    this.clientTaxNumber.set('');
    this.clientLogoUrl.set('');
    this.clientColor.set('#6366f1');
    this.clientTaxRate.set(0);
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
        color: this.clientColor(),
        defaultTaxRate: this.clientTaxRate(),
    };

    this.dataService.addClient(clientData);
    this.closeModal();
  }

  deleteClient(clientId: number): void {
    if (confirm('Are you sure you want to delete this client? All associated projects and data will be affected.')) {
      this.dataService.deleteClient(clientId);
    }
  }

  navigateToClient(clientId: number): void {
    this.router.navigate(['/clients', clientId]);
  }

  // --- Email Logic ---

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

    // Simulation of sending email
    console.log(`Sending email to ${client.contact}`, {
      subject: this.emailSubject(),
      body: this.emailBody()
    });

    this.closeEmailModal();
    this.triggerSuccessToast();
  }

  private triggerSuccessToast() {
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 3000);
  }
}