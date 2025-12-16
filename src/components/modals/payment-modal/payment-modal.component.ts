
import { Component, ChangeDetectionStrategy, inject, signal, computed, input, output, effect } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockDataService, TeamMember, Project } from '../../../services/mock-data.service';

@Component({
  selector: 'app-payment-modal',
  templateUrl: './payment-modal.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CurrencyPipe, DecimalPipe]
})
export class PaymentModalComponent {
  private dataService = inject(MockDataService);

  // Inputs
  prefilledMemberId = input<number | null>(null);
  prefilledProjectId = input<number | null>(null);
  prefilledAmount = input<number | null>(null);
  prefilledRef = input<string>('');

  // Outputs
  close = output<void>();
  saved = output<void>();

  // Data
  members = this.dataService.getTeamMembers();
  projects = this.dataService.getProjects();

  // Wizard State
  currentStep = signal<1 | 2 | 3>(1);
  
  // Form Data
  paymentType = signal<'flat' | 'hours'>('flat');
  selectedMemberId = signal<number | null>(null);
  selectedProjectId = signal<number | null>(null);
  
  // Fields
  recipientName = signal('');
  recipientRole = signal('');
  recipientEmail = signal('');
  recipientIban = signal('');
  
  payAmount = signal<number | null>(null);
  payCurrency = signal('USD');
  payDescription = signal('');
  payMethod = signal<'Revolut' | 'Wise' | 'PayPal' | 'Viva' | 'Manual' | null>(null);

  // Hours Selection Logic
  availableTimeEntries = computed(() => {
      const mId = this.selectedMemberId();
      const pId = this.selectedProjectId();
      if (!mId || !pId || this.paymentType() !== 'hours') return [];

      const project = this.projects().find(p => p.id === pId);
      if (!project) return [];

      const member = this.members().find(m => m.id === mId);
      const rate = project.memberRates[mId] ?? member?.defaultHourlyRate ?? 0;

      const entries: { date: Date, hours: number, desc: string, cost: number, id: string }[] = [];
      
      Object.entries(project.hours).forEach(([weekId, days]) => {
          Object.entries(days).forEach(([day, entry]) => {
              if (entry.memberId === mId) {
                  // Simplified ID for selection
                  const id = `${weekId}-${day}`;
                  entries.push({
                      id,
                      date: entry.date || new Date(),
                      hours: entry.hours,
                      desc: entry.description,
                      cost: entry.hours * rate
                  });
              }
          });
      });
      return entries;
  });

  selectedEntryIds = signal<Set<string>>(new Set());

  totalSelectedCost = computed(() => {
      const selected = this.selectedEntryIds();
      return this.availableTimeEntries()
          .filter(e => selected.has(e.id))
          .reduce((sum, e) => sum + e.cost, 0);
  });

  // Calculate Debt
  currentDebt = computed(() => {
      const mId = this.selectedMemberId();
      const pId = this.selectedProjectId();
      if(mId && pId) {
          return this.dataService.getMemberDebt(mId, pId);
      }
      return 0;
  });

  constructor() {
      effect(() => {
          const mId = this.prefilledMemberId();
          const pId = this.prefilledProjectId();
          const amount = this.prefilledAmount();
          const ref = this.prefilledRef();

          if (mId) this.onMemberSelect(mId);
          if (pId) this.selectedProjectId.set(pId);
          
          if (amount) {
              this.payAmount.set(amount);
              this.paymentType.set('flat');
          }
          if (ref) this.payDescription.set(ref);

          // Auto-advance if we have context
          if (mId && pId) {
              // Default to 'hours' if context is provided and no specific amount set
              if (!amount) this.paymentType.set('hours');
              this.currentStep.set(2);
          } else if (mId) {
              this.currentStep.set(2);
          }
      }, { allowSignalWrites: true });

      // Auto-update amount when selecting entries
      effect(() => {
          if (this.paymentType() === 'hours') {
              this.payAmount.set(this.totalSelectedCost());
          }
      }, { allowSignalWrites: true });
  }

  onMemberSelect(memberId: number) {
      const member = this.members().find(m => m.id === memberId);
      if (member) {
          this.selectedMemberId.set(member.id);
          this.recipientName.set(member.name);
          this.recipientRole.set(member.role);
          this.recipientEmail.set(member.email);
          this.recipientIban.set(member.paymentDetails?.iban || '');
      }
  }

  toggleEntrySelection(id: string, checked: boolean) {
      this.selectedEntryIds.update(ids => {
          const newSet = new Set(ids);
          if (checked) newSet.add(id);
          else newSet.delete(id);
          return newSet;
      });
  }

  selectAllEntries() {
      const allIds = this.availableTimeEntries().map(e => e.id);
      this.selectedEntryIds.set(new Set(allIds));
  }

  nextStep() {
      if (this.currentStep() === 1 && !this.selectedMemberId()) return;
      if (this.currentStep() === 2 && (!this.payAmount() || this.payAmount()! <= 0)) return;
      this.currentStep.set((this.currentStep() + 1) as any);
  }

  prevStep() {
      this.currentStep.set((this.currentStep() - 1) as any);
  }

  selectMethod(method: any) {
      this.payMethod.set(method);
  }

  confirmPayment() {
      if (!this.payMethod()) return;

      this.dataService.addPayment({
          recipientName: this.recipientName(),
          recipientRole: this.recipientRole(),
          recipientEmail: this.recipientEmail(),
          amount: this.payAmount()!,
          currency: this.payCurrency(),
          method: this.payMethod()!,
          description: this.payDescription() || `Payment for ${this.recipientName()}`,
          projectId: this.selectedProjectId() || undefined,
          memberId: this.selectedMemberId() || undefined
      });

      this.saved.emit();
      this.close.emit();
  }
}
