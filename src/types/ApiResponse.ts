export interface ApiResponse<T = any> {
  success: boolean;
  msg: string;
  obj: T;
}
