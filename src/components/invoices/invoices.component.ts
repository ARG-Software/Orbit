
import { Component, ChangeDetectionStrategy, computed, inject, signal, effect, Signal } from '@angular/core';
import { DecimalPipe, DatePipe, KeyValuePipe, TitleCasePipe, CurrencyPipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { MockDataService, Client, Invoice, TeamMember, Project, Task } from '../../services/mock-data.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { RouterLink } from '@angular/router';
import { switchMap, map } from 'rxjs';
import { of, forkJoin } from 'rxjs';
import { PaginationComponent } from '../shared/pagination/pagination.component';

interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  type: 'hourly' | 'fixed';
}

@Component({
  selector: 'app-invoices',
  templateUrl: './invoices.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, DatePipe, RouterLink, PaginationComponent, KeyValuePipe, TitleCasePipe, CurrencyPipe],
})
export class InvoicesComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);

  // --- Tab Management ---
  activeTab = signal<'create' | 'history'>('create');

  // --- Data Signals ---
  clients = this.dataService.getClients();
  members = this.dataService.getTeamMembers();
  user = this.authService.currentUser;
  allProjects = this.dataService.getProjects();
  allInvoices = this.dataService.getInvoices();

  // --- Metrics ---
  totalOutstanding = computed(() => {
      return this.allInvoices()
        .filter(i => i.type === 'Revenue' && (i.status === 'Pending' || i.status === 'Overdue'))
        .reduce((acc, i) => acc + i.total, 0);
  });

  processedCount = computed(() => {
      return this.allInvoices()
        .filter(i => i.type === 'Revenue' && i.status === 'Paid')
        .length;
  });

  // --- Create Invoice Signals ---
  selectedClientId = signal<number | null>(null);
  
  // Manual Client Entry State
  manualClientName = signal('');
  manualClientEmail = signal('');
  manualClientAddress = signal('');
  manualClientTaxNumber = signal('');

  // Available projects for selected Client
  relevantProjects = computed(() => {
      const clientId = this.selectedClientId();
      return clientId ? this.allProjects().filter(p => p.clientId === clientId) : [];
  });

  // State for Multi-Project Selection
  selectedProjectIds = signal<number[]>([]);

  // Date Range State
  invoiceStartDate = signal<string>('');
  invoiceEndDate = signal<string>('');

  selectedPaymentMethod = signal<'manual' | 'paypal' | 'stripe'>('manual');
  invoiceNumber = signal('');
  invoiceDate = signal('');
  dueDate = signal('');
  customItems = signal<InvoiceItem[]>([]);

  // --- Invoice History Signals ---
  historyFilterClientId = signal<number | null>(null);
  historyFilterProjectId = signal<number | null>(null);
  historyFilterStartDate = signal('');
  historyFilterEndDate = signal('');
  historyFilterStatus = signal<'All' | 'Paid' | 'Pending' | 'Overdue' | 'Generated'>('All');
  historyCurrentPage = signal(1);
  historyItemsPerPage = signal(10);

  constructor() {
    // Set default dates (First and Last day of current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.invoiceStartDate.set(firstDay.toISOString().split('T')[0]);
    this.invoiceEndDate.set(lastDay.toISOString().split('T')[0]);

    effect(() => {
        // Auto-generate Invoice Number and Default Due Date based on End Date
        const endDateStr = this.invoiceEndDate();
        if (!endDateStr) return;

        const endDate = new Date(endDateStr);
        const year = endDate.getFullYear();
        const month = endDate.getMonth() + 1;

        // Simple random component to simulate unique ID generation
        const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        if (!this.invoiceNumber() || this.invoiceNumber().startsWith('INV')) {
             this.invoiceNumber.set(`INV-${year}${String(month).padStart(2, '0')}-${randomPart}`);
        }
        if (!this.invoiceDate()) {
            this.invoiceDate.set(endDateStr);
        }
        
        // Only set default due date if not already set by user interaction
        if (!this.dueDate()) {
            const newDueDate = new Date(endDate);
            newDueDate.setDate(newDueDate.getDate() + 30);
            this.dueDate.set(newDueDate.toISOString().split('T')[0]);
        }
    }, { allowSignalWrites: true });

    effect(() => {
      // Reset or Initialize Project Selection when Context Changes
      const projects = this.relevantProjects();
      // Default to selecting all active projects for convenience
      const activeIds = projects.filter(p => p.status === 'Active').map(p => p.id);
      this.selectedProjectIds.set(activeIds);
      this.customItems.set([]);
    }, { allowSignalWrites: true });

    effect(() => {
      this.historyFilterClientId();
      this.historyFilterProjectId.set(null);
    }, { allowSignalWrites: true });
  }
  
  // --- Create Invoice Computations ---
  selectedClient = computed(() => {
    const id = this.selectedClientId();
    if (!id) return null;
    return this.clients().find(c => c.id === id);
  });
  
  private getRevenueRate(project: Project, memberId: number): number {
    const member = this.members().find(m => m.id === memberId);
    if (!member) return 0;
    return project.memberRates[memberId] ?? member.defaultHourlyRate;
  }

  // Logic to toggle project selection
  toggleProjectSelection(projectId: number, isChecked: boolean) {
      this.selectedProjectIds.update(ids => {
          if (isChecked) return [...ids, projectId];
          return ids.filter(id => id !== projectId);
      });
  }

  // Automatically populate items based on Time Range + Selected Projects
  loggedHoursItems = computed<InvoiceItem[]>(() => {
    const projects = this.relevantProjects();
    const selectedIds = this.selectedProjectIds();
    const startDateStr = this.invoiceStartDate();
    const endDateStr = this.invoiceEndDate();

    if (!projects.length || !selectedIds.length || !startDateStr || !endDateStr) return [];

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    const relevantItems: InvoiceItem[] = [];

    projects.forEach(project => {
        // Skip if project not selected
        if (!selectedIds.includes(project.id)) return;

        Object.entries(project.hours).forEach(([weekId, weeklyHours]) => {
          Object.entries(weeklyHours).forEach(([day, entry]) => {
            const entryDate = this.getDateFromWeekIdAndDay(weekId, day);
            
            // Check if date falls within selected range
            if(entryDate >= startDate && entryDate <= endDate) {
              
              let rate = this.getRevenueRate(project, entry.memberId);
              
              // Find member name for description
              const m = this.members().find(x => x.id === entry.memberId);
              const descPrefix = `[${project.name}] ${m?.name || 'Unknown'}:`;

              relevantItems.push({
                description: `${descPrefix} ${entryDate.toLocaleDateString()} - ${entry.description}`,
                quantity: entry.hours,
                rate: rate,
                type: 'hourly'
              });
            }
          });
        });
    });
    return relevantItems;
  });

  addCustomItem(type: 'hourly' | 'fixed'): void {
    this.customItems.update(items => [...items, { 
        description: '', 
        quantity: 1, 
        rate: 0,
        type: type
    }]);
  }

  updateCustomItem(index: number, field: keyof InvoiceItem, value: string | number): void {
    this.customItems.update(items => {
      const newItems = [...items];
      const updatedItem = { ...newItems[index] };
      if (field === 'description') updatedItem.description = String(value);
      else if (field === 'quantity') updatedItem.quantity = Number(value) || 0;
      else if (field === 'rate') updatedItem.rate = Number(value) || 0;
      newItems[index] = updatedItem;
      return newItems;
    });
  }

  removeCustomItem(index: number): void {
    this.customItems.update(items => items.filter((_, i) => i !== index));
  }

  subtotal = computed(() => {
    const hoursSubtotal = this.loggedHoursItems().reduce((acc, item) => acc + item.quantity * item.rate, 0);
    const customSubtotal = this.customItems().reduce((acc, item) => acc + (item.quantity || 0) * (item.rate || 0), 0);
    return hoursSubtotal + customSubtotal;
  });

  tax = computed(() => {
      const rate = this.selectedClient()?.defaultTaxRate ?? 0;
      return this.subtotal() * (rate / 100);
  }); 
  
  total = computed(() => this.subtotal() + this.tax());

  canGenerateInvoice = computed(() => {
    let hasRecipient = this.selectedClientId() !== null || (!!this.manualClientName() && !!this.manualClientEmail());
    const hasItems = this.loggedHoursItems().length > 0 || this.customItems().length > 0;
    
    if (!hasRecipient || !hasItems) return false;

    const method = this.selectedPaymentMethod();
    const u = this.user();
    
    if (method === 'paypal' && !u?.paypalConnected) return false;
    if (method === 'stripe' && !u?.stripeConnected) return false;
    
    return true;
  });

  paymentInstructions = computed(() => {
    const clientName = this.selectedClient()?.contact || this.manualClientEmail() || 'the client';
    const userName = this.user()?.name.replace(/\s+/g, '').toLowerCase() || 'company';
    switch (this.selectedPaymentMethod()) {
      case 'paypal': return `Please send the total amount to our PayPal account: payment@${userName}.com. Thank you!`;
      case 'stripe': return `A payment link will be sent to ${clientName} shortly. Payments are processed securely by Stripe.`;
      case 'manual':
      default: return 'Payment is due within 30 days. Please make payment via bank transfer to the account details provided separately. Thank you for your business.';
    }
  });
  
  generateInvoice(sendImmediately: boolean = false) {
    if (!this.canGenerateInvoice()) {
      alert("Please select a recipient and ensure there are items.");
      return;
    }
    const method = this.selectedPaymentMethod();
    const status = sendImmediately ? 'Pending' : 'Generated'; 
    
    const newInvoice: Omit<Invoice, 'id'> = {
      type: 'Revenue',
      clientId: this.selectedClientId(),
      teamMemberId: null,
      manualClientDetails: (!this.selectedClientId()) ? {
          name: this.manualClientName(),
          email: this.manualClientEmail(),
          address: this.manualClientAddress(),
          taxNumber: this.manualClientTaxNumber(),
      } : undefined,
      projectIds: this.selectedProjectIds(),
      invoiceNumber: this.invoiceNumber(),
      invoiceDate: this.invoiceDate(),
      dueDate: this.dueDate(),
      total: this.total(),
      status: status,
      paymentMethod: method,
    };
    this.dataService.addInvoice(newInvoice);

    const recipient = this.selectedClient()?.contact || this.manualClientEmail();

    if (sendImmediately) {
       alert(`Invoice ${this.invoiceNumber()} generated and sent to ${recipient}!`);
    } else {
       alert(`Invoice ${this.invoiceNumber()} generated successfully.`);
    }
    
    this.activeTab.set('history');
  }

  generateAndSend() {
      this.generateInvoice(true);
  }

  printInvoice() { window.print(); }

  // --- Invoice History Computations ---
  projectsForClientFilter = computed(() => {
    const clientId = this.historyFilterClientId();
    if (clientId === null) return [];
    return this.allProjects().filter(p => p.clientId === clientId);
  });

  filteredHistoryInvoices = computed(() => {
    // Force filtering to only Revenue type invoices
    let invoices = this.allInvoices().filter(inv => inv.type === 'Revenue');
    
    const clientId = this.historyFilterClientId();
    const projectId = this.historyFilterProjectId();
    const startDate = this.historyFilterStartDate();
    const endDate = this.historyFilterEndDate();
    const status = this.historyFilterStatus();
    
    if (clientId) invoices = invoices.filter(inv => inv.clientId === clientId);
    if (projectId) invoices = invoices.filter(inv => inv.projectIds.includes(projectId));
    if (startDate) invoices = invoices.filter(inv => new Date(inv.invoiceDate) >= new Date(startDate));
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        invoices = invoices.filter(inv => new Date(inv.invoiceDate) <= end);
    }
    if (status !== 'All') {
        invoices = invoices.filter(inv => inv.status === status);
    }
    return invoices;
  });

  paginatedHistoryInvoices = computed(() => {
    const invoices = this.filteredHistoryInvoices();
    const startIndex = (this.historyCurrentPage() - 1) * this.historyItemsPerPage();
    return invoices.slice(startIndex, startIndex + this.historyItemsPerPage());
  });

  onHistoryPageChange(page: number): void {
    this.historyCurrentPage.set(page);
  }

  resetFilters(): void {
    this.historyFilterClientId.set(null);
    this.historyFilterProjectId.set(null);
    this.historyFilterStartDate.set('');
    this.historyFilterEndDate.set('');
    this.historyFilterStatus.set('All');
  }
  
  updateInvoiceStatus(invoice: Invoice, newStatus: Invoice['status']) {
      this.dataService.updateInvoice({ ...invoice, status: newStatus });
  }

  sendInvoiceFromHistory(invoice: Invoice) {
      // Logic to send email
      alert(`Invoice ${invoice.invoiceNumber} sent!`);
      this.updateInvoiceStatus(invoice, 'Pending'); // Move to pending payment after sending
  }

  downloadInvoice(invoice: Invoice) {
      alert(`Downloading PDF for ${invoice.invoiceNumber}...`);
  }

  // --- Helpers ---
  getRecipientName(invoice: Invoice): string {
    if (invoice.clientId) {
        return this.clients().find(c => c.id === invoice.clientId)?.name ?? 'Unknown Client';
    }
    return invoice.manualClientDetails?.name ?? 'Manual Client';
  }

  getProjectNames(projectIds: number[]): string {
    if (!projectIds || projectIds.length === 0) return 'Manual/Misc';
    const names = projectIds
      .map(id => this.allProjects().find(p => p.id === id)?.name)
      .filter(Boolean);
    if (names.length === 0) return 'Manual/Misc';
    return names.join(', ');
  }

  private getDateFromWeekIdAndDay(weekId: string, dayName: string): Date {
      const [yearStr, weekStr] = weekId.split('-W');
      const year = parseInt(yearStr, 10);
      const week = parseInt(weekStr, 10);

      const jan4 = new Date(year, 0, 4);
      const dayOfWeekJan4 = jan4.getDay() || 7;
      const firstDayOfWeek1 = new Date(jan4);
      firstDayOfWeek1.setDate(jan4.getDate() - dayOfWeekJan4 + 1);
      
      const targetDate = new Date(firstDayOfWeek1);
      targetDate.setDate(firstDayOfWeek1.getDate() + (week - 1) * 7);

      const dayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dayName);
      if (dayIndex !== -1) {
        targetDate.setDate(targetDate.getDate() + dayIndex);
      }
      return targetDate;
  }
}
