
import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockDataService, Payment } from '../../services/mock-data.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ActivatedRoute } from '@angular/router';
import { PaymentModalComponent } from '../modals/payment-modal/payment-modal.component';

@Component({
  selector: 'app-payments',
  templateUrl: './payments.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe, CurrencyPipe, PaginationComponent, PaymentModalComponent],
})
export class PaymentsComponent {
  private dataService = inject(MockDataService);
  private route = inject(ActivatedRoute);

  // Data Signals
  allPayments = this.dataService.getPayments();
  members = this.dataService.getTeamMembers();
  projects = this.dataService.getProjects();

  // Tabs
  activeTab = signal<'history' | 'debts'>('history');

  // List View State
  statusFilter = signal<'All' | 'Paid' | 'Pending' | 'Processing'>('All');
  searchQuery = signal('');
  currentPage = signal(1);
  itemsPerPage = signal(10);

  // Modal State
  isModalOpen = signal(false);
  modalMemberId = signal<number | null>(null);
  modalProjectId = signal<number | null>(null);
  modalAmount = signal<number | null>(null);
  modalRef = signal('');

  constructor() {
    this.route.queryParams.subscribe(params => {
        if (params['action'] === 'pay' && params['memberId']) {
            this.openPaymentModal(Number(params['memberId']), Number(params['amount']), params['ref']);
        }
    });
  }

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

  // --- Debt Computation ---
  
  outstandingDebts = computed(() => {
      const debts: { memberId: number, memberName: string, projectId: number, projectName: string, amount: number, avatar: string }[] = [];
      const projects = this.projects();
      const members = this.members();

      projects.forEach(p => {
          p.allocatedTeamMemberIds.forEach(mId => {
              const debt = this.dataService.getMemberDebt(mId, p.id);
              if (debt > 0) {
                  const m = members.find(mem => mem.id === mId);
                  if (m) {
                      debts.push({
                          memberId: mId,
                          memberName: m.name,
                          avatar: m.avatarUrl,
                          projectId: p.id,
                          projectName: p.name,
                          amount: debt
                      });
                  }
              }
          });
      });
      
      return debts.sort((a, b) => b.amount - a.amount);
  });

  // --- Actions ---

  onPageChange(page: number) {
      this.currentPage.set(page);
  }

  openPaymentModal(memberId?: number, amount?: number, ref?: string, projectId?: number) {
      this.modalMemberId.set(memberId || null);
      this.modalAmount.set(amount || null);
      this.modalRef.set(ref || '');
      this.modalProjectId.set(projectId || null);
      this.isModalOpen.set(true);
  }

  closeModal() {
      this.isModalOpen.set(false);
      this.modalMemberId.set(null);
      this.modalAmount.set(null);
      this.modalRef.set('');
      this.modalProjectId.set(null);
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
