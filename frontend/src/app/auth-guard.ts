import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Cookies } from './cookies';

// - not logged in            -> redirect to /login
// - logged in, wrong role    -> redirect to /applications
// - route without data.roles -> any logged-in user passes
// WARN: needs testing, quick draft
export const roleGuard: CanActivateFn = (route): boolean | UrlTree => {
  const platformId = inject(PLATFORM_ID);
  const cookies = inject(Cookies);
  const router = inject(Router);

  // skip on the server: cookies aren't available during SSR, the client
  // re-runs the guard after hydration (avoids a redirect flash)
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const raw = cookies.getCookie('user');
  if (!raw) {
    return router.parseUrl('/login');
  }

  const allowed = route.data?.['roles'] as string[] | undefined;
  if (!allowed || allowed.length === 0) {
    return true;
  } // login is enough

  let role = '';
  try {
    role = JSON.parse(raw).role;
  } catch {
    return router.parseUrl('/login');
  }

  return allowed.includes(role) ? true : router.parseUrl('/applications');
};
