
import { Component, ChangeDetectionStrategy, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgOptimizedImage],
})
export class SettingsComponent {
  private authService = inject(AuthService);
  
  user = this.authService.currentUser;
  
  // Form signals
  name = signal('');
  address = signal('');
  taxNumber = signal('');
  logoUrl = signal('');
  paypalConnected = signal(false);
  stripeConnected = signal(false);
  googleMeetConnected = signal(false);
  zoomConnected = signal(false);

  showSuccessToast = signal(false);

  constructor() {
    effect(() => {
      const currentUser = this.user();
      if (currentUser) {
        this.name.set(currentUser.name);
        this.address.set(currentUser.address || '');
        this.taxNumber.set(currentUser.taxNumber || '');
        this.logoUrl.set(currentUser.logoUrl || '');
        this.paypalConnected.set(currentUser.paypalConnected || false);
        this.stripeConnected.set(currentUser.stripeConnected || false);
        this.googleMeetConnected.set(currentUser.googleMeetConnected || false);
        this.zoomConnected.set(currentUser.zoomConnected || false);
      }
    }, { allowSignalWrites: true });
  }

  saveProfile() {
    this.authService.updateUserSettings({
      name: this.name(),
      address: this.address(),
      taxNumber: this.taxNumber(),
      logoUrl: this.logoUrl(),
    });
    this.triggerSuccessToast();
  }

  togglePaypal(connected: boolean) {
    this.paypalConnected.set(connected);
    this.authService.updateUserSettings({ paypalConnected: connected });
    this.triggerSuccessToast();
  }

  toggleStripe(connected: boolean) {
    this.stripeConnected.set(connected);
    this.authService.updateUserSettings({ stripeConnected: connected });
    this.triggerSuccessToast();
  }
  
  toggleGoogleMeet(connected: boolean) {
    this.googleMeetConnected.set(connected);
    this.authService.updateUserSettings({ googleMeetConnected: connected });
    this.triggerSuccessToast();
  }

  toggleZoom(connected: boolean) {
    this.zoomConnected.set(connected);
    this.authService.updateUserSettings({ zoomConnected: connected });
    this.triggerSuccessToast();
  }

  private triggerSuccessToast() {
    this.showSuccessToast.set(true);
    setTimeout(() => this.showSuccessToast.set(false), 3000);
  }
}
