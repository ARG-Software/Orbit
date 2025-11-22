
import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface JobPreferences {
  location: string;
  workModel: 'any' | 'remote' | 'hybrid' | 'on-site';
  interests: string[];
  expectedSalary: number;
}

export type UserRole = 'ADMIN' | 'MEMBER';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  teamMemberId?: number; // Linked ID from MockDataService TeamMember
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
  isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedUsers = localStorage.getItem('freelance_users');
      
      // Default users definition
      const defaultAdmin: User = { 
        id: 1, 
        name: 'Demo Admin', 
        email: 'admin@example.com', 
        password: 'password123',
        role: 'ADMIN',
        address: '123 Demo Street, Webville',
        taxNumber: 'TAX-DEMO-123',
        logoUrl: '',
        paypalConnected: false,
        stripeConnected: false,
        googleMeetConnected: false,
        zoomConnected: false,
      };

      const defaultMember: User = {
          id: 2,
          name: 'Alex Doe',
          email: 'member@example.com',
          password: 'password123',
          role: 'MEMBER',
          teamMemberId: 1, // Links to "Alex Doe" in MockDataService
          address: '456 Freelance Blvd',
          taxNumber: 'TAX-MEM-001',
          logoUrl: 'https://picsum.photos/seed/alex/100/100',
          paypalConnected: false,
          stripeConnected: false,
          googleMeetConnected: false,
          zoomConnected: false
      };

      if (storedUsers) {
        const parsedUsers = JSON.parse(storedUsers);
        
        // ROBUSTNESS: Ensure default member exists even if local storage has old data
        if (!parsedUsers.some((u: User) => u.email === 'member@example.com')) {
             // Find a safe ID
             const maxId = parsedUsers.length > 0 ? Math.max(...parsedUsers.map((u: any) => u.id)) : 0;
             defaultMember.id = maxId + 1;
             parsedUsers.push(defaultMember);
             localStorage.setItem('freelance_users', JSON.stringify(parsedUsers));
        }

        this.users.set(parsedUsers);
      } else {
        this.users.set([defaultAdmin, defaultMember]);
        localStorage.setItem('freelance_users', JSON.stringify([defaultAdmin, defaultMember]));
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
    
    // Default registration creates an ADMIN
    const newUser: User = { 
      id: maxId + 1, 
      name, 
      email, 
      password,
      role: 'ADMIN',
      address: '',
      taxNumber: '',
      logoUrl: '',
      paypalConnected: false,
      stripeConnected: false,
      googleMeetConnected: false,
      zoomConnected: false,
    };
    this.users.update(users => [...users, newUser]);
    
    this.saveUsers();
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
    
    // If user doesn't exist, create them as ADMIN
    if (!googleUser) {
      const maxId = this.users().length > 0 ? Math.max(...this.users().map(u => u.id)) : 0;
      googleUser = { 
        id: maxId + 1, 
        name: 'Google User', 
        email: 'google.user@example.com', 
        role: 'ADMIN', 
        isGoogleUser: true,
        address: '456 Google Way, Mountain View',
        taxNumber: 'TAX-GOOG-456',
        logoUrl: '',
        paypalConnected: true,
        stripeConnected: false,
        googleMeetConnected: true,
        zoomConnected: false,
      };
      this.users.update(users => [...users, googleUser!]);
      this.saveUsers();
    } else {
        // Ensure existing Google user is ADMIN (updates if previously different)
        if (googleUser.role !== 'ADMIN') {
            googleUser = { ...googleUser, role: 'ADMIN' };
            this.updateUserSettings(googleUser);
        }
    }
    
    this.setCurrentUser(googleUser);
    return { success: true };
  }
  
  async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const user = this.users().find(u => u.email === email);
    
    if (user) {
        console.log(`Password reset link sent to ${email}`);
        return { success: true, message: 'A password reset link has been sent to your email.' };
    }
    
    // For a mock app, returning false helps testing. 
    // In production, you often return success to prevent email enumeration.
    return { success: false, message: 'No account found with that email address.' };
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

  private saveUsers() {
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('freelance_users', JSON.stringify(this.users()));
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
    this.updateUserSettings({ jobPreferences: preferences });
  }
}