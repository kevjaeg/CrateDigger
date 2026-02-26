import { discogsRequest } from './client';

// --- Types ---

export interface DiscogsIdentity {
  id: number;
  username: string;
  resource_url: string;
  consumer_name: string;
}

export interface DiscogsProfile {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  num_collection: number;
  num_wantlist: number;
  num_for_sale: number;
  releases_contributed: number;
  rank: number;
  location: string;
  uri: string;
}

export interface DiscogsFolder {
  id: number;
  name: string;
  count: number;
  resource_url: string;
}

export interface DiscogsPagination {
  page: number;
  pages: number;
  per_page: number;
  items: number;
  urls: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

export interface DiscogsBasicInformation {
  id: number;
  title: string;
  year: number;
  thumb: string;
  cover_image: string;
  genres: string[];
  styles: string[];
  formats: { name: string; qty: string; descriptions: string[] }[];
  labels: { id: number; name: string; catno: string }[];
  artists: { id: number; name: string; anv: string }[];
}

export interface DiscogsCollectionItem {
  id: number;
  instance_id: number;
  folder_id: number;
  rating: number;
  date_added: string;
  basic_information: DiscogsBasicInformation;
  notes?: { field_id: number; value: string }[];
}

export interface DiscogsCollectionPage {
  pagination: DiscogsPagination;
  releases: DiscogsCollectionItem[];
}

export interface DiscogsWantlistItem {
  id: number;
  rating: number;
  date_added: string;
  basic_information: DiscogsBasicInformation;
  notes?: string;
}

export interface DiscogsWantlistPage {
  pagination: DiscogsPagination;
  wants: DiscogsWantlistItem[];
}

export interface DiscogsRelease {
  id: number;
  title: string;
  year: number;
  artists: { id: number; name: string; anv: string }[];
  labels: { id: number; name: string; catno: string }[];
  genres: string[];
  styles: string[];
  tracklist: { position: string; title: string; duration: string }[];
  images: { type: string; uri: string; uri150: string; width: number; height: number }[];
  formats: { name: string; qty: string; descriptions: string[] }[];
  community: {
    have: number;
    want: number;
    rating: { average: number; count: number };
  };
  lowest_price: number | null;
  num_for_sale: number;
  notes: string;
  country: string;
  uri: string;
  master_id?: number;
  identifiers?: { type: string; value: string }[];
  videos?: { uri: string; title: string; duration: number }[];
}

export interface DiscogsSearchResult {
  id: number;
  type: string;
  title: string;
  thumb: string;
  cover_image: string;
  uri: string;
  year?: string;
  genre?: string[];
  style?: string[];
  format?: string[];
  label?: string[];
  country?: string;
  barcode?: string[];
  community?: { have: number; want: number };
}

export interface DiscogsSearchPage {
  pagination: DiscogsPagination;
  results: DiscogsSearchResult[];
}

export interface DiscogsCollectionValue {
  minimum: string;
  median: string;
  maximum: string;
}

export interface DiscogsPriceSuggestions {
  [condition: string]: { value: number; currency: string };
}

export interface DiscogsMarketplaceStats {
  lowest_price: { value: number; currency: string } | null;
  num_for_sale: number;
  blocked_from_sale: boolean;
}

// --- API Functions ---

export const api = {
  getIdentity: () =>
    discogsRequest<DiscogsIdentity>('/oauth/identity'),

  getProfile: (username: string) =>
    discogsRequest<DiscogsProfile>(`/users/${username}`),

  getCollectionFolders: (username: string) =>
    discogsRequest<{ folders: DiscogsFolder[] }>(
      `/users/${username}/collection/folders`
    ),

  getCollectionItems: (username: string, folderId: number, page = 1, perPage = 100) =>
    discogsRequest<DiscogsCollectionPage>(
      `/users/${username}/collection/folders/${folderId}/releases?page=${page}&per_page=${perPage}&sort=added&sort_order=desc`
    ),

  addToCollection: (username: string, folderId: number, releaseId: number) =>
    discogsRequest<{ instance_id: number; resource_url: string }>(
      `/users/${username}/collection/folders/${folderId}/releases/${releaseId}`,
      { method: 'POST' }
    ),

  removeFromCollection: (
    username: string,
    folderId: number,
    releaseId: number,
    instanceId: number
  ) =>
    discogsRequest<void>(
      `/users/${username}/collection/folders/${folderId}/releases/${releaseId}/instances/${instanceId}`,
      { method: 'DELETE' }
    ),

  getCollectionValue: (username: string) =>
    discogsRequest<DiscogsCollectionValue>(
      `/users/${username}/collection/value`
    ),

  getWantlist: (username: string, page = 1, perPage = 100) =>
    discogsRequest<DiscogsWantlistPage>(
      `/users/${username}/wants?page=${page}&per_page=${perPage}&sort=added&sort_order=desc`
    ),

  addToWantlist: (username: string, releaseId: number) =>
    discogsRequest<DiscogsWantlistItem>(
      `/users/${username}/wants/${releaseId}`,
      { method: 'PUT' }
    ),

  removeFromWantlist: (username: string, releaseId: number) =>
    discogsRequest<void>(
      `/users/${username}/wants/${releaseId}`,
      { method: 'DELETE' }
    ),

  getRelease: (releaseId: number) =>
    discogsRequest<DiscogsRelease>(`/releases/${releaseId}`),

  search: (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    return discogsRequest<DiscogsSearchPage>(
      `/database/search?${query}`
    );
  },

  searchByBarcode: (barcode: string) =>
    discogsRequest<DiscogsSearchPage>(
      `/database/search?barcode=${encodeURIComponent(barcode)}&type=release`
    ),

  getPriceSuggestions: (releaseId: number) =>
    discogsRequest<DiscogsPriceSuggestions>(
      `/marketplace/price_suggestions/${releaseId}`
    ),

  getMarketplaceStats: (releaseId: number) =>
    discogsRequest<DiscogsMarketplaceStats>(
      `/marketplace/stats/${releaseId}`
    ),

  editCollectionItemFields: (
    username: string,
    folderId: number,
    releaseId: number,
    instanceId: number,
    fields: { rating?: number }
  ) =>
    discogsRequest<void>(
      `/users/${username}/collection/folders/${folderId}/releases/${releaseId}/instances/${instanceId}`,
      { method: 'POST', body: fields }
    ),
};
