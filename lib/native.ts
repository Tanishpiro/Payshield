import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeGuard = {
  cameraPermission(): Promise<void>;
  speak(options: { text: string }): Promise<void>;
  listen(): Promise<{ transcript: string }>;
  playAudio(options: { base64: string }): Promise<void>;
  stopAudio(): Promise<void>;
  cancelListening(): Promise<void>;
  shareReport(options: { base64: string; caseNumber: string }): Promise<void>;
  authenticate(options: { reason: string }): Promise<{ verified: boolean }>;
  openUpi(options: { uri: string; riskScore: number }): Promise<{ opened: boolean }>;
};

const NativeGuard = registerPlugin<NativeGuard>("PayShieldGuard");
export const requestCameraPermission = () => isNativeAndroid() ? NativeGuard.cameraPermission() : Promise.resolve();
export const speakNative = (text: string) => NativeGuard.speak({ text });

export const isNativeAndroid = () => Capacitor.getPlatform() === "android";
export const playNativeAudio = (base64: string) => NativeGuard.playAudio({ base64 });
export const stopNativeAudio = () => isNativeAndroid() ? NativeGuard.stopAudio().catch(() => {}) : Promise.resolve();
export const cancelListening = () => isNativeAndroid() ? NativeGuard.cancelListening().catch(() => {}) : Promise.resolve();
export const shareNativeReport = (base64: string, caseNumber: string) => NativeGuard.shareReport({ base64, caseNumber });

export async function listenForPayment(): Promise<string> {
  if (isNativeAndroid()) return (await NativeGuard.listen()).transcript;
  const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) throw new Error("Voice recognition is available in the Android app or a supported browser.");
  return new Promise((resolve, reject) => {
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => resolve(event.results[0][0].transcript);
    recognition.onerror = () => reject(new Error("I couldn't hear that clearly. Please try again."));
    recognition.start();
  });
}

export async function verifyOwner(reason: string) {
  if (!isNativeAndroid()) throw new Error("Owner verification requires the PayShield Android app.");
  return (await NativeGuard.authenticate({ reason })).verified;
}

export async function openUpi(uri: string, riskScore: number) {
  if (riskScore > 90) throw new Error("PayShield blocked this payment because its risk score is above 90.");
  if (!isNativeAndroid()) {
    throw new Error("Secure payment handoff requires the PayShield Android app.");
  }
  return (await NativeGuard.openUpi({ uri, riskScore })).opened;
}
