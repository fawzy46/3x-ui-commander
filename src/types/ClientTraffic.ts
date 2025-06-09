export interface ClientTraffic {
  id: number;
  inboundId: number;
  enable: boolean;
  email: string;
  up: number;
  down: number;
  expiryTime: number;
  total: number;
  reset: number;
}
