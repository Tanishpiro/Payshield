import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeGuard = {
  listen(): Promise<{ transcript: string }>;
  authenticate(options: { reason: string }): Promise<{ verified: boolean }>;
  openUpi(options: { uri: string; riskScore: number }): Promise<{ opened: boolean }>;
};

const NativeGuard = registerPlugin<NativeGuard>("PayShieldGuard");

export const isNativeAndroid = () => Capacitor.getPlatform() === "android";

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
