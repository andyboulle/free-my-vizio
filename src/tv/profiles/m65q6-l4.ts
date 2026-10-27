import type { TvProfile } from './types.ts';

export const m65q6L4: TvProfile = {
  id: 'vizio-m65q6-l4',
  matches: info => info.model === 'M65Q6-L4',
  verifiedFirmware: ['86.910.19.2-1'],
  conjureAppId: '17',
  nativeHome: { nameSpace: 4, appId: '1', message: '{"app":"home","bundle":"bundles/home"}' },
  isNativeHome: app => app.nameSpace === 4 && app.appId === '1',
  inputWriteUsesCname: true,
  viewport: { width: 1280, height: 720 },
};
