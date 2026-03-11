import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface FashionItem {
  _id: string;
  title: string;
  details: string;
  thumbnail: string;
  style: string;
  createdAt: string;
}

interface GroupedFashion {
  style: string;
  items: FashionItem[];
}

const API = 'http://localhost:3002/api/fashions';

@Component({
  selector: 'app-ex58',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ex58.html',
  styleUrl: './ex58.css'
})
export class Ex58Component implements OnInit {
  fashions: FashionItem[] = [];
  groupedFashions: GroupedFashion[] = [];
  styles: string[] = [];

  selectedStyle = '';
  keywordStyle = '';

  selectedFashion: FashionItem | null = null;
  loading = false;
  errorMessage = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadFashions();
  }

  loadFashions(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<FashionItem[]>(API).subscribe({
      next: (data) => {
        this.fashions = data || [];
        this.styles = [...new Set(this.fashions.map((x) => x.style))].sort((a, b) => a.localeCompare(b));
        this.rebuildGroups();
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Khong tai duoc danh sach fashion';
        this.loading = false;
      }
    });
  }

  onSearchStyle(): void {
    this.rebuildGroups();
  }

  onStyleDropdownChange(): void {
    if (this.selectedStyle) {
      this.keywordStyle = this.selectedStyle;
    }
    this.rebuildGroups();
  }

  clearFilter(): void {
    this.selectedStyle = '';
    this.keywordStyle = '';
    this.rebuildGroups();
  }

  showDetail(item: FashionItem): void {
    this.selectedFashion = item;
  }

  backToList(): void {
    this.selectedFashion = null;
  }

  private rebuildGroups(): void {
    const normalized = (this.selectedStyle || this.keywordStyle || '').trim().toLowerCase();
    const filtered = normalized
      ? this.fashions.filter((x) => x.style.toLowerCase().includes(normalized))
      : this.fashions;

    const map = new Map<string, FashionItem[]>();
    filtered.forEach((item) => {
      if (!map.has(item.style)) {
        map.set(item.style, []);
      }
      map.get(item.style)!.push(item);
    });

    this.groupedFashions = [...map.entries()]
      .map(([style, items]) => ({ style, items }))
      .sort((a, b) => a.style.localeCompare(b.style));
  }
}
