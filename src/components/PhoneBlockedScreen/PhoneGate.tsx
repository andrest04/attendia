import React from 'react';
import { useLocation } from 'react-router-dom';
import { routes } from '../../routes';
import { isPhoneBlocked } from '../../utils/isPhoneBlocked';
import PhoneBlockedScreen from './PhoneBlockedScreen';

interface PhoneGateProps {
  children: React.ReactNode;
  userAgent?: string;
}

// Shows the blocked screen instead of the app on a phone. /security stays reachable (privacy page).
export default function PhoneGate({ children, userAgent = navigator.userAgent }: PhoneGateProps) {
  const { pathname } = useLocation();
  const isSecurity = pathname === routes.security || pathname.startsWith(routes.security + '/');

  if (isPhoneBlocked(userAgent) && !isSecurity) {
    return <PhoneBlockedScreen />;
  }
  return <>{children}</>;
}
