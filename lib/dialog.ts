import { Alert as RNAlert, AlertButton, Platform } from "react-native";

/**
 * Drop-in replacement for react-native's Alert.
 *
 * react-native-web ships Alert.alert as a NO-OP, so on the web build every
 * error message was invisible and confirm dialogs (like "Delete account?")
 * could never fire their buttons. Import { Alert } from "@/lib/dialog"
 * instead of "react-native" and web gets real browser dialogs; native is
 * unchanged.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    if (Platform.OS !== "web") {
      RNAlert.alert(title, message, buttons);
      return;
    }
    const text = message ? `${title}\n\n${message}` : title;
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const confirm = buttons.find((b) => b.style !== "cancel");
    const cancel = buttons.find((b) => b.style === "cancel");
    if (window.confirm(text)) {
      confirm?.onPress?.();
    } else {
      cancel?.onPress?.();
    }
  },
};
