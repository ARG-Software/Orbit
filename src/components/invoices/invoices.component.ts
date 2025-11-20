import { Component, ChangeDetectionStrategy, computed, inject, signal, effect, Signal } from '@angular/core';
import { DecimalPipe, DatePipe, KeyValuePipe, TitleCasePipe } from '@angular/common';
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
}

interface TaskForBilling {
  task: Task;
  hours: number;
  selected: boolean;
}

@Component({
  selector: 'app-invoices',
  templateUrl: './invoices.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, DatePipe, RouterLink, PaginationComponent, KeyValuePipe, TitleCasePipe],
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

  // --- Create Invoice Signals ---
  selectedClientId = signal<number | null>(null);
  
  // Available projects for the selected client
  clientProjects: Signal<Project[]> = toSignal(
    toObservable(this.selectedClientId).pipe(
      switchMap((id: number | null) => id !== null ? this.dataService.getProjectsByClientId(id) : of([]))
    ),
    { initialValue: [] }
  );

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

  // --- Bill Tasks Modal ---
  isBillTaskModalOpen = signal(false);
  tasksToBill = signal<Map<string, TaskForBilling>>(new Map());

  // --- Invoice History Signals ---
  historyFilterClientId = signal<number | null>(null);
  historyFilterProjectId = signal<number | null>(null);
  historyFilterStartDate = signal('');
  historyFilterEndDate = signal('');
  historyFilterStatus = signal<'All' | 'Paid' | 'Pending' | 'Overdue'>('All');
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
        // Auto-generate Invoice Number and Due Date based on End Date
        const endDateStr = this.invoiceEndDate();
        if (!endDateStr) return;

        const endDate = new Date(endDateStr);
        const year = endDate.getFullYear();
        const month = endDate.getMonth() + 1;

        // Simple random component to simulate unique ID generation
        const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        this.invoiceNumber.set(`INV-${year}${String(month).padStart(2, '0')}-${randomPart}`);
        this.invoiceDate.set(endDateStr);
        
        const newDueDate = new Date(endDate);
        newDueDate.setDate(newDueDate.getDate() + 30);
        this.dueDate.set(newDueDate.toISOString().split('T')[0]);
    }, { allowSignalWrites: true });

    effect(() => {
      // Reset or Initialize Project Selection when Client Changes
      const projects = this.clientProjects();
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
  
  private getRate(project: Project, memberId: number): number {
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
    const projects = this.clientProjects();
    const selectedIds = this.selectedProjectIds();
    const startDateStr = this.invoiceStartDate();
    const endDateStr = this.invoiceEndDate();

    if (!projects.length || !selectedIds.length || !startDateStr || !endDateStr) return [];

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    // Set end date to end of day
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
              relevantItems.push({
                description: `[${project.name}] ${entryDate.toLocaleDateString()}: ${entry.description}`,
                quantity: entry.hours,
                rate: this.getRate(project, entry.memberId),
              });
            }
          });
        });
    });
    return relevantItems;
  });

  addCustomItem(): void {
    this.customItems.update(items => [...items, { description: '', quantity: 1, rate: 0 }]);
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
    if (this.selectedClientId() === null || (this.loggedHoursItems().length === 0 && this.customItems().length === 0)) return false;
    const method = this.selectedPaymentMethod();
    const u = this.user();
    if (method === 'paypal' && !u?.paypalConnected) return false;
    if (method === 'stripe' && !u?.stripeConnected) return false;
    return true;
  });

  paymentInstructions = computed(() => {
    const clientName = this.selectedClient()?.contact ?? 'the client\'s email';
    const userName = this.user()?.name.replace(/\s+/g, '').toLowerCase() || 'company';
    switch (this.selectedPaymentMethod()) {
      case 'paypal': return `Please send the total amount to our PayPal account: payment@${userName}.com. Thank you!`;
      case 'stripe': return `A payment link will be sent to ${clientName} shortly. Payments are processed securely by Stripe.`;
      case 'manual':
      default: return 'Payment is due within 30 days. Please make payment via bank transfer to the account details provided separately. Thank you for your business.';
    }
  });
  
  generateInvoice() {
    if (!this.canGenerateInvoice()) {
      alert("Please select a client and ensure there are billable hours or items for the period.");
      return;
    }
    const method = this.selectedPaymentMethod();
    
    const newInvoice: Omit<Invoice, 'id'> = {
      clientId: this.selectedClientId()!,
      projectIds: this.selectedProjectIds(),
      invoiceNumber: this.invoiceNumber(),
      invoiceDate: this.invoiceDate(),
      dueDate: this.dueDate(),
      total: this.total(),
      status: 'Pending',
      paymentMethod: method,
    };
    this.dataService.addInvoice(newInvoice);

    if (method === 'manual') {
      alert(`Invoice ${this.invoiceNumber()} generated successfully!`);
    } else {
      alert(`Payment request for $${this.total().toFixed(2)} initiated via ${method === 'paypal' ? 'PayPal' : 'Stripe'}.`);
    }
    
    this.activeTab.set('history');
  }

  printInvoice() { window.print(); }

  // --- Bill Tasks Logic ---
  billableTasks: Signal<Task[]> = toSignal(
    toObservable(this.selectedClientId).pipe(
      switchMap((id: number | null) => {
        if (id === null) {
          return of([]);
        }
        return this.dataService.getProjectsByClientId(id).pipe(
          switchMap((projects: Project[]) => {
            if (!projects || projects.length === 0) {
              return of([]);
            }
            const tasksObservables = projects.map(p => this.dataService.getTasksByProjectId(p.id));
            if (tasksObservables.length === 0) {
              return of([]);
            }
            return forkJoin(tasksObservables).pipe(
              map((tasksArrays: Task[][]) => tasksArrays.flat())
            );
          })
        );
      }),
      map((tasks: Task[]) => tasks.filter(t => t.status === 'Completed' && !t.isBilled))
    ),
    { initialValue: [] }
  );

  openBillTaskModal() {
    const billingMap = new Map<string, TaskForBilling>();
    this.billableTasks().forEach(task => {
        billingMap.set(task.id, { task, hours: 0, selected: false });
    });
    this.tasksToBill.set(billingMap);
    this.isBillTaskModalOpen.set(true);
  }

  closeBillTaskModal() { this.isBillTaskModalOpen.set(false); }

  toggleTaskForBilling(taskId: string) {
    this.tasksToBill.update(currentMap => {
      const newMap = new Map<string, TaskForBilling>(currentMap);
      const item = newMap.get(taskId);
      if (item) {
        newMap.set(taskId, { ...item, selected: !item.selected });
      }
      return newMap;
    });
  }

  updateBillingHoursForTask(taskId: string, hours: number) {
    this.tasksToBill.update(currentMap => {
      const newMap = new Map<string, TaskForBilling>(currentMap);
      const item = newMap.get(taskId);
      if (item) {
        newMap.set(taskId, { ...item, hours });
      }
      return newMap;
    });
  }

  addSelectedTasksToInvoice() {
    const tasksToAdd: InvoiceItem[] = [];
    const tasksToUpdate: Task[] = [];
    
    this.tasksToBill().forEach(item => {
        if (item.selected && item.hours > 0) {
            const project = this.allProjects().find(p => p.id === item.task.projectId);
            if (project) {
                tasksToAdd.push({
                    description: `[${project.name}] Task: ${item.task.title}`,
                    quantity: item.hours,
                    rate: this.getRate(project, item.task.assignedMemberId)
                });
                tasksToUpdate.push({ ...item.task, isBilled: true });
            }
        }
    });

    if (tasksToAdd.length > 0) {
        this.customItems.update(items => [...items, ...tasksToAdd]);
        tasksToUpdate.forEach(task => this.dataService.updateTask(task));
    }
    
    this.closeBillTaskModal();
  }


  // --- Invoice History Computations ---
  projectsForClientFilter = computed(() => {
    const clientId = this.historyFilterClientId();
    if (clientId === null) return [];
    return this.allProjects().filter(p => p.clientId === clientId);
  });

  filteredHistoryInvoices = computed(() => {
    let invoices = this.allInvoices();
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

  // --- Helpers ---
  getClientName(clientId: number): string {
    return this.clients().find(c => c.id === clientId)?.name ?? 'N/A';
  }

  getProjectNames(projectIds: number[]): string {
    if (!projectIds || projectIds.length === 0) return 'Misc';
    const names = projectIds
      .map(id => this.allProjects().find(p => p.id === id)?.name)
      .filter(Boolean);
    if (names.length === 0) return 'Misc';
    return names.join(', ');
  }

  getStatusClass(status: 'Paid' | 'Pending' | 'Overdue'): string {
    switch (status) {
      case 'Paid': return 'badge-success';
      case 'Pending': return 'badge-warning';
      case 'Overdue': return 'badge-error';
      default: return 'badge-ghost';
    }
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