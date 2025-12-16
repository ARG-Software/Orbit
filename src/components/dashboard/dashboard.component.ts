
import { Component, ChangeDetectionStrategy, inject, computed, signal, effect, OnDestroy } from '@angular/core';
import { AsyncPipe, DecimalPipe, NgClass, DatePipe, CurrencyPipe, NgStyle } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService, Task, Project, Payment } from '../../services/mock-data.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { GoogleGenAI } from "@google/genai";
import { TaskModalComponent } from '../modals/task-modal/task-modal.component';
import { ProjectModalComponent } from '../modals/project-modal/project-modal.component';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import * as d3 from 'd3';

type WidgetType = 'welcome' | 'activity' | 'revenue' | 'status' | 'activeProjects' | 'nextMeeting' | 'ai';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DecimalPipe, FormsModule, NgClass, DatePipe, CurrencyPipe, RouterLink, TaskModalComponent, ProjectModalComponent, NgStyle, PaginationComponent],
})
export class DashboardComponent implements OnDestroy {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);
  public translationService = inject(TranslationService);

  user = this.authService.currentUser;
  isAdmin = this.authService.isAdmin;

  // Data Sources
  allTasks = this.dataService.getAllTasks();
  allInvoices = this.dataService.getInvoices();
  allPayments = this.dataService.getPayments();
  allMembers = this.dataService.getTeamMembers();
  allProjects = this.dataService.getProjects();
  allMeetings = this.dataService.getMeetings();
  allClients = this.dataService.getClients();

  // Dashboard Configuration
  widgets = signal<WidgetType[]>([
    'welcome', 
    'activity', 
    'revenue', 
    'status', 
    'activeProjects', 
    'nextMeeting', 
    'ai'
  ]);
  
  draggedWidgetIndex = signal<number | null>(null);

  // Time & Greeting State
  currentTime = signal(new Date());
  private timer: any;

  // AI State
  aiSuggestion = signal<string | null>(null);
  isAiLoading = signal(false);

  // --- Modal States ---
  isTaskModalOpen = signal(false);
  isProjectModalOpen = signal(false);
  isExpenseModalOpen = signal(false);

  // --- Form States ---
  newExpenseAmount = signal<number | null>(null);
  newExpenseRecipient = signal('');
  newExpenseDescription = signal('');

  constructor() {
    this.timer = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // --- Widget Logic ---
  getWidgetClass(type: WidgetType): string {
    switch (type) {
      case 'welcome': return 'col-span-1 md:col-span-2 xl:col-span-2';
      case 'status': return 'col-span-1 md:col-span-2 xl:col-span-1 row-span-2';
      case 'nextMeeting': return 'col-span-1 md:col-span-2';
      default: return 'col-span-1';
    }
  }

  onDragStart(event: DragEvent, index: number) {
    this.draggedWidgetIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  onDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    const dragIndex = this.draggedWidgetIndex();
    
    if (dragIndex !== null && dragIndex !== dropIndex) {
      const currentWidgets = [...this.widgets()];
      const item = currentWidgets[dragIndex];
      
      // Remove from old position
      currentWidgets.splice(dragIndex, 1);
      // Insert at new position
      currentWidgets.splice(dropIndex, 0, item);
      
      this.widgets.set(currentWidgets);
    }
    this.draggedWidgetIndex.set(null);
  }

  // --- Time Logic ---
  greeting = computed(() => {
    // Trigger dependency for reactivity
    this.translationService.currentLang();
    
    const hour = this.currentTime().getHours();
    let key = 'Good evening';
    if (hour < 12) key = 'Good morning';
    else if (hour < 18) key = 'Good afternoon';
    
    return this.translationService.translate(key);
  });

  currentWeekRange = computed(() => {
    const now = this.currentTime();
    const day = now.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    
    const monday = new Date(now.setDate(diff));
    monday.setHours(0,0,0,0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);

    return { start: monday, end: sunday };
  });

  // --- WEEKLY METRICS ---

  // 1. Projects Worked On This Week
  weeklyProjectsCount = computed(() => {
    // For robust mock display, we'll filter Active projects
    return this.allProjects().filter(p => p.status === 'Active').length; 
  });

  // 2. Weekly Earnings
  weeklyFinancials = computed(() => {
    const { start, end } = this.currentWeekRange();
    
    // Filter invoices paid this week
    const revenue = this.allInvoices()
        .filter(inv => {
            const d = new Date(inv.invoiceDate); // Using invoice date as proxy for payment date in mock
            return inv.status === 'Paid' && d >= start && d <= end;
        })
        .reduce((sum, inv) => sum + inv.total, 0);

    return { revenue };
  });

  // 3. Weekly Hours
  weeklyHoursLogged = computed(() => {
      const now = new Date();
      // Calculate Week ID for mock service (e.g., "2024-W25")
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const year = d.getUTCFullYear();
      const weekNo = Math.ceil(( ( (d.getTime() - new Date(Date.UTC(year,0,1)).getTime()) / 86400000) + 1)/7);
      const currentWeekId = `${year}-W${String(weekNo).padStart(2, '0')}`;

      let total = 0;
      this.allProjects().forEach(p => {
          const weekData = p.hours[currentWeekId];
          if (weekData) {
              Object.values(weekData).forEach((entry: any) => total += entry.hours);
          }
      });
      
      // Fallback for demo if 0
      if (total === 0) return 24.5; 
      return total;
  });

  // 3. Priority Tasks
  priorityTasks = computed(() => {
      let tasks = this.allTasks().filter(t => t.status !== 'Completed' && t.status !== 'Archived' && t.priority === 'High');
      if (!this.isAdmin()) {
          const myId = this.user()?.teamMemberId;
          if (myId) tasks = tasks.filter(t => t.assignedMemberId === myId);
          else tasks = [];
      }
      return tasks.sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  });

  getProjectName(projectId: number) {
      return this.allProjects().find(p => p.id === projectId)?.name || 'Unknown Project';
  }

  // 5. Upcoming Meetings
  upcomingMeetings = computed(() => {
      const now = new Date();
      return this.allMeetings()
        .filter(m => new Date(m.endTime) > now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .slice(0, 5); // Just top 5
  });

  // --- Modal Logic ---
  openExpenseModal() {
      this.newExpenseAmount.set(null);
      this.newExpenseRecipient.set('');
      this.newExpenseDescription.set('');
      this.isExpenseModalOpen.set(true);
  }

  saveExpense() {
      if(!this.newExpenseAmount() || !this.newExpenseRecipient()) return;
      this.dataService.addPayment({
          recipientName: this.newExpenseRecipient(),
          amount: this.newExpenseAmount()!,
          description: this.newExpenseDescription(),
          currency: 'USD',
          recipientRole: 'Vendor',
          method: 'Manual'
      });
      this.isExpenseModalOpen.set(false);
  }

  // AI Logic
  async planMyDay() {
    if (this.isAiLoading()) return;
    this.isAiLoading.set(true);
    this.aiSuggestion.set(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const taskCount = this.priorityTasks().length;
      
      const prompt = `You are an executive productivity assistant. Current Time: ${timeStr}. Context: ${taskCount} high-priority tasks pending. Give me a short, bulleted plan (max 3 points) for this week. Be encouraging. Plain text only.`;

      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      this.aiSuggestion.set(response.text.trim());
    } catch (error) {
      console.error('AI Error', error);
      this.aiSuggestion.set("I couldn't connect to the satellite right now. Focus on your top priority task!");
    } finally {
      this.isAiLoading.set(false);
    }
  }
}
