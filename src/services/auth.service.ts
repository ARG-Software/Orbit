
import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface JobPreferences {
  location: string;
  workModel: 'any' | 'remote' | 'hybrid' | 'on-site';
  interests: string[];
  expectedSalary: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  isGoogleUser?: boolean;
  address?: string;
  taxNumber?: string;
  logoUrl?: string;
  paypalConnected?: boolean;
  stripeConnected?: boolean;
  googleMeetConnected?: boolean;
  zoomConnected?: boolean;
  jobPreferences?: JobPreferences;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  private users = signal<User[]>([]);
  currentUser = signal<User | null>(null);
  isAuthenticated = computed(() => !!this.currentUser());

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedUsers = localStorage.getItem('freelance_users');
      if (storedUsers) {
        this.users.set(JSON.parse(storedUsers));
      } else {
        // Add a default user for demonstration
        const defaultUser: User = { 
          id: 1, 
          name: 'Demo User', 
          email: 'user@example.com', 
          password: 'password123',
          address: '123 Demo Street, Webville',
          taxNumber: 'TAX-DEMO-123',
          logoUrl: '',
          paypalConnected: false,
          stripeConnected: false,
          googleMeetConnected: false,
          zoomConnected: false,
        };
        this.users.set([defaultUser]);
        localStorage.setItem('freelance_users', JSON.stringify([defaultUser]));
      }

      const storedUser = localStorage.getItem('freelance_currentUser');
      if (storedUser) {
        this.currentUser.set(JSON.parse(storedUser));
      }
    }
  }

  async register(name: string, email: string, password: string): Promise<{ success: boolean; message?: string }> {
    if (this.users().some(u => u.email === email)) {
      return { success: false, message: 'An account with this email already exists.' };
    }
    const maxId = this.users().length > 0 ? Math.max(...this.users().map(u => u.id)) : 0;
    const newUser: User = { 
      id: maxId + 1, 
      name, 
      email, 
      password,
      address: '',
      taxNumber: '',
      logoUrl: '',
      paypalConnected: false,
      stripeConnected: false,
      googleMeetConnected: false,
      zoomConnected: false,
    };
    this.users.update(users => [...users, newUser]);
    
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('freelance_users', JSON.stringify(this.users()));
    }
    
    this.setCurrentUser(newUser);
    return { success: true };
  }

  async login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
    const user = this.users().find(u => u.email === email);
    if (!user || user.isGoogleUser) {
        return { success: false, message: 'Invalid email or password.' };
    }
    if (user.password !== password) {
      return { success: false, message: 'Invalid email or password.' };
    }
    this.setCurrentUser(user);
    return { success: true };
  }

  async loginWithGoogle(): Promise<{ success: boolean; message?: string }> {
    let googleUser = this.users().find(u => u.email === 'google.user@example.com');
    if (!googleUser) {
      const maxId = this.users().length > 0 ? Math.max(...this.users().map(u => u.id)) : 0;
      googleUser = { 
        id: maxId + 1, 
        name: 'Google User', 
        email: 'google.user@example.com', 
        isGoogleUser: true,
        address: '456 Google Way, Mountain View',
        taxNumber: 'TAX-GOOG-456',
        logoUrl: '',
        paypalConnected: true,
        stripeConnected: false,
        googleMeetConnected: true, // Assume connected for Google User
        zoomConnected: false,
      };
      this.users.update(users => [...users, googleUser!]);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('freelance_users', JSON.stringify(this.users()));
      }
    }
    this.setCurrentUser(googleUser);
    return { success: true };
  }

  logout(): void {
    this.currentUser.set(null);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('freelance_currentUser');
    }
    this.router.navigate(['/login']);
  }

  private setCurrentUser(user: User): void {
    const userToStore = { ...user };
    delete userToStore.password;
    this.currentUser.set(userToStore);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('freelance_currentUser', JSON.stringify(userToStore));
    }
  }

  updateUserSettings(settings: Partial<User>) {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    // Update the master list of users
    this.users.update(users => {
      const userIndex = users.findIndex(u => u.id === currentUser.id);
      if (userIndex > -1) {
        const updatedUsers = [...users];
        const updatedUser = { ...updatedUsers[userIndex], ...settings };
        updatedUsers[userIndex] = updatedUser;
        
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('freelance_users', JSON.stringify(updatedUsers));
        }
        return updatedUsers;
      }
      return users;
    });

    // Update the current user signal and local storage
    const updatedCurrentUser = { ...currentUser, ...settings };
    this.currentUser.set(updatedCurrentUser);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('freelance_currentUser', JSON.stringify(updatedCurrentUser));
    }
  }

  updateJobPreferences(preferences: JobPreferences) {
    const currentUser = this.currentUser();
    if (!currentUser) return;
    this.updateUserSettings({ jobPreferences: preferences });
  }
}
