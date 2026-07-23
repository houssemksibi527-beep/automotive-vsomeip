export type Status = { switch: boolean; ivi: boolean; hpc: boolean };

export type DeviceId = "ivi" | "hpc";

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

export const IVI_IP = "192.168.10.13";
export const HPC_IP = "192.168.10.14";
export const SD_MCAST = "224.244.224.245";
