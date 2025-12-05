
import { Component, ChangeDetectionStrategy, inject, computed, signal, Signal } from '@angular/core';
import { AsyncPipe, DecimalPipe, NgClass, DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService, Task, Project, Payment } from '../../services/mock-data.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TaskModalComponent } from '../modals/task-modal/task-modal.component';
import { ProjectModalComponent } from '../modals/project-modal/project-modal.component';
import * as d3 from 'd3';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DecimalPipe, FormsModule, NgClass, DatePipe, CurrencyPipe, RouterLink, TaskModalComponent, ProjectModalComponent],
})
export class DashboardComponent {
  private dataService = inject(MockDataService);
  private authService = inject(AuthService);

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

  // AI State
  aiSuggestion = signal<string | null>(null);
  isAiLoading = signal(false);

  // --- Modal States ---
  isTaskModalOpen = signal(false);
  isProjectModalOpen = signal(false);
  isExpenseModalOpen = signal(false);

  // --- Form States (Expense Only - Task/Project handled by shared modals) ---
  // Expense
  newExpenseAmount = signal<number | null>(null);
  newExpenseRecipient = signal('');
  newExpenseDescription = signal('');

  // 1. Time-based Greeting
  greeting = computed(() => {
    const hour = new Date().getHours();
    const name = this.user()?.name.split(' ')[0] || 'there';
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 18) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  });

  // 2. Financials (Current Month)
  currentMonthFinancials = computed(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Revenue: Paid Invoices in current month
    const revenue = this.allInvoices()
        .filter(inv => {
            const d = new Date(inv.invoiceDate);
            return inv.status === 'Paid' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, inv) => sum + inv.total, 0);

    // Expenses: All payments in current month (Paid or Pending)
    const expenses = this.allPayments()
        .filter(p => {
            const d = new Date(p.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, p) => sum + p.amount, 0);

    const maxVal = Math.max(revenue, expenses, 1); // Avoid div by zero
    
    return {
        revenue,
        expenses,
        profit: revenue - expenses,
        revenuePct: (revenue / maxVal) * 100,
        expensesPct: (expenses / maxVal) * 100
    };
  });

  // --- CHART LOGIC ---
  
  // Dimensions for SVG ViewBox
  chartWidth = 800;
  chartHeight = 250;
  chartPadding = { top: 20, right: 0, bottom: 30, left: 0 };

  // Helper to format chart data
  financialChartPaths = computed(() => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

      // Initialize daily buckets
      const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1,
          date: new Date(currentYear, currentMonth, i + 1),
          revenue: 0,
          expenses: 0,
          cumRevenue: 0,
          cumExpense: 0
      }));

      // Aggregate Revenue (Invoices)
      this.allInvoices().forEach(inv => {
          const d = new Date(inv.invoiceDate);
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear && inv.status === 'Paid') {
              const dayIndex = d.getDate() - 1;
              if (dailyData[dayIndex]) dailyData[dayIndex].revenue += inv.total;
          }
      });

      // Aggregate Expenses (Payments)
      this.allPayments().forEach(pay => {
          const d = new Date(pay.date);
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
              const dayIndex = d.getDate() - 1;
              if (dailyData[dayIndex]) dailyData[dayIndex].expenses += pay.amount;
          }
      });

      // Calculate Cumulative
      let rAcc = 0;
      let eAcc = 0;
      dailyData.forEach(d => {
          rAcc += d.revenue;
          eAcc += d.expenses;
          d.cumRevenue = rAcc;
          d.cumExpense = eAcc;
      });

      // Scales
      const xScale = d3.scaleLinear()
          .domain([1, daysInMonth])
          .range([0, this.chartWidth]);

      const maxVal = Math.max(
          d3.max(dailyData, d => d.cumRevenue) || 0,
          d3.max(dailyData, d => d.cumExpense) || 0,
          1000 // Minimum scale
      );

      const yScale = d3.scaleLinear()
          .domain([0, maxVal * 1.1]) // Add some headroom
          .range([this.chartHeight, 0]);

      // Generators
      const lineRev = d3.line<any>()
          .curve(d3.curveMonotoneX)
          .x(d => xScale(d.day))
          .y(d => yScale(d.cumRevenue));

      const areaRev = d3.area<any>()
          .curve(d3.curveMonotoneX)
          .x(d => xScale(d.day))
          .y0(this.chartHeight)
          .y1(d => yScale(d.cumRevenue));

      const lineExp = d3.line<any>()
          .curve(d3.curveMonotoneX)
          .x(d => xScale(d.day))
          .y(d => yScale(d.cumExpense));
      
      const areaExp = d3.area<any>()
          .curve(d3.curveMonotoneX)
          .x(d => xScale(d.day))
          .y0(this.chartHeight)
          .y1(d => yScale(d.cumExpense));

      return {
          revenueLine: lineRev(dailyData) || '',
          revenueArea: areaRev(dailyData) || '',
          expenseLine: lineExp(dailyData) || '',
          expenseArea: areaExp(dailyData) || '',
          data: dailyData,
          xScale,
          yScale
      };
  });

  // Hover Interaction State
  hoverDay = signal<number | null>(null);
  hoverData = computed(() => {
      const day = this.hoverDay();
      if (day === null) return null;
      const data = this.financialChartPaths().data[day - 1]; // 0-indexed array vs 1-indexed day
      if (!data) return null;
      
      const { xScale, yScale } = this.financialChartPaths();
      return {
          ...data,
          x: xScale(day),
          yRev: yScale(data.cumRevenue),
          yExp: yScale(data.cumExpense)
      };
  });

  onChartMouseMove(event: MouseEvent) {
      const svg = event.currentTarget as SVGSVGElement;
      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left;
      
      // Reverse scale to find day
      const { xScale } = this.financialChartPaths();
      const day = Math.round(xScale.invert(x * (this.chartWidth / rect.width))); // Adjust for viewbox scaling
      
      // Clamp
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      
      if (day >= 1 && day <= daysInMonth) {
          this.hoverDay.set(day);
      }
  }

  onChartMouseLeave() {
      this.hoverDay.set(null);
  }

  // 3. Priority Tasks (Not completed, High Priority)
  priorityTasks = computed(() => {
      let tasks = this.allTasks().filter(t => t.status !== 'Completed' && t.status !== 'Archived' && t.priority === 'High');
      
      // If member, filter to assigned only
      if (!this.isAdmin()) {
          const myId = this.user()?.teamMemberId;
          if (myId) {
              tasks = tasks.filter(t => t.assignedMemberId === myId);
          } else {
              tasks = [];
          }
      }
      
      return tasks.sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5);
  });

  getProjectName(projectId: number) {
      return this.allProjects().find(p => p.id === projectId)?.name || 'Unknown Project';
  }

  getClientName(clientId: number | null | undefined) {
      if(!clientId) return 'Unknown Client';
      return this.dataService.getClients()().find(c => c.id === clientId)?.name || 'Manual Client';
  }

  // 4. Logged Hours (Recent/Weekly estimate based on mock data structure)
  teamActivity = computed(() => {
      const members = this.allMembers();
      const projects = this.allProjects();
      
      return members.map(m => {
          let totalHours = 0;
          // Aggregate hours from all projects for this member (mock logic)
          projects.forEach(p => {
              Object.values(p.hours).forEach(week => {
                  Object.values(week).forEach(entry => {
                      if (entry.memberId === m.id) totalHours += entry.hours;
                  });
              });
          });
          
          return {
              member: m,
              hours: totalHours,
              status: m.status
          };
      }).sort((a,b) => b.hours - a.hours).slice(0, 6);
  });

  // 5. Upcoming Meetings
  upcomingMeetings = computed(() => {
      const now = new Date();
      return this.allMeetings()
        .filter(m => new Date(m.endTime) > now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .slice(0, 5);
  });

  // 6. Outstanding Invoices (Pending/Overdue)
  outstandingInvoices = computed(() => {
      return this.allInvoices()
        .filter(inv => inv.status === 'Pending' || inv.status === 'Overdue')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 5);
  });

  // 7. Recent Task Activity
  recentActivity = computed(() => {
      return this.allTasks()
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 5);
  });

  // --- Modal Logic ---

  // Expense Modal
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
          status: 'Pending',
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
      
      // Construct Context
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const taskCount = this.priorityTasks().length;
      const profit = this.currentMonthFinancials().profit;
      
      const prompt = `
        You are an executive productivity assistant for a freelancer/agency owner.
        Current Time: ${timeStr}.
        Context:
        - I have ${taskCount} high-priority tasks pending.
        - My current month's net profit is approx ${profit}.
        
        Give me a short, bulleted plan (max 3 points) on how I should focus my energy right now to be most effective. 
        Be encouraging but direct. Do not use markdown formatting like **bold**, just plain text.
      `;

      this.aiSuggestion.set(prompt);
    } catch (error) {
      console.error('AI Error', error);
      this.aiSuggestion.set("I couldn't connect to the satellite right now. Focus on your top priority task!");
    } finally {
      this.isAiLoading.set(false);
    }
  }
}
