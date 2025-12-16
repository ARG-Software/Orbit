
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const publicGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router: Router = inject(Router);

  // Allow landing page even if logged in (optional choice), 
  // but usually for public guard on login/register we redirect.
  // If user hits root '/', we might want to let them see landing or redirect.
  // For this implementation: if accessing Login/Register/Join and logged in -> Redirect.
  // If accessing '/' and logged in -> Redirect to app.
  
  if (authService.isAuthenticated()) {
    return router.parseUrl('/app/dashboard');
  }

  return true;
};
