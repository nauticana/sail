import { HttpInterceptorFn } from '@angular/common/http';
import { isKeelApiUrl } from './rest_url';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('jwt');
  if (token && isKeelApiUrl(req.url)) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }
  return next(req);
};
