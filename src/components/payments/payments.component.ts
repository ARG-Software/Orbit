
import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockDataService, Payment, TeamMember } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';

@Component({
  selector: 'app-payments',
  templateUrl: './payments.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe, CurrencyPipe, PaginationComponent],
})
export class PaymentsComponent {
  private dataService = inject(MockDataService);

  // Data Signals
  allPayments = this.dataService.getPayments();
  members = this.dataService.getTeamMembers();

  // List View State
  statusFilter = signal<'All' | 'Paid' | 'Pending' | 'Processing'>('All');
  searchQuery = signal('');
  currentPage = signal(1);
  itemsPerPage = signal(10);

  // Wizard State
  isModalOpen = signal(false);
  currentStep = signal<1 | 2 | 3>(1);
  
  // New Payment Form Data
  newPayRecipientType = signal<'existing' | 'new'>('existing');
  selectedMemberId = signal<number | null>(null);
  
  // Fields
  recipientName = signal('');
  recipientRole = signal('');
  recipientEmail = signal('');
  recipientIban = signal('');
  recipientBank = signal('');
  
  payAmount = signal<number | null>(null);
  payCurrency = signal('USD');
  payDescription = signal('');
  payMethod = signal<'Revolut' | 'Wise' | 'PayPal' | 'Viva' | 'Manual' | null>(null);

  // --- List Computations ---
  
  filteredPayments = computed(() => {
      let payments = this.allPayments();
      const status = this.statusFilter();
      const query = this.searchQuery().toLowerCase();

      if (status !== 'All') {
          payments = payments.filter(p => p.status === status);
      }

      if (query) {
          payments = payments.filter(p => 
              p.recipientName.toLowerCase().includes(query) || 
              p.description.toLowerCase().includes(query)
          );
      }

      return payments.sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  paginatedPayments = computed(() => {
      const start = (this.currentPage() - 1) * this.itemsPerPage();
      return this.filteredPayments().slice(start, start + this.itemsPerPage());
  });

  totalPaidThisMonth = computed(() => {
      const now = new Date();
      return this.allPayments()
        .filter(p => p.status === 'Paid' && p.date.getMonth() === now.getMonth() && p.date.getFullYear() === now.getFullYear())
        .reduce((sum, p) => sum + p.amount, 0);
  });

  pendingAmount = computed(() => {
      return this.allPayments()
        .filter(p => p.status === 'Pending' || p.status === 'Processing')
        .reduce((sum, p) => sum + p.amount, 0);
  });

  processedCount = computed(() => {
      return this.allPayments().filter(p => p.status === 'Paid').length;
  });

  // --- Actions ---

  onPageChange(page: number) {
      this.currentPage.set(page);
  }

  openNewPaymentModal() {
      // Reset
      this.currentStep.set(1);
      this.newPayRecipientType.set('existing');
      this.selectedMemberId.set(null);
      this.recipientName.set('');
      this.recipientRole.set('');
      this.recipientEmail.set('');
      this.recipientIban.set('');
      this.recipientBank.set('');
      this.payAmount.set(null);
      this.payDescription.set('');
      this.payMethod.set(null);
      
      this.isModalOpen.set(true);
  }

  closeModal() {
      this.isModalOpen.set(false);
  }

  onMemberSelect(memberId: number) {
      const member = this.members().find(m => m.id === memberId);
      if (member) {
          this.selectedMemberId.set(member.id);
          this.recipientName.set(member.name);
          this.recipientRole.set(member.role);
          this.recipientEmail.set(member.email);
          // Mock bank details if available in member object (assuming extended model)
          this.recipientIban.set(member.paymentDetails?.iban || '');
          this.recipientBank.set(member.paymentDetails?.bankName || '');
      }
  }

  nextStep() {
      if (this.currentStep() === 1) {
          if (!this.recipientName() || !this.recipientEmail()) {
              alert('Please fill in recipient details.');
              return;
          }
      } else if (this.currentStep() === 2) {
          if (!this.payAmount() || this.payAmount()! <= 0 || !this.payDescription()) {
              alert('Please enter a valid amount and description.');
              return;
          }
      }
      this.currentStep.set((this.currentStep() + 1) as any);
  }

  prevStep() {
      this.currentStep.set((this.currentStep() - 1) as any);
  }

  selectMethod(method: 'Revolut' | 'Wise' | 'PayPal' | 'Viva' | 'Manual') {
      this.payMethod.set(method);
  }

  processExternalRedirect() {
      const method = this.payMethod();
      const amount = this.payAmount();
      const currency = this.payCurrency();
      const email = this.recipientEmail();
      
      // 1. Construct External URL (Mocked Logic)
      let url = '';
      
      switch (method) {
          case 'PayPal':
              // Generic PayPal Send link
              url = `https://www.paypal.com/myaccount/transfer/homepage/buy/preview?amount=${amount}&currencyCode=${currency}&recipient=${email}`; 
              break;
          case 'Wise':
              url = `https://wise.com/send?amount=${amount}&sourceCurrency=${currency}&targetCurrency=${currency}`;
              break;
          case 'Revolut':
              // Revolut Me link (requires username usually, mocking generic)
              url = `https://revolut.me/`; 
              break;
          case 'Viva':
              url = `https://www.vivawallet.com/checkout`;
              break;
          case 'Manual':
              alert(`Please log in to your bank (${this.recipientBank() || 'Provider'}) and transfer ${currency} ${amount} to ${this.recipientIban()}.`);
              break;
      }

      // 2. Add Payment Record to Orbit (Status: Pending/Processing)
      this.dataService.addPayment({
          recipientName: this.recipientName(),
          recipientRole: this.recipientRole() || 'Contractor',
          recipientEmail: this.recipientEmail(),
          amount: amount!,
          currency: currency,
          method: method!,
          description: this.payDescription()
      });

      // 3. Redirect (if not manual)
      if (method !== 'Manual' && url) {
          window.open(url, '_blank');
      }

      this.closeModal();
  }

  getStatusClass(status: string): string {
      switch(status) {
          case 'Paid': return 'badge-success';
          case 'Pending': return 'badge-warning';
          case 'Processing': return 'badge-info';
          case 'Failed': return 'badge-error';
          default: return 'badge-ghost';
      }
  }
}
