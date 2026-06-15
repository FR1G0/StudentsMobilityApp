import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class Cookies {
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object
  ){}

  // function to set (insert or update) cookies
  setCookie(name: string, value: string, days?: number): void {
    if(!isPlatformBrowser(this.platformId)) { return; }
      let expires = '';
      if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = `; expires=${date.toUTCString()}`;
      }
      // Secure and SameSite configuration is highly recommended

      document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Strict; Secure`;
  }

  // function to get cookie
  getCookie(name: string): string | null {
    if(!isPlatformBrowser(this.platformId)) { return null; }
      const nameEQ = name + '=';
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
      }
    return null;
  }

  // function to delete a cookie
  deleteCookie(name: string): void {
    if(isPlatformBrowser(this.platformId)) { return; }
      document.cookie = `${name}=; Max-Age=-99999999; path=/; SameSite=Strict; Secure`;
  }
}
