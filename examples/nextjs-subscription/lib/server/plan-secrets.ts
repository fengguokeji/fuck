import 'server-only';

const qrPayloadMap: Record<string, string> = {
  starter:
    'sub://aHR0cHM6Ly9yZXdhci50cmFmZmljbWFuYWdlci5uZXQvZWRnZXN1YnMvY2xpZW50P3Rva2VuPWNjMzRiZDQ3YzlmNWM4MGY4N2IyOTYyZTczMDZjMzkz#client',
  pro: 'sub://aHR0cHM6Ly9yZXdhci50cmFmZmljbWFuYWdlci5uZXQvZWRnZXN1YnMvY2xpZW50P3Rva2VuPWNjMzRiZDQ3YzlmNWM4MGY4N2IyOTYyZTczMDZjMzkz#clien',
  enterprise:
    'sub://aHR0cHM6Ly9yZXdhci50cmFmZmljbWFuYWdlci5uZXQvZWRnZXN1YnMvY2xpZW50P3Rva2VuPWNjMzRiZDQ3YzlmNWM4MGY4N2IyOTYyZTczMDZjMzkz#clie',
  ultimate:
    'sub://aHR0cHM6Ly9yZXdhci50cmFmZmljbWFuYWdlci5uZXQvZWRnZXN1YnMvY2xpZW50P3Rva2VuPWNjMzRiZDQ3YzlmNWM4MGY4N2IyOTYyZTczMDZjMzkz#cli',
};

export function getPlanQrPayload(planId: string): string | undefined {
  return qrPayloadMap[planId];
}
