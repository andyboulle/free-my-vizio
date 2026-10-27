import type { TvProfile } from './types.ts';

export const genericSmartCast: TvProfile = {
  id: 'generic-smartcast',
  matches: () => true,
  verifiedFirmware: [],
  conjureAppId: '17',
  nativeHome: { nameSpace: 4, appId: '1', message: '{"app":"home","bundle":"bundles/home"}' },
  isNativeHome: app => app.nameSpace === 4 && app.appId === '1',
  inputWriteUsesCname: true,
  viewport: { width: 1280, height: 720 },
};
