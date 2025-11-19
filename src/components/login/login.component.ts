import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule],
})
export class LoginComponent {
  private router: Router = inject(Router);
  private authService = inject(AuthService);

  errorMessage = signal<string | null>(null);
  isSubmitting = signal(false);

  async login(form: NgForm) {
    if (form.invalid || this.isSubmitting()) return;
    
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { email, password } = form.value;
    const result = await this.authService.login(email, password);
    
    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage.set(result.message || 'Login failed. Please try again.');
    }
    this.isSubmitting.set(false);
  }
  
  async loginWithGoogle() {
    if (this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    
    const result = await this.authService.loginWithGoogle();
    
    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage.set(result.message || 'Google login failed. Please try again.');
    }
    this.isSubmitting.set(false);
  }
}