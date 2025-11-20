
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-join',
  templateUrl: './join.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class JoinComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  memberName = signal('');
  memberEmail = signal(''); // In real app, this comes from token validation
  teamMemberId = signal<number | null>(null);
  
  errorMessage = signal<string | null>(null);
  isSubmitting = signal(false);

  ngOnInit() {
    // Simulate extracting data from an invite token
    this.route.queryParams.subscribe(params => {
        if (params['name']) this.memberName.set(params['name']);
        if (params['id']) this.teamMemberId.set(Number(params['id']));
        // We'll ask user to input email to confirm, or pre-fill if we had a backend
    });
  }

  async register(form: NgForm) {
    if (form.invalid || this.isSubmitting()) return;
    if (!this.teamMemberId()) {
        this.errorMessage.set('Invalid invite link.');
        return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { email, password } = form.value;
    const result = await this.authService.registerMember(this.memberName(), email, password, this.teamMemberId()!);

    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage.set(result.message || 'Registration failed. Please try again.');
    }
    this.isSubmitting.set(false);
  }
}
