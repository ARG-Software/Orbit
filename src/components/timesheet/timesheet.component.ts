
import { Component, ChangeDetectionStrategy, inject, signal, computed, effect, WritableSignal, Signal } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockDataService, Client, TimeEntry, TeamMember, Project } from '../../services/mock-data.service';
import { AuthService } from '../../services/auth.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { TranslationService } from '../../services/translation.service';
import { ActivatedRoute } from '@angular/router';

interface CalendarDay {
  date: Date;
  isCurrentMonth?: boolean;
  name?: string;
}

interface DailySummaryEntry {
  projectId: number;
  projectName: string;
  clientName?: string;
  memberId: number;
  memberName: string;
  memberAvatarUrl: string;
  hours: number;
  description: string;
  amount: number;
  rate: number; // Added
}

interface DailySummary {
  totalHours: number;
  entries: DailySummaryEntry[];
}

interface UserStat {
  memberId: number;
  name: string;
  role: string;
  avatarUrl: string;
  totalHours: number;
  totalEarnings: number;
}

interface HistoryEntry {
  id: string; 
  date: Date;
  weekId: string;
  dayName: string;
  projectId: number;
  projectName: string;
  clientId: number;
  clientName: string;
  memberId: number;
  memberName: string;
  memberAvatarUrl: string;
  hours: number;
  description: string;
  amount: number;
  rate: number; // Added
}

@Component({
  selector: 'app-timesheet',
  templateUrl: './timesheet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, FormsModule, DatePipe, DecimalPipe, CurrencyPipe, PaginationComponent],
})
export class TimesheetComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);
  public translationService = inject(TranslationService);
  private route = inject(ActivatedRoute);

  user = this.authService.currentUser;
  isAdmin = this.authService.isAdmin;

  clients = this.dataService.getClients();
  members = this.dataService.getTeamMembers();
  projects = this.dataService.getProjects();

  // Route View Mode
  viewMode = signal<'log' | 'history'>('log');

  // Calendar State
  currentDate = signal(new Date());
  calendarViewMode = signal<'week' | 'month'>('week'); // renamed to avoid conflict
  mosaicMemberFilter = signal<number | null>(null); 

  // History State
  historyClientId = signal<number | null>(null);
  historyProjectId = signal<number | null>(null);
  historyMemberId = signal<number | null>(null);
  historyStartDate = signal<string>('');
  historyEndDate = signal<string>('');
  historyPage = signal(1);
  historyPerPage = signal(10);

  // Modal State
  isEntryModalOpen = signal(false);
  entryModalDate: WritableSignal<Date | null> = signal(null);
  entryModalMode = signal<'list' | 'add' | 'edit'>('list');
  
  // Form Fields in Modal
  modalMemberId = signal<number | null>(null);
  modalClientId = signal<number | null>(null);
  modalProjectId = signal<number | null>(null);
  entryHours = signal(0);
  entryDescription = signal('');
  
  // Track original project during edit to handle project switching
  editingEntryOriginalProjectId = signal<number | null>(null);

  // Computed for Modal Dropdowns
  modalAvailableProjects = computed(() => {
    const cId = this.modalClientId();
    if (!cId) return [];
    
    // Filter projects based on client
    let available = this.projects().filter(p => p.clientId === cId);
    
    // EXCLUDE Paused projects and Fixed Rate projects
    available = available.filter(p => p.status !== 'Paused' && p.billingType !== 'fixed');

    // If Member, restrict projects to those allocated
    if (!this.isAdmin()) {
        const myId = this.user()?.teamMemberId;
        if (myId) {
             available = available.filter(p => p.allocatedTeamMemberIds.includes(myId));
        } else {
            return [];
        }
    }

    return available;
  });

  constructor() {
    // Subscribe to route data to switch modes
    this.route.data.subscribe(data => {
        this.viewMode.set(data['tab'] || 'log');
        if (this.viewMode() === 'history') {
            this.resetHistoryFilters(); // Ensure clean state
        }
    });

    // Set default history range (Last 90 Days to cover mock data)
    const today = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(today.getDate() - 90);
    
    this.historyStartDate.set(ninetyDaysAgo.toISOString().split('T')[0]);
    this.historyEndDate.set(today.toISOString().split('T')[0]);

    // Auto-select user logic
    effect(() => {
      if (this.isEntryModalOpen() && this.entryModalMode() === 'add') {
          if (!this.isAdmin()) {
             // Lock to current member
             const myId = this.user()?.teamMemberId;
             if(myId) this.modalMemberId.set(myId);
          } else if (!this.modalMemberId() && this.members().length > 0) {
            this.modalMemberId.set(this.members()[0].id);
          }
      }
    }, { allowSignalWrites: true });
  }

  // --- View and Date Computations ---

  currentWeekDays = computed<CalendarDay[]>(() => {
    const refDate = this.currentDate();
    const today = new Date(refDate);
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    return Array.from({length: 7}, (_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        return { name: date.toLocaleString('en-US', { weekday: 'short' }), date };
    });
  });

  currentMonthDays = computed<CalendarDay[]>(() => {
    const refDate = this.currentDate();
    const year = refDate.getFullYear();
    const month = refDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const days: CalendarDay[] = [];
    const startDayOfWeek = firstDayOfMonth.getDay() === 0 ? 7 : firstDayOfMonth.getDay();
    const endDayOfWeek = lastDayOfMonth.getDay() === 0 ? 7 : lastDayOfMonth.getDay();

    // Days from previous month
    for (let i = startDayOfWeek; i > 1; i--) {
      const date = new Date(firstDayOfMonth);
      date.setDate(date.getDate() - (i - 1));
      days.push({ date, isCurrentMonth: false });
    }

    // Days of current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Days from next month
    if (endDayOfWeek < 7) {
      for (let i = 1; i <= 7 - endDayOfWeek; i++) {
         const date = new Date(lastDayOfMonth);
         date.setDate(date.getDate() + i);
         days.push({ date, isCurrentMonth: false });
      }
    }

    return days;
  });

  daysInView = computed(() => {
      return this.calendarViewMode() === 'week' ? this.currentWeekDays() : this.currentMonthDays();
  });
  
  changePeriod(amount: number) {
    this.currentDate.update(d => {
      const newDate = new Date(d);
      if (this.calendarViewMode() === 'week') {
        newDate.setDate(d.getDate() + (7 * amount));
      } else {
        newDate.setMonth(d.getMonth() + amount);
      }
      return newDate;
    });
  }

  getWeekId(d: Date): string {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
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

  // Aggregate all entries from all projects for a specific date
  getDailySummary(date: Date): DailySummary {
    const weekId = this.getWeekId(date);
    const dayName = date.toLocaleString('en-US', { weekday: 'short' });
    
    let totalHours = 0;
    const entries: DailySummary['entries'] = [];

    // If member, filter only their entries (Global View filter handled in periodSummary)
    // But for the Modal, we want to show everyone unless it's a Member logged in.
    const currentMemberId = !this.isAdmin() ? this.user()?.teamMemberId : null;

    this.projects().forEach(p => {
      const entry = p.hours[weekId]?.[dayName];
      if (entry) {
        // Filter logic for logged in user permissions
        if (currentMemberId && entry.memberId !== currentMemberId) return;

        totalHours += entry.hours;
        const member = this.members().find(m => m.id === entry.memberId);
        const client = this.clients().find(c => c.id === p.clientId);
        
        const rate = p.memberRates[entry.memberId] ?? p.defaultRate ?? member?.defaultHourlyRate ?? 0;
        const amount = entry.hours * rate;

        entries.push({
          projectId: p.id,
          projectName: p.name,
          clientName: client?.name,
          memberId: entry.memberId,
          memberName: member?.name || 'Unknown',
          memberAvatarUrl: member?.avatarUrl || '',
          hours: entry.hours,
          description: entry.description,
          amount: amount,
          rate: rate
        });
      }
    });

    return { totalHours, entries };
  }

  // --- Modal Logic & Data ---
  
  // Fetch entries specifically for the modal view
  modalEntries = computed(() => {
      const date = this.entryModalDate();
      if (!date) return [];
      return this.getDailySummary(date).entries;
  });

  // --- Insights Logic ---

  // Aggregate summary for the entire view period
  periodSummary = computed(() => {
      const days = this.daysInView();
      const memberFilter = this.mosaicMemberFilter();
      
      let totalPeriodHours = 0;
      let totalPeriodEarnings = 0;
      const userStatsMap = new Map<number, UserStat>();
      const heatmapData: { date: Date; hours: number; intensity: number }[] = [];

      // 1. Calculate all summaries
      const dailyData = days.map(day => {
          const summary = this.getDailySummary(day.date);
          // Apply Mosaic Filter here if set
          if (memberFilter) {
              const filteredEntries = summary.entries.filter(e => e.memberId === memberFilter);
              const filteredTotal = filteredEntries.reduce((acc, e) => acc + e.hours, 0);
              return {
                  day,
                  summary: { totalHours: filteredTotal, entries: filteredEntries }
              };
          }
          return { day, summary };
      });

      const maxDailyHours = Math.max(...dailyData.map(d => d.summary.totalHours), 1);

      // 2. Process data
      dailyData.forEach(({ day, summary }) => {
          totalPeriodHours += summary.totalHours;
          
          heatmapData.push({ 
              date: day.date, 
              hours: summary.totalHours,
              intensity: summary.totalHours / maxDailyHours 
          });

          // Aggregate User Stats & Earnings
          summary.entries.forEach(entry => {
               // Find member info
               const member = this.members().find(m => m.id === entry.memberId); 
               if (member) {
                   const stats = userStatsMap.get(member.id) || {
                       memberId: member.id,
                       name: member.name,
                       role: member.role,
                       avatarUrl: member.avatarUrl,
                       totalHours: 0,
                       totalEarnings: 0
                   };
                   
                   stats.totalHours += entry.hours;
                   stats.totalEarnings += entry.amount; // Use pre-calc amount
                   totalPeriodEarnings += entry.amount;

                   userStatsMap.set(member.id, stats);
               }
          });
      });

      return {
          totalHours: totalPeriodHours,
          totalEarnings: totalPeriodEarnings,
          userStats: Array.from(userStatsMap.values()).sort((a,b) => b.totalHours - a.totalHours),
          heatmap: heatmapData
      };
  });

  // Insights Pagination
  insightsPage = signal(1);
  insightsPerPage = signal(5);
  
  paginatedUserStats = computed(() => {
      const stats = this.periodSummary().userStats;
      const start = (this.insightsPage() - 1) * this.insightsPerPage();
      return stats.slice(start, start + this.insightsPerPage());
  });

  onInsightsPageChange(page: number) {
      this.insightsPage.set(page);
  }

  getHeatmapColor(intensity: number): string {
      if (intensity === 0) return 'bg-base-200';
      if (intensity > 0.8) return 'bg-primary';
      if (intensity > 0.6) return 'bg-primary/80';
      if (intensity > 0.4) return 'bg-primary/60';
      if (intensity > 0.2) return 'bg-primary/40';
      return 'bg-primary/20';
  }
  
  // --- History Logic ---

  projectsForHistory = computed(() => {
      const cId = this.historyClientId();
      if (!cId) return this.projects();
      return this.projects().filter(p => p.clientId === cId);
  });

  allTimeEntries = computed<HistoryEntry[]>(() => {
      const entries: HistoryEntry[] = [];
      const projects = this.projects();
      const clients = this.clients();
      const members = this.members();

      projects.forEach(p => {
          const client = clients.find(c => c.id === p.clientId);
          
          Object.entries(p.hours).forEach(([weekId, days]) => {
              Object.entries(days).forEach(([dayName, entry]) => {
                  const member = members.find(m => m.id === entry.memberId);
                  const date = this.getDateFromWeekIdAndDay(weekId, dayName);
                  
                  const rate = p.memberRates[entry.memberId] ?? p.defaultRate ?? member?.defaultHourlyRate ?? 0;
                  const amount = entry.hours * rate;

                  entries.push({
                      id: `${p.id}-${weekId}-${dayName}-${entry.memberId}`,
                      date: date,
                      weekId,
                      dayName,
                      projectId: p.id,
                      projectName: p.name,
                      clientId: p.clientId,
                      clientName: client?.name || 'Unknown',
                      memberId: entry.memberId,
                      memberName: member?.name || 'Unknown',
                      memberAvatarUrl: member?.avatarUrl || '',
                      hours: entry.hours,
                      description: entry.description,
                      amount: amount,
                      rate: rate
                  });
              });
          });
      });
      
      return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  filteredHistory = computed(() => {
      let entries = this.allTimeEntries();
      const cId = this.historyClientId();
      const pId = this.historyProjectId();
      const mId = this.historyMemberId();
      const start = this.historyStartDate();
      const end = this.historyEndDate();

      if (cId) entries = entries.filter(e => e.clientId === cId);
      if (pId) entries = entries.filter(e => e.projectId === pId);
      if (mId) entries = entries.filter(e => e.memberId === mId);
      
      if (start) {
          const s = new Date(start);
          entries = entries.filter(e => e.date >= s);
      }
      if (end) {
          const endDateObj = new Date(end);
          endDateObj.setHours(23, 59, 59, 999);
          entries = entries.filter(entry => entry.date <= endDateObj);
      }

      return entries;
  });

  paginatedHistory = computed(() => {
      const entries = this.filteredHistory();
      const startIndex = (this.historyPage() - 1) * this.historyPerPage();
      return entries.slice(startIndex, startIndex + this.historyPerPage());
  });

  onHistoryPageChange(page: number) {
      this.historyPage.set(page);
  }

  resetHistoryFilters() {
      this.historyClientId.set(null);
      this.historyProjectId.set(null);
      this.historyMemberId.set(null);
      // Default to last 90 days
      const today = new Date();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(today.getDate() - 90);
      
      this.historyStartDate.set(ninetyDaysAgo.toISOString().split('T')[0]);
      this.historyEndDate.set(today.toISOString().split('T')[0]);
      this.historyPage.set(1);
  }

  // --- Modal Logic ---

  openEntryModal(date: Date, mode: 'list' | 'add' = 'list') {
    this.entryModalDate.set(date);
    this.entryModalMode.set(mode);
    this.resetForm();
    this.isEntryModalOpen.set(true);
  }

  resetForm() {
    this.modalClientId.set(null);
    this.modalProjectId.set(null);
    this.entryHours.set(0);
    this.entryDescription.set('');
    this.editingEntryOriginalProjectId.set(null);
  }

  switchToEntryForm() {
      this.entryModalMode.set('add');
      this.resetForm();
      // Member selection auto-logic handled by effect in constructor
  }

  editEntry(entry: DailySummaryEntry) {
      this.entryModalMode.set('edit');
      this.modalMemberId.set(entry.memberId);
      this.modalProjectId.set(entry.projectId);
      this.editingEntryOriginalProjectId.set(entry.projectId);
      
      // Look up Client ID from Project
      const project = this.projects().find(p => p.id === entry.projectId);
      if (project) {
          this.modalClientId.set(project.clientId);
      }
      
      this.entryHours.set(entry.hours);
      this.entryDescription.set(entry.description);
  }

  closeEntryModal() {
    this.isEntryModalOpen.set(false);
    this.entryModalDate.set(null);
  }

  saveTimeEntry() {
    const date = this.entryModalDate();
    const memberId = this.modalMemberId();
    const projectId = this.modalProjectId();
    
    if (!date || memberId === null || projectId === null) return;

    const newEntry: TimeEntry = {
      hours: this.entryHours(),
      description: this.entryDescription(),
      memberId: memberId,
    };

    const weekId = this.getWeekId(date);
    const dayName = date.toLocaleString('en-US', { weekday: 'short' });

    // If Editing and Project Changed, we must delete the old one first
    if (this.entryModalMode() === 'edit' && this.editingEntryOriginalProjectId()) {
        const oldPid = this.editingEntryOriginalProjectId()!;
        if (oldPid !== projectId) {
            this.dataService.deleteTimeEntry(oldPid, weekId, dayName);
        }
    }

    this.dataService.submitHours(projectId, weekId, { [dayName]: newEntry });
    
    // Return to list view
    this.entryModalMode.set('list');
  }

  deleteEntry(projectId: number, weekId?: string, dayName?: string) {
    let targetWeekId = weekId;
    let targetDayName = dayName;

    // If called from Modal, we rely on modal state
    if (!targetWeekId || !targetDayName) {
        const date = this.entryModalDate();
        if (!date) return;
        targetWeekId = this.getWeekId(date);
        targetDayName = date.toLocaleString('en-US', { weekday: 'short' });
    }
    
    if(confirm('Are you sure you want to delete this entry?')) {
        this.dataService.deleteTimeEntry(projectId, targetWeekId!, targetDayName!);
    }
  }
}
