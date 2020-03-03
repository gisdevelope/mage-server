import { Component, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, Input } from '@angular/core';
import { NominatimService } from '../search/nominatim.service';
import { MatList } from '@angular/material';
import L from 'leaflet';

export enum SearchState {
  ON,
  OFF
}

export interface SearchEvent {
  feature: any;
}

@Component({
  selector: 'map-control-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements AfterViewInit {

  @ViewChild('searchInput', { static: true }) searchInput: any;
  @ViewChild(MatList, { read: ElementRef, static: false }) matList: ElementRef;

  @Output() onSearch = new EventEmitter<SearchEvent>();
  @Output() onSearchClear = new EventEmitter<void>();

  SearchState = SearchState;
  searchState = SearchState.OFF;

  searchResults: any[] = [];
  searching = false;

  constructor(private nominatim: NominatimService) { }

  ngAfterViewInit(): void {
    L.DomEvent.disableClickPropagation(this.matList.nativeElement);
    L.DomEvent.disableScrollPropagation(this.matList.nativeElement);
  }

  searchToggle() {
    this.searchState = this.searchState === SearchState.ON ? SearchState.OFF : SearchState.ON;

    if (this.searchState === SearchState.ON) {
      setTimeout(() => {
        this.searchInput.nativeElement.focus();
      });
    }
  }

  search(value: string) {
    this.searching = true;
    this.nominatim.search(value).subscribe((data: any) => {
      this.searching = false;
      this.searchResults = data.features;
    });
  }

  clear($event: MouseEvent, input: HTMLInputElement) {
    $event.stopPropagation();
    $event.preventDefault();
    input.value = null;
    this.searchResults = [];

    this.onSearchClear.emit();
  }

  searchResultClick(result: any) {
    this.searchToggle();
    this.onSearch.emit({ feature: result });
  }

}