import { apiClient } from './client';
import type {
  Dispense,
  Drug,
  DrugBatch,
  DrugMovementRow,
  DrugStockRow,
  Grn,
  GrnItem,
  Paginated,
  PharmacyAlerts,
  PharmacyDashboard,
  PrescriptionPrefill,
  Supplier,
  SupplierPayment,
} from '../types';

export interface DrugInput {
  code?: string;
  name?: string;
  genericName?: string;
  form?: string;
  strength?: string;
  unit?: string;
  hsnCode?: string;
  gstRate?: string;
  mrp?: string;
  purchasePrice?: string;
  reorderLevel?: number;
  rackLocation?: string;
  scheduleH?: boolean;
  isActive?: boolean;
}

export interface SupplierInput {
  code?: string;
  name?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  isActive?: boolean;
}

export interface GrnItemInput {
  drugId: number;
  batchNo: string;
  expiryDate: string;
  quantity: string;
  freeQuantity?: string;
  purchasePrice: string;
  mrp: string;
  gstRate?: string;
}

export interface DispenseLineInput {
  drugId: number;
  quantity: string;
  discount?: string;
  prescriptionItemId?: number;
}

export const pharmacyApi = {
  // drugs
  drugs: async (params: {
    q?: string;
    form?: string;
    isActive?: string;
    limit?: number;
    cursor?: string;
    page?: number;
  }): Promise<Paginated<Drug>> =>
    (await apiClient.get<Paginated<Drug>>('/pharmacy/drugs', { params })).data,
  drugsStock: async (params: {
    q?: string;
    form?: string;
    isActive?: string;
    limit?: number;
  }): Promise<Paginated<DrugStockRow>> =>
    (
      await apiClient.get<Paginated<DrugStockRow>>('/pharmacy/drugs/stock', {
        params,
      })
    ).data,
  drugSearch: async (q: string): Promise<Drug[]> =>
    (await apiClient.get<Drug[]>('/pharmacy/drugs/search', { params: { q } }))
      .data,
  drug: async (id: string): Promise<Drug> =>
    (await apiClient.get<Drug>(`/pharmacy/drugs/${id}`)).data,
  drugBatches: async (id: string): Promise<DrugBatch[]> =>
    (await apiClient.get<DrugBatch[]>(`/pharmacy/drugs/${id}/batches`)).data,
  drugMovements: async (
    id: string,
    from?: string,
    to?: string,
  ): Promise<DrugMovementRow[]> =>
    (
      await apiClient.get<DrugMovementRow[]>(`/pharmacy/drugs/${id}/movements`, {
        params: { from, to },
      })
    ).data,
  createDrug: async (body: DrugInput): Promise<Drug> =>
    (await apiClient.post<Drug>('/pharmacy/drugs', body)).data,
  updateDrug: async (id: string, body: DrugInput): Promise<Drug> =>
    (await apiClient.patch<Drug>(`/pharmacy/drugs/${id}`, body)).data,
  deleteDrug: async (id: string): Promise<void> => {
    await apiClient.delete(`/pharmacy/drugs/${id}`);
  },

  // suppliers
  suppliers: async (params: {
    q?: string;
    isActive?: string;
    limit?: number;
    cursor?: string;
  }): Promise<Paginated<Supplier>> =>
    (await apiClient.get<Paginated<Supplier>>('/pharmacy/suppliers', { params }))
      .data,
  supplier: async (id: string): Promise<Supplier> =>
    (await apiClient.get<Supplier>(`/pharmacy/suppliers/${id}`)).data,
  supplierPayments: async (id: string): Promise<SupplierPayment[]> =>
    (
      await apiClient.get<SupplierPayment[]>(
        `/pharmacy/suppliers/${id}/payments`,
      )
    ).data,
  createSupplier: async (body: SupplierInput): Promise<Supplier> =>
    (await apiClient.post<Supplier>('/pharmacy/suppliers', body)).data,
  updateSupplier: async (id: string, body: SupplierInput): Promise<Supplier> =>
    (await apiClient.patch<Supplier>(`/pharmacy/suppliers/${id}`, body)).data,
  addSupplierPayment: async (
    id: string,
    body: {
      amount: string;
      method?: string;
      reference?: string;
      paidAt: string;
      notes?: string;
    },
  ): Promise<SupplierPayment> =>
    (
      await apiClient.post<SupplierPayment>(
        `/pharmacy/suppliers/${id}/payments`,
        body,
      )
    ).data,

  // GRNs
  grns: async (params: {
    supplierId?: number;
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<Paginated<Grn>> =>
    (await apiClient.get<Paginated<Grn>>('/pharmacy/grns', { params })).data,
  grn: async (id: string): Promise<Grn> =>
    (await apiClient.get<Grn>(`/pharmacy/grns/${id}`)).data,
  createGrn: async (body: {
    supplierId: number;
    invoiceNo?: string;
    invoiceDate?: string;
    receivedDate: string;
    notes?: string;
  }): Promise<Grn> =>
    (await apiClient.post<Grn>('/pharmacy/grns', body)).data,
  setGrnItems: async (
    id: string,
    items: GrnItemInput[],
  ): Promise<{ items: GrnItem[] }> =>
    (await apiClient.put<{ items: GrnItem[] }>(`/pharmacy/grns/${id}/items`, {
      items,
    })).data,
  postGrn: async (id: string): Promise<Grn> =>
    (await apiClient.post<Grn>(`/pharmacy/grns/${id}/post`)).data,
  cancelGrn: async (id: string): Promise<Grn> =>
    (await apiClient.post<Grn>(`/pharmacy/grns/${id}/cancel`)).data,

  // dispensing
  dispenses: async (params: {
    patientId?: number;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }): Promise<Paginated<Dispense>> =>
    (await apiClient.get<Paginated<Dispense>>('/pharmacy/dispenses', { params }))
      .data,
  dispense: async (id: string): Promise<Dispense> =>
    (await apiClient.get<Dispense>(`/pharmacy/dispenses/${id}`)).data,
  prescriptionItems: async (rxId: string): Promise<PrescriptionPrefill> =>
    (
      await apiClient.get<PrescriptionPrefill>(
        `/pharmacy/dispenses/prescription/${rxId}/items`,
      )
    ).data,
  createDispense: async (body: {
    patientId: number;
    prescriptionId?: number;
    visitId?: number;
    lines: DispenseLineInput[];
  }): Promise<Dispense> =>
    (await apiClient.post<Dispense>('/pharmacy/dispenses', body)).data,
  cancelDispense: async (id: string): Promise<Dispense> =>
    (await apiClient.post<Dispense>(`/pharmacy/dispenses/${id}/cancel`)).data,

  // dashboard
  dashboard: async (): Promise<PharmacyDashboard> =>
    (await apiClient.get<PharmacyDashboard>('/pharmacy/dashboard')).data,
  alerts: async (): Promise<PharmacyAlerts> =>
    (await apiClient.get<PharmacyAlerts>('/pharmacy/alerts')).data,
};
