
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, NgClass],
})
export class LoginComponent {
  private router: Router = inject(Router);
  private authService = inject(AuthService);

  // Form Data
  email = signal('');
  password = signal('');
  
  // Feedback
  errorMessage = signal<string | null>(null);
  isSubmitting = signal(false);

  async login() {
    if (!this.email() || !this.password() || this.isSubmitting()) return;
    
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const result = await this.authService.login(this.email(), this.password());
    
    if (result.success) {
      this.router.navigate(['/app/dashboard']);
    } else {
      this.errorMessage.set(result.message || 'Login failed. Please try again.');
      this.isSubmitting.set(false);
    }
  }

  async loginWithGoogle() {
    if (this.isSubmitting()) return;
    
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    // Simulate network delay for effect
    await new Promise(resolve => setTimeout(resolve, 800));

    const result = await this.authService.loginWithGoogle();
    
    if (result.success) {
      this.router.navigate(['/app/dashboard']);
    } else {
      this.errorMessage.set(result.message || 'Google login failed.');
      this.isSubmitting.set(false);
    }
  }
}
