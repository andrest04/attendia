import React from 'react';
import { Redirect, Route, RouteProps } from 'react-router-dom';
import { useAppState } from '../../state';

export default function PrivateRoute({ children, ...rest }: RouteProps) {
  const { isAuthReady, user, profile } = useAppState();

  // In firebase mode an authenticated user may still lack a profile (first-time
  // Google sign-in that never completed the role step). Send them to /login,
  // which renders the profile-completion step, instead of letting the prejoin
  // fall back to the legacy role chain and guess their role.
  const needsProfile = process.env.REACT_APP_SET_AUTH === 'firebase' && !!user && !profile;

  const renderChildren = (user || !process.env.REACT_APP_SET_AUTH) && !needsProfile;

  if (!renderChildren && !isAuthReady) {
    return null;
  }

  return (
    <Route
      {...rest}
      render={({ location }) =>
        renderChildren ? (
          children
        ) : (
          <Redirect
            to={{
              pathname: '/login',
              state: { from: location },
            }}
          />
        )
      }
    />
  );
}
