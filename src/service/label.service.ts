import { Injectable } from "@angular/core";

// TODO: Implement translated captions service
// - loadLabels(langcode) should fetch labels from the backend
// - getLabel(langcode, key) should return the translated caption for a given key
// - BaseTable.colCaption() and related methods should use this service for i18n
@Injectable({ providedIn: 'root' })
export class LabelService {
    protected labels: Map<string, Map<string, string>> = new Map();

    /** Falls back to the key itself so a missing translation is visible, not a blank caption. */
    getLabel(langcode: string, key: string): string {
        return this.labels.get(langcode)?.get(key) ?? key;
    }

    loadLabels(_langcode: string) {
        // TODO: fetch from backend and populate this.labels
    }
}
