import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RestURL } from './rest_url';
import { BaseRestService } from './base_rest.service';
import { CatalogEntry } from '../model/appdata';

/** keel's public country and state catalog (keel v1.3.12); safe to call before login. */
@Injectable({ providedIn: 'root' })
export class GeoCatalogService extends BaseRestService {
  countries(): Observable<CatalogEntry[]> {
    return this.http.get<CatalogEntry[]>(this.url(RestURL.countriesURL));
  }

  states(country: string): Observable<CatalogEntry[]> {
    return this.http.get<CatalogEntry[]>(`${this.url(RestURL.countriesURL)}/${encodeURIComponent(country)}/states`);
  }
}
