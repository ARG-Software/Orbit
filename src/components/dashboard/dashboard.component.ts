
import { Component, ChangeDetectionStrategy, inject, computed, signal, Signal } from '@angular/core';
import { AsyncPipe, DecimalPipe, NgClass, DatePipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { MockDataService, TeamMember, Task } from '../../services/mock-data.service';
import { switchMap, distinctUntilChanged, map } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';

interface RevenueSection {
  totalEarnings: number;
  earningsByClient: { name: string; value: number }[];
  mostValuableProjects: { name: string; clientName?: string; value: number }[];
  avgHourlyRate: number;
  totalHours: number;
}

interface ClientsSection {
  mostValuableClients: { name: string; value: number }[];
  activeClientsCount: number;
  clientsWithMostBilledTime: { name: string; hours: number }[];
  projectValuePerClient: { name: string; avgValue: number }[];
  invoiceStatusSummary: { paid: number; pending: number; overdue: number };
}

interface MembersSection {
  activeMembersCount: number;
  rankingByHours: { member: TeamMember; hours: number; earnings: number }[];
  mostProfitableMember?: { member: TeamMember; hours: number; earnings: number };
  mostHoursLogged?: { member: TeamMember; hours: number; earnings: number };
}

interface TasksSection {
  recentlyAddedTasks: Task[];
  recentlyChangedTasks: Task[];
  boardActivity: { name: string; projectId: number; count: number }[];
}

interface DashboardData {
  revenue: RevenueSection;
  clients: ClientsSection;
  members: MembersSection;
  tasks: TasksSection;
}

const initialDashboardData: DashboardData = {
    revenue: { totalEarnings: 0, earningsByClient: [], mostValuableProjects: [], avgHourlyRate: 0, totalHours: 0 },
    clients: { mostValuableClients: [], activeClientsCount: 0, clientsWithMostBilledTime: [], projectValuePerClient: [], invoiceStatusSummary: { paid: 0, pending: 0, overdue: 0 } },
    members: { activeMembersCount: 0, rankingByHours: [], mostProfitableMember: undefined, mostHoursLogged: undefined },
    tasks: { recentlyAddedTasks: [], recentlyChangedTasks: [], boardActivity: [] }
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DecimalPipe, FormsModule, NgClass, DatePipe],
})
export class DashboardComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);

  user = this.authService.currentUser;
  isAdmin = this.authService.isAdmin;
  
  // Section Collapse State
  sections = signal({
      revenue: true,
      clients: false,
      members: false,
      tasks: true // Members see tasks by default
  });

  toggleSection(section: 'revenue' | 'clients' | 'members' | 'tasks') {
      this.sections.update(s => ({ ...s, [section]: !s[section] }));
  }

  // Date Filtering
  startDate = signal<string>('');
  endDate = signal<string>('');
  activeFilter = signal<'30d' | 'quarter' | 'year' | 'custom'>('30d');
  
  constructor() {
    this.setDateFilter('30d');
  }

  setDateFilter(filter: '30d' | 'quarter' | 'year') {
    this.activeFilter.set(filter);
    const endDate = new Date();
    let startDate = new Date();
    
    if (filter === '30d') {
        startDate.setDate(endDate.getDate() - 30);
    } else if (filter === 'quarter') {
        const currentQ = Math.floor(endDate.getMonth() / 3);
        startDate = new Date(endDate.getFullYear(), currentQ * 3, 1);
    } else if (filter === 'year') {
        startDate = new Date(endDate.getFullYear(), 0, 1);
    }

    this.startDate.set(this.formatDateForInput(startDate));
    this.endDate.set(this.formatDateForInput(endDate));
  }

  onDateChange(): void {
    this.activeFilter.set('custom');
  }
  
  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private dateRange = computed(() => {
    const start = this.startDate();
    const end = this.endDate();
    
    if (!start || !end) return null;

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  });

  private dashboardData$: Signal<DashboardData> = toSignal(
    toObservable(this.dateRange).pipe(
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      switchMap(range => {
        if (!range) return of(initialDashboardData);
        return this.dataService.getDashboardData(range).pipe(
            map((data: any) => {
                const dashboardData = data as DashboardData;
                // For Members, filter Tasks to show only assigned ones
                if (!this.isAdmin()) {
                   const myId = this.user()?.teamMemberId;
                   if(myId && dashboardData.tasks) {
                       dashboardData.tasks.recentlyAddedTasks = dashboardData.tasks.recentlyAddedTasks.filter((t: Task) => t.assignedMemberId === myId);
                       dashboardData.tasks.recentlyChangedTasks = dashboardData.tasks.recentlyChangedTasks.filter((t: Task) => t.assignedMemberId === myId);
                   }
                }
                return dashboardData;
            })
        );
      })
    ), { initialValue: initialDashboardData }
  );

  // Computeds for template usage
  revenue = computed(() => this.dashboardData$().revenue);
  clients = computed(() => this.dashboardData$().clients);
  members = computed(() => this.dashboardData$().members);
  tasks = computed(() => this.dashboardData$().tasks);

  // Helpers
  getInvoiceTotal() {
      const s = this.clients().invoiceStatusSummary;
      return s.paid + s.pending + s.overdue;
  }
  
  getMaxRevenueValue() {
      const data = this.revenue().earningsByClient;
      return data.length > 0 ? Math.max(...data.map(d => d.value)) : 0;
  }

  getMaxClientHours() {
      const data = this.clients().clientsWithMostBilledTime;
      return data.length > 0 ? Math.max(...data.map(d => d.hours)) : 0;
  }
}
