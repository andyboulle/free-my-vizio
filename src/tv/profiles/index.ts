import type { DeviceInfo } from '../smartcast-client.ts';
import { genericSmartCast } from './generic-smartcast.ts';
import { m65q6L4 } from './m65q6-l4.ts';
import type { ProfileSelection, TvProfile } from './types.ts';

const profiles: TvProfile[] = [m65q6L4];
export function selectProfile(info: DeviceInfo): ProfileSelection {
  const profile = profiles.find(candidate => candidate.matches(info)) ?? genericSmartCast;
  return { profile, verified: profile.verifiedFirmware.includes(info.firmware) && profile.id !== genericSmartCast.id };
}
export { genericSmartCast, m65q6L4 };
export type { ProfileSelection, TvProfile };
