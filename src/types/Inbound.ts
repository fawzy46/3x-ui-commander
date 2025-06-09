import { ClientTraffic } from './ClientTraffic';

export interface Inbound {
  id: number;
  up: number;
  down: number;
  total: number;
  remark: string;
  enable: boolean;
  expiryTime: number;
  clientStats: ClientTraffic[];
  listen: string;
  port: number;
  protocol: string;
  settings: string;
  streamSettings: string;
  tag: string;
  sniffing: string;
  allocate: string;
}
