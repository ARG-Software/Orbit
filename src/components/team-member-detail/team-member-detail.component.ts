import { Component, ChangeDetectionStrategy, inject, signal, effect, Signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { MockDataService, TeamMember } from '../../services/mock-data.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-team-member-detail',
  templateUrl: './team-member-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DecimalPipe],
})
export class TeamMemberDetailComponent {
  private route = inject(ActivatedRoute);
  private dataService = inject(MockDataService);

  member: Signal<TeamMember | undefined> = toSignal(
    this.route.paramMap.pipe(
      map(params => Number(params.get('id'))),
      switchMap(id => this.dataService.getTeamMemberById(id))
    )
  );
  
  // Form state signals
  memberName = signal('');
  memberRole = signal('');
  memberAvatarUrl = signal('');
  memberDefaultRate = signal(0);
  
  showSuccessToast = signal(false);

  constructor() {
    effect(() => {
      const m = this.member();
      if (m) {
        this.memberName.set(m.name);
        this.memberRole.set(m.role);
        this.memberAvatarUrl.set(m.avatarUrl);
        this.memberDefaultRate.set(m.defaultHourlyRate);
      }
    }, { allowSignalWrites: true });
  }

  saveMemberDetails(): void {
    const currentMember = this.member();
    if (!currentMember) return;

    const updatedMember: TeamMember = {
      ...currentMember,
      name: this.memberName(),
      role: this.memberRole(),
      avatarUrl: this.memberAvatarUrl(),
      defaultHourlyRate: this.memberDefaultRate(),
    };

    this.dataService.updateTeamMember(updatedMember);
    this.triggerSuccessToast();
  }
  
  private triggerSuccessToast() {
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 3000);
  }
}