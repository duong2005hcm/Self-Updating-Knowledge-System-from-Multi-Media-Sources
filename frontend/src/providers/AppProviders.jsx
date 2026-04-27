import { AuthProvider } from "./AuthProvider";
import { LocaleProvider } from "./LocaleProvider";

export function AppProviders({ children }) {
  return (
    <LocaleProvider>
      <AuthProvider>{children}</AuthProvider>
    </LocaleProvider>
  );
}
