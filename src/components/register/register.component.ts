
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule],
})
export class RegisterComponent {
  private router: Router = inject(Router);
  private authService = inject(AuthService);
  
  errorMessage = signal<string | null>(null);
  isSubmitting = signal(false);

  async register(form: NgForm) {
    if (form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { name, email, password } = form.value;
    const result = await this.authService.register(name, email, password);

    if (result.success) {
      this.router.navigate(['/app/dashboard']);
    } else {
      this.errorMessage.set(result.message || 'Registration failed. Please try again.');
    }
    this.isSubmitting.set(false);
  }
}
