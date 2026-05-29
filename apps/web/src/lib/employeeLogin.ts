export const DEFAULT_COMPANY_CODE = 'HBPL';
export const PENDING_EMPLOYEE_LOGIN_STORAGE_KEY = 'prism.pendingEmployeeLogin';

export function normalizeEmployeeId(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeCompanyCode(value: string) {
  return value.trim().toUpperCase();
}
