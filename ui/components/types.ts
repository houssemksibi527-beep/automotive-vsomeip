export type Status = { switch: boolean; lidar: boolean; steering: boolean };

export type DeviceId = "lidar" | "steering";

export type Packet = {
  no: number;
  t: number;
  src: string;
  dst: string;
  proto: string;
  len: number;
  info: string;
  error?: string;
};

export const LIDAR_IP = "192.168.10.11";
export const STEER_IP = "192.168.10.12";
export const SD_MCAST = "224.244.224.245";
