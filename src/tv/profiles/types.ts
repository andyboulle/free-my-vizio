import type { AppRef, DeviceInfo } from '../smartcast-client.ts';

export interface TvProfile {
  id: string;
  matches(info: DeviceInfo): boolean;
  verifiedFirmware: string[];
  conjureAppId: string;
  nativeHome: AppRef;
  isNativeHome(app: AppRef): boolean;
  inputWriteUsesCname: true;
  viewport: { width: 1280; height: 720 };
}

export interface ProfileSelection { profile: TvProfile; verified: boolean }
