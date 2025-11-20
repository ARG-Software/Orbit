
import { Component, ChangeDetectionStrategy, inject, signal, computed, effect, WritableSignal, Signal } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockDataService, Client, TimeEntry, TeamMember, Project } from '../../services/mock-data.service';
import { AuthService } from '../../services/auth.service';

interface CalendarDay {
  date: Date;
  isCurrentMonth?: boolean;
  name?: string;
}

interface DailySummary {
  totalHours: number;
  entries: Array<{
    projectId: number;
    projectName: string;
    clientName?: string;
    memberName: string;
    hours: number;
    description: string;
  }>;
}

@Component({
  selector: 'app-timesheet',
  templateUrl: './timesheet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, FormsModule, DatePipe, DecimalPipe],
})
export class TimesheetComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);

  user = this.authService.currentUser;
  isAdmin = this.authService.isAdmin;

  clients = this.dataService.getClients();
  members = this.dataService.getTeamMembers();
  projects = this.dataService.getProjects();

  currentDate = signal(new Date());
  viewMode = signal<'week' | 'month'>('week');

  // Modal State
  isEntryModalOpen = signal(false);
  entryModalDate: WritableSignal<Date | null> = signal(null);
  
  // Form Fields in Modal
  modalMemberId = signal<number | null>(null);
  modalClientId = signal<number | null>(null);
  modalProjectId = signal<number | null>(null);
  entryHours = signal(0);
  entryDescription = signal('');

  // Computed for Modal Dropdowns
  modalAvailableProjects = computed(() => {
    const cId = this.modalClientId();
    if (!cId) return [];
    
    let available = this.projects().filter(p => p.clientId === cId);

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
    // Auto-select user logic
    effect(() => {
      if (this.isEntryModalOpen()) {
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
  
  changePeriod(amount: number) {
    this.currentDate.update(d => {
      const newDate = new Date(d);
      if (this.viewMode() === 'week') {
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

  // Aggregate all entries from all projects for a specific date
  getDailySummary(date: Date): DailySummary {
    const weekId = this.getWeekId(date);
    const dayName = date.toLocaleString('en-US', { weekday: 'short' });
    
    let totalHours = 0;
    const entries: DailySummary['entries'] = [];

    // If member, filter only their entries
    const currentMemberId = !this.isAdmin() ? this.user()?.teamMemberId : null;

    this.projects().forEach(p => {
      const entry = p.hours[weekId]?.[dayName];
      if (entry) {
        // Filter logic
        if (currentMemberId && entry.memberId !== currentMemberId) return;

        totalHours += entry.hours;
        const member = this.members().find(m => m.id === entry.memberId);
        const client = this.clients().find(c => c.id === p.clientId);
        entries.push({
          projectId: p.id,
          projectName: p.name,
          clientName: client?.name,
          memberName: member?.name || 'Unknown',
          hours: entry.hours,
          description: entry.description
        });
      }
    });

    return { totalHours, entries };
  }
  
  // --- Modal Logic ---

  openEntryModal(date: Date) {
    this.entryModalDate.set(date);
    
    // Reset form
    this.modalClientId.set(null);
    this.modalProjectId.set(null);
    this.entryHours.set(0);
    this.entryDescription.set('');
    
    this.isEntryModalOpen.set(true);
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

    this.dataService.submitHours(projectId, weekId, { [dayName]: newEntry });
    this.closeEntryModal();
  }

  deleteEntry(projectId: number) {
    const date = this.entryModalDate();
    if (!date) return;
    
    if(confirm('Are you sure you want to delete this entry?')) {
        const weekId = this.getWeekId(date);
        const dayName = date.toLocaleString('en-US', { weekday: 'short' });
        this.dataService.deleteTimeEntry(projectId, weekId, dayName);
    }
  }
}
