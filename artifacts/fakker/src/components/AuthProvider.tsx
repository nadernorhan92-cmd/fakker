import { ClerkProvider } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { arSA } from '@clerk/localizations';
import { useLocation } from 'wouter';
import type { ReactNode } from 'react';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl}
    localization={{ ...arSA, formFieldInputPlaceholder__emailAddress: 'أدخل بريدك الإلكتروني', formFieldInputPlaceholder__password: 'أدخل كلمة المرور' }}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    signInFallbackRedirectUrl={`${basePath}/settings`} signUpFallbackRedirectUrl={`${basePath}/settings`}
    routerPush={path => setLocation(stripBase(path))}
    routerReplace={path => setLocation(stripBase(path), { replace: true })}
    appearance={{
      options: { logoImageUrl: `${window.location.origin}${basePath}/logo.svg`, logoLinkUrl: basePath || '/' },
      variables: { colorPrimary: '#a75e43', colorForeground: '#352b26', colorMutedForeground: '#6b5d53', colorBackground: '#fffdf9', colorInput: '#ffffff', colorInputForeground: '#352b26', colorDanger: '#a64949', colorNeutral: '#5e4a3e', fontFamily: '"IBM Plex Sans Arabic", sans-serif', borderRadius: '12px' },
      elements: { cardBox: { width: '440px', maxWidth: '100%', background: '#fffdf9' }, headerTitle: { color: '#352b26' }, headerSubtitle: { color: '#6b5d53' }, formFieldLabel: { color: '#352b26' }, footerActionText: { color: '#6b5d53' }, footerActionLink: { color: '#81442e' }, socialButtonsBlockButtonText: { color: '#352b26' }, dividerText: { color: '#6b5d53' } },
    }}>{children}</ClerkProvider>;
}
