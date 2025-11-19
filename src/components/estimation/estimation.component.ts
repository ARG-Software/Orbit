
import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { MockDataService, Client, Proposal } from '../../services/mock-data.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { PaginationComponent } from '../shared/pagination/pagination.component';

interface EstimateTask {
  id: string;
  name: string;
  description: string;
  hours: number;
  rate: number;
}

interface EstimateSection {
  id: string;
  name: string;
  tasks: EstimateTask[];
}

@Component({
  selector: 'app-estimation',
  templateUrl: './estimation.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe, PaginationComponent],
})
export class EstimationComponent {
  private authService = inject(AuthService);
  private dataService = inject(MockDataService);
  
  currentUser = this.authService.currentUser;
  availableClients = toSignal(this.dataService.getClients(), { initialValue: [] });
  allProposals = toSignal(this.dataService.getProposals(), { initialValue: [] });

  // --- Tabs & Stepper State ---
  activeTab = signal<'builder' | 'history'>('builder');
  currentStep = signal<1 | 2 | 3>(1);

  // --- Step 1: Client & Meta ---
  selectedClientId = signal<number | null>(null);
  clientName = signal(''); // Populated automatically if client selected, or manual
  projectName = signal('');
  
  // Renamed to avoid conflict with 'startDate' property of Proposal or Template Context
  projectStartDate = signal(new Date().toISOString().split('T')[0]);
  projectEndDate = signal(new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]);
  
  currency = signal('USD');
  taxRate = signal<number | null>(0);

  // --- Step 2: Builder Sections State ---
  sections = signal<EstimateSection[]>([
    {
      id: crypto.randomUUID(),
      name: 'Discovery & Design',
      tasks: [
        { id: crypto.randomUUID(), name: 'Requirements Gathering', description: 'Initial meetings and documentation', hours: 4, rate: 100 },
        { id: crypto.randomUUID(), name: 'UI/UX Design', description: 'Wireframes and high-fidelity mockups', hours: 12, rate: 100 },
      ]
    }
  ]);

  // --- History Tab State ---
  historyPage = signal(1);
  historyPerPage = signal(8);
  
  // --- Computations ---

  // Auto-populate client name when ID changes
  onClientSelect(clientId: number | null) {
      this.selectedClientId.set(clientId);
      if (clientId) {
          const client = this.availableClients().find(c => c.id === clientId);
          if (client) {
              this.clientName.set(client.name);
              this.taxRate.set(client.defaultTaxRate || 0);
          }
      } else {
          this.clientName.set('');
          this.taxRate.set(0);
      }
  }

  totals = computed(() => {
    let totalHours = 0;
    let subtotal = 0;

    const sectionTotals = this.sections().map(section => {
      const sHours = section.tasks.reduce((acc, t) => acc + (t.hours || 0), 0);
      const sCost = section.tasks.reduce((acc, t) => acc + ((t.hours || 0) * (t.rate || 0)), 0);
      
      totalHours += sHours;
      subtotal += sCost;

      return { id: section.id, hours: sHours, cost: sCost };
    });

    const taxPercent = this.taxRate() || 0;
    const taxAmount = subtotal * (taxPercent / 100);
    const grandTotal = subtotal + taxAmount;

    return {
      sectionTotals,
      totalHours,
      subtotal,
      taxAmount,
      grandTotal
    };
  });

  paginatedProposals = computed(() => {
      const props = this.allProposals();
      const startIndex = (this.historyPage() - 1) * this.historyPerPage();
      return props.slice(startIndex, startIndex + this.historyPerPage());
  });

  // --- Stepper Actions ---
  
  goToStep(step: 1 | 2 | 3) {
      if (step === 2) {
          if (!this.validateStep1()) return;
      }
      if (step === 3) {
          if (!this.validateStep1()) return;
          if (!this.validateStep2()) return;
      }
      this.currentStep.set(step);
  }

  private validateStep1(): boolean {
      if (!this.clientName()) {
          alert('Please enter a client name.');
          return false;
      }
      if (!this.projectName()) {
          alert('Please enter a project name.');
          return false;
      }
      if (!this.projectStartDate() || !this.projectEndDate()) {
          alert('Please set the start and end dates for the project schedule.');
          return false;
      }
      return true;
  }
  
  private validateStep2(): boolean {
      if (this.sections().length === 0) {
          alert('Please add at least one section to the estimate.');
          return false;
      }
      return true;
  }
  
  nextStep() {
      const curr = this.currentStep();
      if (curr < 3) {
        this.goToStep((curr + 1) as 1 | 2 | 3);
      }
  }
  
  prevStep() {
      const curr = this.currentStep();
      if (curr > 1) {
        this.goToStep((curr - 1) as 1 | 2 | 3);
      }
  }

  // --- Builder Actions ---

  addSection() {
    this.sections.update(sections => [
      ...sections,
      {
        id: crypto.randomUUID(),
        name: 'New Phase',
        tasks: [
          { id: crypto.randomUUID(), name: 'Initial Task', description: '', hours: 1, rate: 100 }
        ]
      }
    ]);
  }

  removeSection(sectionId: string) {
    this.sections.update(sections => sections.filter(s => s.id !== sectionId));
  }

  updateSectionName(sectionId: string, name: string) {
    this.sections.update(sections => 
      sections.map(s => s.id === sectionId ? { ...s, name } : s)
    );
  }

  addTask(sectionId: string) {
    this.sections.update(sections => 
      sections.map(s => {
        if (s.id === sectionId) {
          return {
            ...s,
            tasks: [...s.tasks, { id: crypto.randomUUID(), name: '', description: '', hours: 0, rate: 100 }]
          };
        }
        return s;
      })
    );
  }

  removeTask(sectionId: string, taskId: string) {
    this.sections.update(sections => 
      sections.map(s => {
        if (s.id === sectionId) {
          return {
            ...s,
            tasks: s.tasks.filter(t => t.id !== taskId)
          };
        }
        return s;
      })
    );
  }

  updateTask(sectionId: string, taskId: string, field: keyof EstimateTask, value: string | number) {
    this.sections.update(sections => 
      sections.map(s => {
        if (s.id === sectionId) {
          return {
            ...s,
            tasks: s.tasks.map(t => {
              if (t.id === taskId) {
                return { ...t, [field]: value };
              }
              return t;
            })
          };
        }
        return s;
      })
    );
  }

  // --- Finalization ---

  saveAndDownload() {
    // Save to History
    this.dataService.addProposal({
        clientId: this.selectedClientId(),
        clientName: this.clientName(),
        projectName: this.projectName(),
        totalAmount: this.totals().grandTotal,
        startDate: this.projectStartDate(),
        endDate: this.projectEndDate(),
        sections: this.sections()
    });

    // Print
    window.print();
  }
  
  deleteProposal(id: string) {
      if (confirm('Delete this proposal history?')) {
          this.dataService.deleteProposal(id);
      }
  }

  onHistoryPageChange(page: number) {
      this.historyPage.set(page);
  }
}
